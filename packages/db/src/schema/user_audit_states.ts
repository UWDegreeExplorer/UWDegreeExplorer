import { pgTable, serial, integer, timestamp, jsonb, text, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userAuditStates = pgTable("user_audit_states", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  programSlugs: jsonb("program_slugs").notNull().default('[]'),
  transcriptText: text("transcript_text").default(""),
  assignments: jsonb("assignments").notNull().default('{}'),
  options: jsonb("options").notNull().default('{}'),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  unq: unique().on(table.userId),
}));

export type UserAuditState = typeof userAuditStates.$inferSelect;
export type InsertUserAuditState = typeof userAuditStates.$inferInsert;
