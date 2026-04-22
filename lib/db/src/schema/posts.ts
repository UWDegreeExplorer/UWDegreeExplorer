import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const SECTION_VALUES = [
  "carpool",
  "academic",
  "roommate",
  "other",
] as const;
export type Section = (typeof SECTION_VALUES)[number];

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  section: text("section").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  authorId: integer("author_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  authorNameSnapshot: text("author_name_snapshot").notNull(),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Post = typeof postsTable.$inferSelect;
export type InsertPost = typeof postsTable.$inferInsert;
