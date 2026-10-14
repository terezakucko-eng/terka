ALTER TABLE "products" ADD COLUMN "commitment_months" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
-- „Členství bez závazku“ next to the main membership: same perks, 1 790 Kč a month, cancellable at the end of a paid month.
-- Hidden until switched on in Administrace → Ceník (V nabídce) – until this code is live the old price list would show it with the 12-month text.
INSERT INTO "products" ("id", "kind", "name", "description", "price", "entries", "validity_days", "weekly_limit", "recurring", "highlight", "is_active", "members_only", "link_only", "sort_order", "commitment_months")
SELECT 'b3d1c4a2-6f0e-4c1b-9a57-2e8d5f7c9a10', 'membership', 'Členství bez závazku',
  'Stejné výhody jako členství – bez závazku, zrušíš ho kdykoli ke konci měsíce.',
  179000, NULL, 3650, NULL, false, false, false, false, false, "sort_order" + 1, 0
FROM "products"
WHERE "kind" = 'membership' AND "archived_at" IS NULL AND "is_active" AND NOT "link_only" AND "weekly_limit" IS NULL
ORDER BY "sort_order"
LIMIT 1
ON CONFLICT ("id") DO NOTHING;
