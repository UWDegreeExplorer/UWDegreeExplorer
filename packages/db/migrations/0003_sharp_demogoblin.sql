CREATE TABLE "connect_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" integer NOT NULL,
	"target_user_id" integer NOT NULL,
	"source_post_id" integer NOT NULL,
	"source_comment_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "post_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "actor_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "post_title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "connect_request_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "connect_requests" ADD CONSTRAINT "connect_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect_requests" ADD CONSTRAINT "connect_requests_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect_requests" ADD CONSTRAINT "connect_requests_source_post_id_posts_id_fk" FOREIGN KEY ("source_post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect_requests" ADD CONSTRAINT "connect_requests_source_comment_id_comments_id_fk" FOREIGN KEY ("source_comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect_requests" ADD CONSTRAINT "connect_requests_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_connect_idx" ON "connect_requests" USING btree ("requester_id","target_user_id","source_post_id","source_comment_id");