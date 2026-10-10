-- Barre + Brunch: pop-up pops up again every Wednesday (even for those who closed it); breakfast emoji in the bar and on the button.
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('popup.repeatDay', 'středa', now()),
  ('popup.buttonLabel', 'Rezervovat Barre + Brunch 🥐', now()),
  ('promoBar.text', '🥐☕ Barre + Brunch v sobotu 31. 10. v 8:30 🍓', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
