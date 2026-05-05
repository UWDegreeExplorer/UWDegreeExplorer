import { pgTable, text, integer, serial, primaryKey, foreignKey, numeric } from "drizzle-orm/pg-core";

// Master table for courses, storing basic metadata and unit values
export const courses = pgTable("planner_courses", {
  courseId: text("course_id").primaryKey(),
  subjectCode: text("subject_code"),
  catalogNumber: text("catalog_number"),
  units: numeric("units", { precision: 3, scale: 2 }).default("0.00"),
});

// Historical versions of course data, allowing for term-specific titles and descriptions
export const courseVersions = pgTable("planner_course_versions", {
  versionId: serial("version_id").primaryKey(),
  courseId: text("course_id").references(() => courses.courseId),
  termCode: text("term_code"),
  title: text("title"),
  description: text("description"),
  requirements: text("requirements"),
  descHash: text("desc_hash"),
  reqHash: text("req_hash"),
  status: text("status").default("auto"),
});

// Specific term offerings for each course to track historical availability
export const courseOfferings = pgTable("planner_course_offerings", {
  offeringId: serial("offering_id").primaryKey(),
  courseId: text("course_id").references(() => courses.courseId),
  termCode: text("term_code"),
  courseComponent: text("course_component"),
  versionId: integer("version_id").references(() => courseVersions.versionId),
});

// Structured requirement data (prerequisites, antirequisites, etc.) linked to a course
export const courseRequirements = pgTable("planner_course_requirements", {
  courseId: text("course_id").primaryKey().references(() => courses.courseId),
  latestTerm: text("latest_term"),
  prereqRaw: text("prereq_raw"),
  coreqRaw: text("coreq_raw"),
  antireqRaw: text("antireq_raw"),
  levelPrereq: text("level_prereq"),
  antireqIds: text("antireq_ids"),
  coreqLogic: text("coreq_logic"),
  coreqView: text("coreq_view").default("fail"),
  prereqJson: text("prereq_json"),
  prereqIds: text("prereq_ids"),
});

// Mapping of subjects to their respective breadth requirement categories
export const subjectBreadth = pgTable("planner_subject_breadth", {
  subjectCode: text("subject_code"),
  category: text("category").notNull(), // Humanities, Pure Sciences, Social Sciences, etc.
}, (table) => ({
  pk: primaryKey({ columns: [table.subjectCode, table.category] }),
}));

// 6. 专业列表表
export const programs = pgTable("planner_programs", {
  id: text("id").primaryKey(), // 4位数字 ID
  name: text("name").notNull(),
  category: text("category"),
});
