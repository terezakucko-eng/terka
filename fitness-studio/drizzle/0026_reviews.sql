CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_user_idx" ON "reviews" USING btree ("user_id");