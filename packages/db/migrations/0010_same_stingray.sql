CREATE TABLE "planner_programs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text
);
--> statement-breakpoint
CREATE TABLE "user_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"term" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_schedules_user_id_term_unique" UNIQUE("user_id","term")
);
--> statement-breakpoint
CREATE TABLE "user_workloads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"term" text NOT NULL,
	"data" jsonb NOT NULL,
	"score" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_workloads_user_id_term_unique" UNIQUE("user_id","term")
);
--> statement-breakpoint
CREATE TABLE "user_course_grades" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"term" text NOT NULL,
	"course_code" text NOT NULL,
	"target_grade" double precision DEFAULT 80,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_course_grades_user_id_term_course_code_unique" UNIQUE("user_id","term","course_code")
);
--> statement-breakpoint
CREATE TABLE "user_grade_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_grade_id" integer NOT NULL,
	"parent_id" integer,
	"name" text NOT NULL,
	"weight" double precision NOT NULL,
	"score" double precision,
	"is_leaf" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planner_courses" ALTER COLUMN "units" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "user_schedules" ADD CONSTRAINT "user_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_workloads" ADD CONSTRAINT "user_workloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_grades" ADD CONSTRAINT "user_course_grades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_grade_components" ADD CONSTRAINT "user_grade_components_course_grade_id_user_course_grades_id_fk" FOREIGN KEY ("course_grade_id") REFERENCES "public"."user_course_grades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_grade_components" ADD CONSTRAINT "user_grade_components_parent_id_user_grade_components_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user_grade_components"("id") ON DELETE cascade ON UPDATE no action;