-- The Barre Brunch pop-up ends tonight at 23:59 (shown through 30. 10.); the next one, about membership 2027, shows from 31. 10.
UPDATE "content" SET "value" = '2026-10-30', "updated_at" = now()
WHERE "key" = 'popup.until' AND "value" = '2026-10-31'
  AND EXISTS (SELECT 1 FROM "content" WHERE "key" = 'popup.title' AND "value" LIKE '%Brunch%');
