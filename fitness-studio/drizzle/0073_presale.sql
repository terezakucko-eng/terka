ALTER TABLE "products" ADD COLUMN "presale_from" timestamp with time zone;--> statement-breakpoint
-- „Členství 2027“ v předprodeji: koupit jde už teď, platí od 1. 1. 2027 (první platba = leden).
-- „Členství 2026“ se dál prodává do konce roku.
UPDATE "products" SET "presale_from" = now()
WHERE "id" = 'f6e8d8e1-becd-4c1f-90c3-15f86465b278' AND "presale_from" IS NULL;--> statement-breakpoint
-- „Členství bez závazku“ za 1 600 Kč měsíčně (pod Fitparkem); kdo ho už má za 1 790 Kč, platí od teď taky 1 600 Kč.
UPDATE "products" SET "price" = 160000
WHERE "id" = 'b3d1c4a2-6f0e-4c1b-9a57-2e8d5f7c9a10' AND "price" = 179000;--> statement-breakpoint
UPDATE "orders" SET "amount" = 160000
WHERE "kind" = 'membership_fee' AND "status" = 'pending' AND "amount" = 179000
  AND "user_id" IN (SELECT "user_id" FROM "entitlements" WHERE "product_id" = 'b3d1c4a2-6f0e-4c1b-9a57-2e8d5f7c9a10' AND "monthly_fee" = 179000);--> statement-breakpoint
UPDATE "entitlements" SET "monthly_fee" = 160000
WHERE "product_id" = 'b3d1c4a2-6f0e-4c1b-9a57-2e8d5f7c9a10' AND "monthly_fee" = 179000;
