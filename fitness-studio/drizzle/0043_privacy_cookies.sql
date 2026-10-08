-- Privacy policy: list what the site really keeps in the browser (login, closed bar/pop-up/notice, Turnstile)
-- and add Stripe + Cloudflare to recipients. Only touches a text saved in the admin; untouched texts use the new default.
UPDATE "content"
SET "value" = replace(replace("value",
    'Web používá pouze technicky nezbytnou cookie pro přihlášení. Analytické ani marketingové cookies nepoužíváme.',
    'Web používá jen technicky nezbytné a funkční cookies a úložiště prohlížeče, ke kterým není potřeba souhlas: cookie pro přihlášení ke klientskému účtu, zapamatování zavřené informační lišty, vyskakovacího okna a nabídky upozornění (aby se znovu nezobrazovaly) a ochranu registračního formuláře před roboty (Cloudflare Turnstile). Platba kartou probíhá na zabezpečené stránce Stripe, která používá vlastní nezbytné cookies. Videa se přehrávají v režimu bez sledování (YouTube nocookie, Vimeo „Do Not Track“). Analytické ani marketingové cookies nepoužíváme.'),
    'Poskytovatel hostingu a databáze, banka (platby převodem), služby pro odesílání e-mailů, SMS a WhatsApp zpráv.',
    'Poskytovatel hostingu a databáze, banka (platby převodem), platební brána Stripe (platby kartou), Cloudflare (ochrana formulářů před roboty), služby pro odesílání e-mailů, SMS a WhatsApp zpráv.'),
  "updated_at" = now()
WHERE "key" = 'privacy.body';
