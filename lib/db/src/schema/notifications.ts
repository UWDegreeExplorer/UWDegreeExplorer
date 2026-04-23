import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { postsTable } from "./posts";
import { commentsTable } from "./comments";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(), // 接收者
  actorId: integer("actor_id").references(() => usersTable.id), // 触发者 (可选，匿名时为空)
  type: text("type", { enum: ["reply_to_post", "reply_to_comment"] }).notNull(),
  postId: integer("post_id").references(() => postsTable.id).notNull(),
  commentId: integer("comment_id").references(() => commentsTable.id), // 相关的评论 ID
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
