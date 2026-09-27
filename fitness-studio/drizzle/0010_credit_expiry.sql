ALTER TYPE "public"."credit_reason" ADD VALUE 'expired';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "credit_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "credit_expiry_warned_at" timestamp with time zone;