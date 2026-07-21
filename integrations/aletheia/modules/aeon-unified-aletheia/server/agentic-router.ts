import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AgentLoop, type AgentGoal } from "./agentic/agent-loop";

/**
 * tRPC router for agentic system operations
 * Exposes agent capabilities through the API
 */

export const agenticRouter = router({
  /**
   * Execute a single agent goal
   */
  executeGoal: protectedProcedure
    .input(
      z.object({
        objective: z.string().min(1),
        constraints: z.record(z.any()).optional(),
        context: z.string().optional(),
        branches: z.number().min(1).max(10).default(3),
        maxIterations: z.number().min(1).max(5).default(2),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const agent = new AgentLoop("ionos");

        const goal: AgentGoal = {
          objective: input.objective,
          constraints: input.constraints,
          context: input.context,
          branches: input.branches,
          maxIterations: input.maxIterations,
        };

        const result = await agent.execute(goal);

        return {
          success: result.success,
          goal: result.goal,
          blueprint: result.blueprint ? {
            id: result.blueprint.id,
            goal: result.blueprint.goal,
            nodeCount: result.blueprint.nodes.length,
            flowCount: result.blueprint.flows.length,
          } : null,
          evolutionStatus: result.evolutionResult?.status,
          bestDelta: result.evolutionResult?.bestDelta,
          reasoning: result.reasoning,
          executionTime: result.executionTime,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Agent execution failed",
        });
      }
    }),

  /**
   * Get agent memory/history
   */
  getMemory: protectedProcedure.query(async () => {
    try {
      const agent = new AgentLoop("ionos");
      const memory = agent.getMemory();

      return {
        entries: memory.map((entry) => ({
          timestamp: entry.timestamp,
          type: entry.type,
          content: entry.content,
        })),
        totalEntries: memory.length,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve agent memory",
      });
    }
  }),

  /**
   * Clear agent memory
   */
  clearMemory: protectedProcedure.mutation(async () => {
    try {
      const agent = new AgentLoop("ionos");
      agent.clearMemory();

      return { success: true };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to clear agent memory",
      });
    }
  }),

  /**
   * Get agent status and capabilities
   */
  getStatus: protectedProcedure.query(async () => {
    return {
      status: "active",
      capabilities: [
        "reverse-solving",
        "blueprint-generation",
        "multi-branch-evolution",
        "sandbox-execution",
        "self-optimization",
      ],
      models: ["ionos", "gemini"],
      version: "1.0.0",
    };
  }),

  /**
   * Batch execute multiple goals
   */
  executeBatch: protectedProcedure
    .input(
      z.object({
        goals: z.array(
          z.object({
            objective: z.string().min(1),
            constraints: z.record(z.any()).optional(),
            context: z.string().optional(),
          })
        ),
        branches: z.number().min(1).max(10).default(3),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const agent = new AgentLoop("ionos");
        const results = [];

        for (const goalInput of input.goals) {
          const goal: AgentGoal = {
            objective: goalInput.objective,
            constraints: goalInput.constraints,
            context: goalInput.context,
            branches: input.branches,
          };

          const result = await agent.execute(goal);
          results.push({
            success: result.success,
            objective: goalInput.objective,
            reasoning: result.reasoning,
            executionTime: result.executionTime,
          });
        }

        const successCount = results.filter((r) => r.success).length;

        return {
          total: results.length,
          successful: successCount,
          successRate: (successCount / results.length) * 100,
          results,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Batch execution failed",
        });
      }
    }),
});
