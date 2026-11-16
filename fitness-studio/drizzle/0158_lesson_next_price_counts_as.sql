ALTER TABLE "class_types" ADD COLUMN "drop_in_price_next" integer;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "credit_cost_next" integer;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "pass_entries_next" integer;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "pass_surcharge_next" integer;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "counts_as_type_id" uuid;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "counts_as_lessons" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "class_types" ADD CONSTRAINT "class_types_counts_as_type_id_class_types_id_fk" FOREIGN KEY ("counts_as_type_id") REFERENCES "public"."class_types"("id") ON DELETE set null ON UPDATE no action;