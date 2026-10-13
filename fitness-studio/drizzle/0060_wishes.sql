CREATE TYPE "public"."wish_kind" AS ENUM('idea', 'wish', 'praise', 'concern');--> statement-breakpoint
CREATE TYPE "public"."wish_status" AS ENUM('new', 'read', 'resolved');--> statement-breakpoint
CREATE TABLE "wishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "wish_kind" NOT NULL,
	"body" text NOT NULL,
	"allow_public" boolean DEFAULT false NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"signature" text,
	"status" "wish_status" DEFAULT 'new' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"reply" text,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wishes_user_idx" ON "wishes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wishes_status_idx" ON "wishes" USING btree ("status");