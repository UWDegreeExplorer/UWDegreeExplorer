import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const draftsTable = pgTable("drafts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  section: text("section"), // Optional in draft
  title: text("title"),
  body: text("body"),
  postId: integer("post_id"), // For comment drafts
  parentId: integer("parent_id"), // For nested comment drafts
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    userIdIdx: index("drafts_user_id_idx").on(table.userId),
  };
});

export type Draft = typeof draftsTable.$inferSelect;
export type NewDraft = typeof draftsTable.$inferInsert;
