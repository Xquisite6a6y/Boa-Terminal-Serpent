import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { agenticRouter } from "./agentic-router";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createChatSession,
  getChatSession,
  getUserChatSessions,
  updateChatSessionTitle,
  addChatMessage,
  getSessionMessages,
  quarantineFailedResponse,
  getQuarantineLog,
} from "./db";
import { chat } from "./ai-integration";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  agentic: agenticRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  chat: router({
    createSession: protectedProcedure
      .input(z.object({ model: z.enum(["ionos", "gemini"]).default("ionos") }))
      .mutation(async ({ ctx, input }) => {
        const session = await createChatSession(ctx.user.id, input.model);
        return session;
      }),

    getSessions: protectedProcedure.query(async ({ ctx }) => {
      const sessions = await getUserChatSessions(ctx.user.id);
      return sessions;
    }),

    getSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await getChatSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

        const messages = await getSessionMessages(input.sessionId);
        return { session, messages };
      }),

    sendMessage: protectedProcedure
      .input(
        z.object({
          sessionId: z.number(),
          message: z.string().min(1),
          usePredictionMode: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const session = await getChatSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

        await addChatMessage(input.sessionId, "user", input.message);

        const messages = await getSessionMessages(input.sessionId);
        const conversationMessages = messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        const result = await chat(conversationMessages, (session.model as "ionos" | "gemini") || "ionos", {
          usePredictionMode: input.usePredictionMode,
        });

        if (!result.success) {
          await quarantineFailedResponse(
            input.sessionId,
            input.message,
            session.model,
            "api_error",
            result.error
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to get response from ${session.model}: ${result.error}`,
          });
        }

        const assistantMessage = await addChatMessage(
          input.sessionId,
          "assistant",
          result.content,
          result.model,
          result.tokensUsed
        );

        if (messages.length === 1) {
          const title = input.message.substring(0, 50) + (input.message.length > 50 ? "..." : "");
          await updateChatSessionTitle(input.sessionId, title);
        }

        return {
          message: assistantMessage,
          tokensUsed: result.tokensUsed,
        };
      }),

    switchModel: protectedProcedure
      .input(z.object({ sessionId: z.number(), model: z.enum(["ionos", "gemini"]) }))
      .mutation(async ({ ctx, input }) => {
        const session = await getChatSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

        const title = session.title || "Conversation";
        await updateChatSessionTitle(input.sessionId, title);
        return { success: true };
      }),

    getQuarantine: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await getChatSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

        const logs = await getQuarantineLog(input.sessionId);
        return logs;
      }),
  }),
});

export type AppRouter = typeof appRouter;
