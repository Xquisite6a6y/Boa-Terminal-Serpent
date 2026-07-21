import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Chat sessions table - stores conversation sessions per user
 */
export const chatSessions = mysqlTable("chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }).default("New Conversation"),
  model: varchar("model", { length: 64 }).default("ionos").notNull(), // 'ionos' or 'gemini'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

/**
 * Chat messages table - stores all messages in conversations
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().references(() => chatSessions.id),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  model: varchar("model", { length: 64 }), // which model generated this response
  tokensUsed: int("tokensUsed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Quarantine log - stores failed/defective responses for debugging
 */
export const quarantineLog = mysqlTable("quarantine_log", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull().references(() => chatSessions.id),
  userMessage: text("userMessage").notNull(),
  attemptedModel: varchar("attemptedModel", { length: 64 }).notNull(),
  errorMessage: text("errorMessage"),
  responseContent: text("responseContent"),
  reason: varchar("reason", { length: 255 }), // 'timeout', 'error', 'malformed', etc.
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuarantineLog = typeof quarantineLog.$inferSelect;
export type InsertQuarantineLog = typeof quarantineLog.$inferInsert;