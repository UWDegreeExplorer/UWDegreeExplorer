CREATE TABLE "planner_course_offerings" (
	"offering_id" serial PRIMARY KEY NOT NULL,
	"course_id" text,
	"term_code" text,
	"course_component" text,
	"version_id" integer
);
--> statement-breakpoint
CREATE TABLE "planner_course_requirements" (
	"course_id" text PRIMARY KEY NOT NULL,
	"latest_term" text,
	"prereq_raw" text,
	"coreq_raw" text,
	"antireq_raw" text,
	"level_prereq" text,
	"antireq_ids" text,
	"coreq_logic" text,
	"coreq_view" text DEFAULT 'fail',
	"prereq_json" text,
	"prereq_ids" text
);
--> statement-breakpoint
CREATE TABLE "planner_course_versions" (
	"version_id" serial PRIMARY KEY NOT NULL,
	"course_id" text,
	"term_code" text,
	"title" text,
	"description" text,
	"requirements" text,
	"desc_hash" text,
	"req_hash" text,
	"status" text DEFAULT 'auto'
);
--> statement-breakpoint
CREATE TABLE "planner_courses" (
	"course_id" text PRIMARY KEY NOT NULL,
	"subject_code" text,
	"catalog_number" text
);
--> statement-breakpoint
ALTER TABLE "planner_course_offerings" ADD CONSTRAINT "planner_course_offerings_course_id_planner_courses_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."planner_courses"("course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_course_offerings" ADD CONSTRAINT "planner_course_offerings_version_id_planner_course_versions_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."planner_course_versions"("version_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_course_requirements" ADD CONSTRAINT "planner_course_requirements_course_id_planner_courses_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."planner_courses"("course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_course_versions" ADD CONSTRAINT "planner_course_versions_course_id_planner_courses_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."planner_courses"("course_id") ON DELETE no action ON UPDATE no action;