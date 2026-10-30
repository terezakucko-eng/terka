CREATE TABLE "pass_card_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pass_card_scans" ADD CONSTRAINT "pass_card_scans_card_id_pass_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."pass_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_card_scans" ADD CONSTRAINT "pass_card_scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pass_card_scans_card_idx" ON "pass_card_scans" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "pass_card_scans_created_idx" ON "pass_card_scans" USING btree ("created_at");