import { pgTable, serial, text, integer, timestamp, unique, doublePrecision } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userCourseGrades = pgTable("user_course_grades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  term: text("term").notNull(),
  courseCode: text("course_code").notNull(),
  targetGrade: doublePrecision("target_grade").default(80.0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  unq: unique().on(table.userId, table.term, table.courseCode),
}));

export type UserCourseGrade = typeof userCourseGrades.$inferSelect;
export type InsertUserCourseGrade = typeof userCourseGrades.$inferInsert;
