-- Pop-up for the grand opening on 9 Oct 2026 (hides itself after that day).
-- Empty text and button label = only the poster shows; a tap on it opens the schedule.
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('popup.title', 'Konečně! Otvíráme 9. 10. 2026 – vstup zdarma pro všechny registrované', now()),
  ('popup.text', '', now()),
  ('popup.image', '/img/otevreni-2026.webp', now()),
  ('popup.buttonLabel', '', now()),
  ('popup.buttonUrl', '/rozvrh?tyden=2026-10-05', now()),
  ('popup.until', '2026-10-09', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
