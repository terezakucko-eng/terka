-- „Rezervovat výhodně obě lekce“ – the Zumba SPECIAL bundle (both lessons for 300 Kč) one click away: the link opens the
-- Toning's booking with the bundle picked (?balicek=1). In the pop-up a featured button over the whole width above the two
-- lessons' buttons (the pop-up shows once more to everyone, with it)…
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('popup.buttonLabel3', 'Rezervovat výhodně obě lekce', now()),
  ('popup.buttonUrl3', '/rozvrh/5ea2983c-b146-45ae-b4b6-f86c43acc4c4?balicek=1', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
--> statement-breakpoint
-- …and on the board post, a line right after „Rezervuj si místo: 17:00 … · 18:00 …“ (as the studio edited it, or as posted).
UPDATE "announcements" SET "body" = regexp_replace("body",
    '(href="/rozvrh/00d2c63c-54d6-4248-a5a0-842b458b2e96"[^>]*>[^<]*</a>[^<]*</p>)',
    '\1<p>💃 <a href="/rozvrh/5ea2983c-b146-45ae-b4b6-f86c43acc4c4?balicek=1"><strong>Rezervovat výhodně obě lekce</strong></a> za 300 Kč</p>')
WHERE "id" = '146aa9e2-80ab-437c-b082-47ecb7403616' AND "body" NOT LIKE '%balicek=1%';
