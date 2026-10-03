-- 0036 already ran on databases that got an earlier draft of the opening pop-up; set the final content again.
-- Pop-up for the grand opening on 9 Oct 2026 (hides itself after that day).
-- No text = only the poster shows, with a booking button for each class under it.
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('popup.title', 'Konečně! Otvíráme 9. 10. 2026 – vstup zdarma pro všechny registrované', now()),
  ('popup.text', '', now()),
  ('popup.image', '/img/otevreni-9-10-2026.webp', now()),
  ('popup.buttonLabel', 'Rezervovat 17:00 Zumba Toning', now()),
  ('popup.buttonUrl', '/rozvrh/termin?lekce=Zumba%20Toning&kdy=2026-10-09T17:00', now()),
  ('popup.buttonLabel2', 'Rezervovat 18:00 Zumba fitness', now()),
  ('popup.buttonUrl2', '/rozvrh/termin?lekce=Zumba%20fitness&kdy=2026-10-09T18:00', now()),
  ('popup.until', '2026-10-09', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
