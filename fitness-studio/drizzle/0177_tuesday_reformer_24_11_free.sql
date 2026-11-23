-- Reformer v úterý 24. 11. 2026 v 18:00 (migrace 0176) je zdarma pro všechny – ochutnávka úterního Reformeru (přání
-- studia 23. 11. 2026). Jen dokud na něm nikdo není: kdo by se už přihlásil a zaplatil, tomu by se nic nevrátilo.
-- Poznámku dostane, jen když žádnou nemá. Opakované spuštění nic nezmění.
UPDATE "class_sessions" s SET
  "is_free" = true,
  "note" = CASE WHEN coalesce(trim(s."note"), '') = ''
    THEN 'Ochutnávka zdarma pro všechny! 🎉 Od 1. 12. tu na tebe Reformer čeká každé úterý v 18:00.' ELSE s."note" END
WHERE s."id" = '295a46a8-a154-4d21-b739-f2c4beb5598c' AND s."status"::text = 'scheduled' AND NOT s."is_free"
  AND NOT EXISTS (SELECT 1 FROM "bookings" b WHERE b."session_id" = s."id" AND b."status"::text <> 'cancelled');
