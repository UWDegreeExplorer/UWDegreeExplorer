import { pgTable, serial, text, integer, timestamp, jsonb, unique, doublePrecision } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userWorkloads = pgTable("user_workloads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  term: text("term").notNull(),
  data: jsonb("data").notNull(), // Full analysis result including courses and ratings
  score: doublePrecision("score").notNull(), // Final aggregate workload score
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  unq: unique().on(table.userId, table.term),
}));

export type UserWorkload = typeof userWorkloads.$inferSelect;
export type InsertUserWorkload = typeof userWorkloads.$inferInsert;
