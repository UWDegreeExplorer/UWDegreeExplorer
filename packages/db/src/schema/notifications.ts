import { pgTable, serial, integer, text, boolean, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { postsTable } from "./posts";
import { commentsTable } from "./comments";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(), // 接收者
  actorId: integer("actor_id").references(() => usersTable.id), // 触发者 (可选，匿名时为空)
  type: text("type", { 
    enum: [
      "reply_to_post", 
      "reply_to_comment", 
      "connect_request", 
      "connect_accepted", 
      "dm_message"
    ] 
  }).notNull(),
  postId: integer("post_id").references(() => postsTable.id, { onDelete: "cascade" }),
  actorName: text("actor_name"),
  postTitle: text("post_title"),
  commentId: integer("comment_id").references(() => commentsTable.id, { onDelete: "cascade" }), // 相关的评论 ID
  connectRequestId: uuid("connect_request_id"), // 相关连接请求 ID
  conversationId: uuid("conversation_id"), // 相关会话 ID
  metadata: jsonb("metadata"), // 其他灵活数据
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
