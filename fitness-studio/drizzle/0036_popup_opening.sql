-- Pop-up for the grand opening on 9 Oct 2026 (hides itself after that day).
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('popup.title', 'Slavnostní otevření OCTOPUSH', now()),
  ('popup.text', 'Pátek 9. 10. – v 17:00 Zumba Toning, v 18:00 Zumba fitness. Občerstvení po celou dobu a vstup zdarma pro všechny registrované.', now()),
  ('popup.image', '/img/otevreni-popup.webp', now()),
  ('popup.buttonLabel', 'Rezervovat místo', now()),
  ('popup.buttonUrl', '/rozvrh?tyden=2026-10-05', now()),
  ('popup.until', '2026-10-09', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
