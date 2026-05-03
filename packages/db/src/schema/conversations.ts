import { sql } from "drizzle-orm";
import { pgTable, uuid, timestamp, integer, text, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { postsTable } from "./posts";
import { commentsTable } from "./comments";

export const conversationsTable = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const conversationParticipantsTable = pgTable("conversation_participants", {
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at", { withTimezone: true, mode: "date" }),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.conversationId, table.userId] }),
    userConversationUnique: uniqueIndex("user_conversation_unique_idx").on(table.conversationId, table.userId),
  };
});

export const messagesTable = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").references(() => usersTable.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
}, (table) => {
  return {
    convCreatedAtIdx: index("messages_conv_created_at_idx").on(table.conversationId, table.createdAt),
  };
});

export const connectRequestsTable = pgTable("connect_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  requesterId: integer("requester_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  targetUserId: integer("target_user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  sourcePostId: integer("source_post_id").references(() => postsTable.id, { onDelete: "cascade" }).notNull(),
  sourceCommentId: integer("source_comment_id").references(() => commentsTable.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "accepted", "declined"] }).default("pending").notNull(),
  conversationId: uuid("conversation_id").references(() => conversationsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
}, (table) => {
  return {
    pendingPostUnique: uniqueIndex("pending_connect_post_idx").on(
      table.requesterId, 
      table.targetUserId, 
      table.sourcePostId
    ).where(sql`${table.sourceCommentId} IS NULL AND ${table.status} = 'pending'`),
    pendingCommentUnique: uniqueIndex("pending_connect_comment_idx").on(
      table.requesterId, 
      table.targetUserId, 
      table.sourcePostId,
      table.sourceCommentId
    ).where(sql`${table.sourceCommentId} IS NOT NULL AND ${table.status} = 'pending'`),
  };
});

export type Conversation = typeof conversationsTable.$inferSelect;
export type InsertConversation = typeof conversationsTable.$inferInsert;

export type ConversationParticipant = typeof conversationParticipantsTable.$inferSelect;
export type InsertConversationParticipant = typeof conversationParticipantsTable.$inferInsert;

export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = typeof messagesTable.$inferInsert;
