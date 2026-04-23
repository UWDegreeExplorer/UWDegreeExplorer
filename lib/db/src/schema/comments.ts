import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { postsTable } from "./posts";

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => postsTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  authorId: integer("author_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  authorNameSnapshot: text("author_name_snapshot").notNull(),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => {
  return {
    authorIdIdx: index("comments_author_id_idx").on(table.authorId),
    postIdIdx: index("comments_post_id_idx").on(table.postId),
  };
});

export type Comment = typeof commentsTable.$inferSelect;
export type InsertComment = typeof commentsTable.$inferInsert;
