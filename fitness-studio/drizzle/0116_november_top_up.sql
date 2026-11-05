-- Klientka z 0115, která platí za listopad a prosinec 2 000 Kč i za druhé členství, už za listopad zaplatila
-- 1 400 Kč (výzva z doby před úpravou). Dostane mimořádnou výzvu na zbytek – doplatek 600 Kč (2 000 − zaplaceno),
-- zaplatí ho v Můj účet (QR / převod), e-mailem ho jde poslat v Příspěvcích tlačítkem „Připomenout“.
-- Najde se podle poznámky u členství z 0115; jen když je jediná, za listopad už něco zaplatila, zbývá doplatit
-- a čekající listopadovou výzvu nemá. Dynamicky: na čisté databázi je 'membership_fee' čerstvě přidaná hodnota.
DO $$
BEGIN
  IF (
    SELECT count(DISTINCT e."user_id") FROM "entitlements" e
    WHERE e."kind"::text = 'membership' AND e."status"::text = 'active'
      AND e."monthly_fee" = 200000 AND e."monthly_fee_until" = '2026-12' AND e."monthly_fee_after" = 100000
      AND e."note" LIKE 'Od 11/2026 na 12 měsíců – 11–12/2026 2 000 Kč i za druhé členství%'
  ) = 1 THEN
    EXECUTE $q$
      WITH "payer" AS (
        SELECT DISTINCT e."user_id" FROM "entitlements" e
        WHERE e."kind"::text = 'membership' AND e."status"::text = 'active'
          AND e."monthly_fee" = 200000 AND e."monthly_fee_until" = '2026-12' AND e."monthly_fee_after" = 100000
          AND e."note" LIKE 'Od 11/2026 na 12 měsíců – 11–12/2026 2 000 Kč i za druhé členství%'
      ),
      "paid" AS (
        SELECT p."user_id", COALESCE(sum(o."amount"), 0) AS "sum"
        FROM "payer" p
        LEFT JOIN "orders" o ON o."user_id" = p."user_id" AND o."kind"::text = 'membership_fee' AND o."period" = '2026-11' AND o."status"::text = 'paid'
        GROUP BY p."user_id"
      )
      INSERT INTO "orders" ("user_id", "kind", "period", "description", "amount", "provider")
      SELECT p."user_id", 'membership_fee', '2026-11', 'Doplatek členského příspěvku – listopad 2026 (druhé členství)', 200000 - p."sum", 'transfer'
      FROM "paid" p
      WHERE p."sum" > 0 AND p."sum" < 200000
        AND NOT EXISTS (
          SELECT 1 FROM "orders" o
          WHERE o."user_id" = p."user_id" AND o."kind"::text = 'membership_fee' AND o."period" = '2026-11' AND o."status"::text = 'pending'
        )
    $q$;
  END IF;
END $$;
