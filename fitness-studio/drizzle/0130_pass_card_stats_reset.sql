-- Přehled → Pošli to dál se nuluje: dosavadní skenování a registrace byly zkoušky, počítá se od nasazení.
-- Nic se nemaže – přehled a počty naskenování u kartiček jen berou až to, co přijde potom (stejně jako tlačítko Vynulovat).
INSERT INTO "settings" ("key", "value")
VALUES ('passCardStatsFrom', to_jsonb(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";
