import { pgTable, serial, text, integer, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userSchedules = pgTable("user_schedules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  term: text("term").notNull(),
  data: jsonb("data").notNull(), // Array of ParsedCourse
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  unq: unique().on(table.userId, table.term),
}));

export type UserSchedule = typeof userSchedules.$inferSelect;
export type InsertUserSchedule = typeof userSchedules.$inferInsert;
