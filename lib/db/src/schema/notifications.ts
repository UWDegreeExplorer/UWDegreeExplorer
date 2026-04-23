import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { posts } from "./posts";
import { comments } from "./comments";

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(), // 接收者
  actorId: integer("actor_id").references(() => users.id), // 触发者 (可选，匿名时为空)
  type: text("type", { enum: ["reply_to_post", "reply_to_comment"] }).notNull(),
  postId: integer("post_id").references(() => posts.id).notNull(),
  commentId: integer("comment_id").references(() => comments.id), // 相关的评论 ID
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
