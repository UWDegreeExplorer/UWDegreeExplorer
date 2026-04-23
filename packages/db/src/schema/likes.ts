import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { postsTable } from "./posts";
import { commentsTable } from "./comments";

export const likesTable = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  postId: integer("post_id").references(() => postsTable.id, { onDelete: "cascade" }),
  commentId: integer("comment_id").references(() => commentsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // Ensure a user can only like a specific post or comment once
  userPostUnique: unique().on(t.userId, t.postId),
  userCommentUnique: unique().on(t.userId, t.commentId),
}));

export type Like = typeof likesTable.$inferSelect;
export type InsertLike = typeof likesTable.$inferInsert;
