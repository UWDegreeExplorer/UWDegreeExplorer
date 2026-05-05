import { integer, pgTable, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { postsTable } from "./posts";
import { usersTable } from "./users";

export const postViewsTable = pgTable("post_views", {
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  postId: integer("post_id")
    .notNull()
    .references(() => postsTable.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
}, (table) => {
  return {
    userPostUnique: uniqueIndex("post_views_user_post_idx").on(table.userId, table.postId),
  };
});

export type PostView = typeof postViewsTable.$inferSelect;
export type InsertPostView = typeof postViewsTable.$inferInsert;
