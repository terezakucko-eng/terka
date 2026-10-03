-- Pop-up for the grand opening on 9 Oct 2026 (hides itself after that day).
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('popup.title', 'Konečně! Otvíráme 9. 10. 2026 🎉', now()),
  ('popup.text', 'Dočkali jsme se – a vy taky! Chapadla nahoru a jdeme to rozhýbat: v 17:00 Zumba Toning, v 18:00 Zumba fitness a mezi tím dobroty a něco na zapití.

Pro všechny registrované je vstup ZDARMA. Ještě nemáš účet? Registrace zabere minutku.', now()),
  ('popup.image', '/img/otevreni-popup.webp', now()),
  ('popup.buttonLabel', 'Chci tam být', now()),
  ('popup.buttonUrl', '/rozvrh?tyden=2026-10-05', now()),
  ('popup.until', '2026-10-09', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
