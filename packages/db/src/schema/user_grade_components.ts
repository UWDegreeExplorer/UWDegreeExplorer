import { pgTable, serial, text, integer, timestamp, doublePrecision, boolean, AnyPgColumn } from "drizzle-orm/pg-core";
import { userCourseGrades } from "./user_course_grades";

export const userGradeComponents = pgTable("user_grade_components", {
  id: serial("id").primaryKey(),
  courseGradeId: integer("course_grade_id")
    .notNull()
    .references(() => userCourseGrades.id, { onDelete: "cascade" }),
  parentId: integer("parent_id").references((): AnyPgColumn => userGradeComponents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  weight: doublePrecision("weight").notNull(), // Percentage, e.g. 20.0 for 20%
  score: doublePrecision("score"), // Actual grade achieved, null if pending
  isLeaf: boolean("is_leaf").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserGradeComponent = typeof userGradeComponents.$inferSelect;
export type InsertUserGradeComponent = typeof userGradeComponents.$inferInsert;
