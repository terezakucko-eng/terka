-- Sobotní Barre + Brunch: the bar and the pop-up show how many places are left (live) with a stronger call to action.
-- A new pop-up title shows it again to everyone who already closed the old one; both disappear after Saturday.
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('promoBar.text', '🥐☕ Sobotní Barre + Brunch · 31. 10. v 8:30', now()),
  ('promoBar.linkLabel', 'Rezervuj si místo', now()),
  ('promoBar.linkUrl', '/rozvrh/3f3a2507-1b0e-48c3-a9d8-d7d0afc7a21c', now()),
  ('promoBar.until', '2026-10-31', now()),
  ('promoBar.showSpots', 'ano', now()),
  ('popup.title', '🥐 Barre + Brunch už tuto sobotu 31. 10.', now()),
  ('popup.buttonLabel', 'Rezervuj si místo 🥐', now()),
  ('popup.buttonUrl', '/rozvrh/3f3a2507-1b0e-48c3-a9d8-d7d0afc7a21c', now()),
  ('popup.showSpots', 'ano', now()),
  ('popup.until', '2026-10-31', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
