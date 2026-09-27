ALTER TABLE "bookings" ADD COLUMN "entries_charged" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "pass_entries" integer DEFAULT 1 NOT NULL;