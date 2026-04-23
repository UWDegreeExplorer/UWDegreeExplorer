import { usersTable } from "./users";
import { postsTable } from "./posts";

export const bookmarksTable = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  postId: integer("post_id").references(() => postsTable.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    userPostIndex: uniqueIndex("user_post_idx").on(table.userId, table.postId),
  };
});
