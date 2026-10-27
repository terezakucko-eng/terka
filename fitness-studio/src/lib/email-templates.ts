import "server-only";
import { like } from "drizzle-orm";
import { site } from "@/config/site";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { content } from "@/db/schema";
import { sendMail } from "./mail";

/**
 * Automatic e-mails the system sends. Admin → E-maily shows and edits them;
 * edits live in the content table under `emails.<id>.subject|body`, a missing
 * key means the default below. {{…}} are filled when the e-mail goes out.
 */
export type EmailDef = {
  title: string;
  /** When it goes out – shown to the admin. */
  when: string;
  subject: string;
  body: string;
  /** Placeholders specific to this e-mail, with a sample value for the preview. */
  vars: Record<string, { label: string; sample: string }>;
};

const osloveni = { label: "oslovení v 5. pádě (Terezo)", sample: "Terezo" };
const lekce = { label: "lekce a termín", sample: "Reformer – úterý 7. 10. v 18:00" };

export const EMAILS = {
  welcome: {
    title: "Vítej po registraci",
    when: "Hned po založení účtu na webu.",
    subject: "Vítej v OCTOPUSH!",
    body: "Ahoj {{osloveni}},\n\ndíky za registraci. Každý má svou cestu.\nNa účtu tě čeká úvodní lekce zdarma – vyber si ji v rozvrhu: {{odkaz}}\n\nUlož si do mobilu členskou kartu – na recepci pak stačí ukázat QR kód: {{karta}}",
    vars: {
      osloveni,
      odkaz: { label: "odkaz na rozvrh", sample: `${site.url}/rozvrh` },
      karta: { label: "odkaz na členskou kartu", sample: `${site.url}/ucet/karta` },
    },
  },
  welcomePassCard: {
    title: "Vítej po registraci s kartičkou Pošli to dál",
    when: "Hned po založení účtu přes kartičku Pošli to dál (místo běžného uvítání).",
    subject: "Vítej v OCTOPUSH! Lekce zdarma je tvoje 💛",
    body: "Ahoj {{osloveni}},\n\ndíky za registraci – k nám tě přivedla kartička Pošli to dál 💛\nNa účtu tě čeká lekce zdarma, platí do {{platnost}}. Vyber si ji v rozvrhu a u rezervace zaplať „Kartičkou Pošli to dál“: {{odkaz}}\n\nKartičku můžeš předat dál hned – jestli na ní zbývá místo pro kamarádku, uvidíš v účtu: {{ucet}}\n\nUlož si do mobilu členskou kartu – na recepci pak stačí ukázat QR kód: {{karta}}",
    vars: {
      osloveni,
      platnost: { label: "do kdy lekce zdarma platí", sample: "4. 11. 2026" },
      odkaz: { label: "odkaz na rozvrh", sample: `${site.url}/rozvrh` },
      ucet: { label: "odkaz na kartičku v účtu", sample: `${site.url}/ucet#posli-to-dal` },
      karta: { label: "odkaz na členskou kartu", sample: `${site.url}/ucet/karta` },
    },
  },
  passwordReset: {
    title: "Obnovení hesla",
    when: "Když klient klikne na „Zapomenuté heslo“.",
    subject: "Obnovení hesla",
    body: "Ahoj {{osloveni}},\n\nnové heslo si nastavíš zde (odkaz platí 1 hodinu):\n{{odkaz}}\n\nPokud jsi o změnu nežádal/a, e-mail ignoruj.",
    vars: { osloveni, odkaz: { label: "odkaz pro nastavení hesla", sample: `${site.url}/obnova-hesla?token=…` } },
  },
  studioAccount: {
    title: "Účet založený studiem",
    when: "Když v Klientech založíš nový účet a necháš zaškrtnuté „Poslat pozvánku“ (nebo ji pošleš znovu z detailu klienta).",
    subject: "OCTOPUSH: máš u nás účet",
    body: "Ahoj {{osloveni}},\n\nzaložili jsme ti účet v OCTOPUSH – rezervace lekcí, permanentky i kredit tam máš na jednom místě.\n\n1. Nastav si heslo (odkaz platí 14 dní):\n{{odkaz}}\n\n2. Web tě pak přesune do profilu – zaškrtni, jaké zprávy od nás chceš dostávat (novinky e-mailem, SMS nebo WhatsApp, připomínky lekcí), a ulož.\n\nPřihlašuješ se e-mailem {{prihlaseni}}.\n\nTěšíme se na tebe!",
    vars: {
      osloveni,
      odkaz: { label: "odkaz pro nastavení hesla", sample: `${site.url}/obnova-hesla?token=…` },
      prihlaseni: { label: "e-mail klienta", sample: "tereza@example.cz" },
    },
  },
  invite: {
    title: "Pozvánka převedeným klientům",
    when: "Když v Importu klientů klikneš na „Poslat pozvánky“.",
    subject: "OCTOPUSH: tvůj účet v novém rezervačním systému",
    body: "Ahoj {{osloveni}},\n\nspouštíme nový web a rezervace OCTOPUSH. Tvůj účet jsme převedli – včetně kreditu a permanentek.\n\nStačí si nastavit heslo (odkaz platí 14 dní):\n{{odkaz}}\n\nPak se přihlásíš e-mailem {{prihlaseni}} a můžeš rezervovat.\n\nTěšíme se na tebe!",
    vars: {
      osloveni,
      odkaz: { label: "odkaz pro nastavení hesla", sample: `${site.url}/obnova-hesla?token=…` },
      prihlaseni: { label: "e-mail klienta", sample: "tereza@example.cz" },
    },
  },
  booked: {
    title: "Rezervace lekce potvrzena",
    when: "Po rezervaci lekce; u jednorázového vstupu až po zaplacení (kartou hned, převodem když ho v Platbách označíš jako zaplacený). S doplatkem přijde vždy – i klientům, kteří mají e-maily o rezervacích vypnuté.",
    subject: "Rezervace potvrzena: {{lekce}}",
    body: "Ahoj {{osloveni}},\n\nmáš místo na lekci {{lekce}}.\n{{kamaradka}}\n{{doplatek}}Detail a případné storno: {{odkaz}}\nPřidat do kalendáře: {{kalendar}}\n\nTěšíme se!",
    vars: {
      osloveni,
      lekce,
      kamaradka: { label: "řádek o kamarádce (+1), jinak prázdné", sample: "Rezervovali jsme i místo pro kamarádku: Jana." },
      doplatek: { label: "výzva k doplatku s VS a odkazem na platbu (členství/permanentka), jinak prázdné", sample: "K lekci patří doplatek 100 Kč – na místě se neplatí. Zaplať ho prosím kartou nebo převodem (VS 1095): …\n" },
      odkaz: { label: "odkaz na lekci", sample: `${site.url}/rozvrh/…` },
      kalendar: { label: "odkaz na přidání lekce do kalendáře (.ics)", sample: `${site.url}/api/kalendar/lekce/…` },
    },
  },
  bookedPending: {
    title: "Jednorázový vstup čeká na platbu",
    when: "Po rezervaci jednorázového vstupu s platbou převodem. Místo se potvrdí až po zaplacení.",
    subject: "Dokonči platbu: {{lekce}}",
    body: "Ahoj {{osloveni}},\n\nrezervace na lekci {{lekce}} čeká na platbu {{castka}}. Je nutné ji uhradit do {{platnost}}. Místo potvrdíme, jakmile platba dorazí.\n\nÚčet: {{ucet}}\nVariabilní symbol: {{vs}}\nQR kód k platbě: {{odkaz}}\n\nKdyž platba nedorazí, z lekce tě odhlásíme a místo uvolníme pro ostatní.",
    vars: {
      osloveni,
      lekce,
      platnost: { label: "do kdy zaplatit (24 h od rezervace)", sample: "středa 22. 10. v 15:00" },
      castka: { label: "částka", sample: "250 Kč" },
      ucet: { label: "číslo účtu", sample: "123456789/0800" },
      vs: { label: "variabilní symbol", sample: "1042" },
      odkaz: { label: "odkaz na QR platbu", sample: `${site.url}/platba/prevod?order=…` },
    },
  },
  dropInLapsed: {
    title: "Rezervace propadla – platba nedorazila",
    when: "Když platba převodem za jednorázový vstup nedorazí včas a místo se uvolní.",
    subject: "Rezervace propadla: {{lekce}}",
    body: "Ahoj {{osloveni}},\n\nplatba za lekci {{lekce}} (splatná do {{platnost}}) k nám nedorazila, takže jsme tě z lekce odhlásili a místo uvolnili pro ostatní.\n\nPokud je platba už na cestě, nevadí – když bude na lekci volno, místo ti vrátíme, jinak dostaneš částku jako kredit.\nRozvrh: {{odkaz}}",
    vars: {
      osloveni,
      lekce,
      platnost: { label: "do kdy měla platba dorazit", sample: "středa 22. 10. v 15:00" },
      odkaz: { label: "odkaz na rozvrh", sample: `${site.url}/rozvrh` },
    },
  },
  dropInLate: {
    title: "Platba dorazila pozdě – vráceno jako kredit",
    when: "Když platba dorazí, až rezervace už neplatí (propadla, byla zrušená nebo je lekce plná) – i za doplatek.",
    subject: "Platba dorazila – vrátili jsme ji jako kredit",
    body: "Ahoj {{osloveni}},\n\ntvoje platba za {{lekce}} dorazila, ale rezervace už neplatí (byla zrušená, propadla, nebo je lekce plná). Vrátili jsme ti ji jako kredit ({{kredit}}) – můžeš s ním zaplatit jinou lekci.\nRozvrh: {{odkaz}}",
    vars: {
      osloveni,
      lekce,
      kredit: { label: "vrácený kredit", sample: "250 kreditů" },
      odkaz: { label: "odkaz na rozvrh", sample: `${site.url}/rozvrh` },
    },
  },
  cancelled: {
    title: "Rezervace lekce zrušena",
    when: "Když klient zruší rezervaci.",
    subject: "Rezervace zrušena: {{lekce}}",
    body: "Ahoj {{osloveni}},\n\ntvoje rezervace na {{lekce}} byla zrušena.\n{{vraceni}}",
    vars: {
      osloveni,
      lekce,
      vraceni: { label: "věta o vrácení vstupu (nebo že propadá)", sample: "Vstup/kredit ti vracíme na účet." },
    },
  },
  promoted: {
    title: "Místo z pořadníku",
    when: "Když se uvolní místo a klient se z pořadníku dostane na lekci.",
    subject: "Uvolnilo se místo! {{lekce}}",
    body: "Ahoj {{osloveni}},\n\nz pořadníku ses dostal/a na lekci {{lekce}}. Rezervace je potvrzená.\n{{doplatek}}Kdybys nemohl/a, zruš ji prosím: {{odkaz}}",
    vars: {
      osloveni,
      lekce,
      doplatek: { label: "výzva k doplatku s VS a odkazem na platbu, jinak prázdné", sample: "K lekci patří doplatek 100 Kč – na místě se neplatí. Zaplať ho prosím kartou nebo převodem (VS 1095): …\n" },
      odkaz: { label: "odkaz na lekci", sample: `${site.url}/rozvrh/…` },
    },
  },
  sessionCancelled: {
    title: "Lekce se nekoná",
    when: "Když v Rozvrhu zrušíš lekci – jde všem přihlášeným.",
    subject: "Lekce zrušena: {{lekce}}",
    body: "Ahoj {{osloveni}},\n\nomlouváme se, lekce {{lekce}} se nekoná. {{vraceni}}\nVyber si jinou lekci: {{odkaz}}",
    vars: {
      osloveni,
      lekce,
      vraceni: { label: "co se vrací (vstup/kredit, u nezaplacené rezervace: platbu neposílej)", sample: "Vstup/kredit jsme ti vrátili na účet." },
      odkaz: { label: "odkaz na rozvrh", sample: `${site.url}/rozvrh` },
    },
  },
  paymentReminder: {
    title: "Připomínka platby",
    when: "Když v adminu u nezaplacené rezervace (jednorázový vstup nebo doplatek) klikneš na Připomenout platbu – a jednou automaticky u nezaplacených rezervací z doby před platbou předem. Přijde i klientům, kteří mají e-maily o rezervacích vypnuté.",
    subject: "Připomínka platby – {{lekce}}",
    body: "Ahoj {{osloveni}},\n\nještě nám chybí {{co}} {{lekce}} ({{castka}}).{{termin}}\n\nZaplatit můžeš tady: {{odkaz}}\n\nPokud už je zaplaceno nebo je platba na cestě, děkujeme – kdyžtak nám napiš a platbu dohledáme.",
    vars: {
      osloveni,
      co: { label: "co chybí (platba za lekci / doplatek k lekci)", sample: "platba za lekci" },
      lekce,
      castka: { label: "částka a variabilní symbol", sample: "250 Kč, VS 1088" },
      termin: { label: "do kdy zaplatit (u převodu)", sample: " Zaplať ji prosím do úterý 7. 10. v 10:00, jinak se místo uvolní pro ostatní." },
      odkaz: { label: "odkaz na platbu (QR a číslo účtu, u doplatku stránka lekce)", sample: `${site.url}/platba/prevod` },
    },
  },
  sessionMoved: {
    title: "Lekce má nový čas",
    when: "Když v Rozvrhu změníš lekci čas nebo den – jde všem přihlášeným i z pořadníku.",
    subject: "Změna času: {{lekce}}",
    body: "Ahoj {{osloveni}},\n\nlekce se přesouvá na nový čas: {{lekce}} (původně {{puvodne}}). Rezervace ti zůstává.\nKdyž ti nový čas nevyhovuje, zruš ji prosím, ať místo dostane někdo další – nebo nám napiš: {{odkaz}}",
    vars: {
      osloveni,
      lekce,
      puvodne: { label: "původní den a čas", sample: "úterý 7. 10. v 18:00" },
      odkaz: { label: "odkaz na lekci", sample: `${site.url}/rozvrh` },
    },
  },
  reminderClass: {
    title: "Připomínka lekce",
    when: "3 hodiny před lekcí – jen klientům, kteří si připomínky zapnuli.",
    subject: "Za chvíli: {{lekce}} v {{cas}}",
    body: "Ahoj {{osloveni}},\n\npřipomínáme dnešní lekci {{lekce}} – {{den}} v {{cas}}.\n\nKdyby ses nakonec nemohl/a dostavit, zruš prosím rezervaci, ať se místo uvolní dalším: {{odkaz}}\n\nTěšíme se!",
    vars: {
      osloveni,
      lekce: { label: "název lekce", sample: "Reformer" },
      den: { label: "den", sample: "úterý 7. 10." },
      cas: { label: "čas", sample: "18:00" },
      odkaz: { label: "odkaz na lekci", sample: `${site.url}/rozvrh/…` },
    },
  },
  reminderMassage: {
    title: "Připomínka masáže",
    when: "3 hodiny před masáží – jen klientům, kteří si připomínky zapnuli.",
    subject: "Za chvíli: {{masaz}} v {{cas}}",
    body: "Ahoj {{osloveni}},\n\npřipomínáme dnešní masáž {{masaz}} – {{den}} v {{cas}}.\n\nDetail a případné zrušení: {{odkaz}}\n\nTěšíme se!",
    vars: {
      osloveni,
      masaz: { label: "název masáže", sample: "Relaxační masáž" },
      den: { label: "den", sample: "úterý 7. 10." },
      cas: { label: "čas", sample: "10:00" },
      odkaz: { label: "odkaz na rezervaci", sample: `${site.url}/masaze/rezervace/…` },
    },
  },
  massageBooked: {
    title: "Masáž potvrzena",
    when: "Po rezervaci masáže.",
    subject: "Masáž potvrzena: {{termin}}",
    body: "Ahoj {{osloveni}},\n\ntěšíme se na tebe – {{masaz}}, {{termin}}.\n{{platba}}\n\nDetail a případné zrušení: {{odkaz}}",
    vars: {
      osloveni,
      masaz: { label: "název masáže", sample: "Relaxační masáž" },
      termin: { label: "den a čas", sample: "úterý 7. 10. v 10:00" },
      platba: { label: "informace o platbě", sample: "Cena: 700 Kč. Zaplatit můžeš kartou v detailu rezervace nebo převodem." },
      odkaz: { label: "odkaz na rezervaci", sample: `${site.url}/masaze/rezervace/…` },
    },
  },
  massageCancelled: {
    title: "Masáž zrušena",
    when: "Když klient nebo studio zruší masáž.",
    subject: "Masáž zrušena: {{termin}}",
    body: "Ahoj {{osloveni}},\n\n{{kdo_zrusil}} tvoji masáž {{masaz}}, {{termin}}.\n{{vraceni}}\n\nNový termín si můžeš vybrat na {{odkaz}}",
    vars: {
      osloveni,
      masaz: { label: "název masáže", sample: "Relaxační masáž" },
      termin: { label: "den a čas", sample: "úterý 7. 10. v 10:00" },
      kdo_zrusil: { label: "„zrušili jsme“ / „musíme bohužel zrušit“", sample: "zrušili jsme" },
      vraceni: { label: "věta o vrácení peněz (jen u zaplacené)", sample: "Zaplacenou částku ti vrátíme." },
      odkaz: { label: "odkaz na masáže", sample: `${site.url}/masaze` },
    },
  },
  creditExpiry: {
    title: "Kredit brzy propadne",
    when: "Pár dní předtím, než klientovi propadne kredit.",
    subject: "Tvůj kredit brzy propadne",
    body: "Ahoj {{osloveni}},\n\nna účtu máš {{kredit}} kreditů, které platí do {{platnost}}. Využij je na lekci, nebo si kredit dobij – každé dobití prodlouží platnost celého zůstatku.\n\nRozvrh: {{odkaz}}",
    vars: {
      osloveni,
      kredit: { label: "počet kreditů", sample: "5" },
      platnost: { label: "datum", sample: "31. 10. 2026" },
      odkaz: { label: "odkaz na rozvrh", sample: `${site.url}/rozvrh` },
    },
  },
  freeEntryWeek: {
    title: "Lekce zdarma – zbývá týden",
    when: "Týden předtím, než klientovi vyprší nevyužitá lekce zdarma (úvodní, k narozeninám, za pozvání…).",
    subject: "Nezapomeň na svou lekci zdarma",
    body: "Ahoj {{osloveni}},\n\nna účtu tě pořád čeká {{nazev}} – platí do {{platnost}}. Vyber si v rozvrhu lekci, na kterou máš chuť, a přijď si ji užít.\n\nRozvrh: {{odkaz}}\n\nTěšíme se na tebe!",
    vars: {
      osloveni,
      nazev: { label: "co klient má (název, u více vstupů i počet)", sample: "Úvodní lekce zdarma" },
      platnost: { label: "do kdy platí", sample: "31. 10. 2026" },
      odkaz: { label: "odkaz na rozvrh", sample: `${site.url}/rozvrh` },
    },
  },
  freeEntryLastCall: {
    title: "Lekce zdarma – poslední den",
    when: "Den předtím, než klientovi vyprší nevyužitá lekce zdarma.",
    subject: "Poslední šance: lekce zdarma platí do {{platnost}}",
    body: "Ahoj {{osloveni}},\n\n{{nazev}} ti vyprší {{platnost}}. Pokud ji chceš využít, přihlas se ještě dnes na lekci v rozvrhu: {{odkaz}}\n\nKdyby ti to teď nevycházelo, ozvi se nám – domluvíme se.",
    vars: {
      osloveni,
      nazev: { label: "co klient má (název, u více vstupů i počet)", sample: "Úvodní lekce zdarma" },
      platnost: { label: "kdy vyprší", sample: "31. 10. 2026" },
      odkaz: { label: "odkaz na rozvrh", sample: `${site.url}/rozvrh` },
    },
  },
  strikeWarning: {
    title: "Členství – varování před pauzou",
    when: "Když se člen po pozdním odhlášení nebo nepříchodu dostane jeden prohřešek před pauzu (Nastavení).",
    subject: "Pozor na pozdní odhlašování",
    body: "Ahoj {{osloveni}},\n\nza posledních {{dni}} dní máš {{pocet}}× pozdní odhlášení nebo nepříchod na lekci. Místo, které zůstane prázdné, by jinak mohl využít někdo z pořadníku.\n\nPři {{limit}}. prohřešku se na {{pauza_dni}} dní pozastaví přihlašování na lekce. Když nemůžeš dorazit, odhlas se prosím včas – nejpozději {{storno_hodin}} h před lekcí{{storno_vyjimky}}.\n\nDíky za pochopení!",
    vars: {
      osloveni,
      pocet: { label: "počet prohřešků", sample: "2" },
      limit: { label: "kolikátý prohřešek vede k pauze", sample: "3" },
      dni: { label: "za kolik dní se počítají", sample: "30" },
      pauza_dni: { label: "délka pauzy (dní)", sample: "7" },
    },
  },
  strikePause: {
    title: "Členství – pauza v přihlašování",
    when: "Když člen dosáhne limitu pozdních odhlášení/nepříchodů (Nastavení).",
    subject: "Přihlašování na lekce je pozastavené do {{do}}",
    body: "Ahoj {{osloveni}},\n\nkvůli opakovanému pozdnímu odhlášení nebo nepříchodu je tvoje přihlašování na lekce na {{pauza_dni}} dní pozastavené – znovu se přihlásíš od {{do}}. Na lekce, na které už jsi přihlášený/á, chodit můžeš.\n\nKdyby šlo o omyl, napiš nám na {{email}}.",
    vars: {
      osloveni,
      do: { label: "datum konce pauzy", sample: "5. 10. 2026" },
      pauza_dni: { label: "délka pauzy (dní)", sample: "7" },
    },
  },
  membershipFee: {
    title: "Členský příspěvek – výzva k platbě",
    when: "Automaticky v nastavený den (výchozí 20.) za následující měsíc, nebo když v Příspěvcích klikneš na Výzva / Připomenout.",
    subject: "Členský příspěvek za {{mesic}}",
    body: "Ahoj {{osloveni}},\n\nposíláme platbu členského příspěvku za {{mesic}}: {{castka}}.\n\nÚčet: {{ucet}}\nVariabilní symbol: {{vs}}\n\nQR kód k platbě, případně platbu kartou najdeš tady: {{odkaz}}\n\nDěkujeme, že jsi s námi!",
    vars: {
      osloveni,
      mesic: { label: "měsíc", sample: "listopad 2026" },
      castka: { label: "částka", sample: "1 400 Kč" },
      ucet: { label: "číslo účtu", sample: "123456789/0800" },
      vs: { label: "variabilní symbol", sample: "1042" },
      odkaz: { label: "odkaz na platbu", sample: `${site.url}/platba/prevod?order=…` },
    },
  },
  wishReply: {
    title: "Odpověď ze Schránky přání a nápadů",
    when: "Když v Administrace → Schránka odpovíš na vzkaz klienta.",
    subject: "Odpověď na tvůj vzkaz 💌",
    body: "Ahoj {{osloveni}},\n\nděkujeme za tvůj vzkaz ve Schránce přání a nápadů:\n„{{vzkaz}}“\n\nNaše odpověď:\n{{odpoved}}\n\nVšechny své vzkazy najdeš tady: {{odkaz}}",
    vars: {
      osloveni,
      vzkaz: { label: "vzkaz klienta", sample: "Bylo by super mít lekci i v sobotu ráno." },
      odpoved: { label: "odpověď studia", sample: "Díky za tip! Od listopadu zkusíme sobotní ranní lekci." },
      odkaz: { label: "odkaz na schránku v účtu", sample: `${site.url}/ucet/schranka` },
    },
  },
  birthday: {
    title: "Přání k narozeninám",
    when: "V den narozenin dopoledne – klientům s vyplněným datem narození (Nastavení → Přání a dárky).",
    subject: "Všechno nejlepší, {{osloveni}}! 🎂",
    body: "Ahoj {{osloveni}},\n\nvšechno nejlepší k narozeninám! 🎂 Ať tě tělo nese, hlava je v klidu a radost z pohybu tě neopouští.\n\n{{darek}}\n\nTvoje OCTOPUSH 🐙",
    vars: {
      osloveni,
      darek: {
        label: "řádek o dárku (lekce zdarma), jinak prázdné",
        sample: `Na účtu máš od nás dárek – lekci zdarma, platí do 12. 11. 2026. Vyber si ji v rozvrhu: ${site.url}/rozvrh`,
      },
    },
  },
  nameDay: {
    title: "Přání k svátku",
    when: "V den svátku dopoledne – klientům s vyplněným svátkem (když nemají zrovna narozeniny).",
    subject: "Krásný svátek, {{osloveni}}! 🌷",
    body: "Ahoj {{osloveni}},\n\npřejeme ti krásný svátek! 🌷 Ať je dnešek plný radosti – a třeba i pohybu.\n\nTvoje OCTOPUSH 🐙",
    vars: { osloveni },
  },
  winback: {
    title: "Chybíš nám",
    when: "Dopoledne, když klient nebyl na lekci (Nastavení → Přání a dárky) a nic nemá rezervováno. Jen se souhlasem s novinkami, jednou za pauzu.",
    subject: "{{osloveni}}, chybíš nám 🐙",
    body: "Ahoj {{osloveni}},\n\nod tvé poslední lekce u nás uběhlo pár týdnů a trochu se nám po tobě stýská. 🐙\nMrkni do rozvrhu, třeba tě něco naláká: {{odkaz}}\n\nTěšíme se na tebe!\n\nE-maily o novinkách si můžeš kdykoli odhlásit: {{odhlasit}}",
    vars: {
      osloveni,
      odkaz: { label: "odkaz na rozvrh", sample: `${site.url}/rozvrh` },
      odhlasit: { label: "odkaz na odhlášení novinek", sample: `${site.url}/o/…` },
    },
  },
  referralReward: {
    title: "Odměna za pozvání kamarádky",
    when: "Když kamarádka pozvaná přes osobní odkaz poprvé něco zaplatí (do čtvrt hodiny).",
    subject: "Díky za pozvání, {{osloveni}}! 💛",
    body: "Ahoj {{osloveni}},\n\n{{kamaradka}} u nás má za sebou první nákup – díky za pozvání! 💛\nJako poděkování máš na účtu lekci zdarma, platí do {{platnost}}. Vyber si ji v rozvrhu: {{odkaz}}\n\nTvoje OCTOPUSH 🐙",
    vars: {
      osloveni,
      kamaradka: { label: "jméno pozvané kamarádky", sample: "Jana" },
      platnost: { label: "do kdy platí lekce zdarma", sample: "12. 12. 2026" },
      odkaz: { label: "odkaz na rozvrh", sample: `${site.url}/rozvrh` },
    },
  },
  voucherReady: {
    title: "Dárkový poukaz zaplacen",
    when: "Když je dárkový poukaz koupený na webu zaplacený (do čtvrt hodiny).",
    subject: "Tvůj dárkový poukaz je připravený 🎁",
    body: "Ahoj {{osloveni}},\n\ndíky za nákup! Dárkový poukaz „{{poukaz}}“ je zaplacený a připravený k darování.\nStáhni si ho (PDF k vytištění nebo poslání): {{odkaz}}\n\nKód poukazu: {{kod}} · platí do {{platnost}}\nObdarovaná osoba ho uplatní na {{uplatneni}}\n\nTvoje OCTOPUSH 🐙",
    vars: {
      osloveni,
      poukaz: { label: "co poukaz obsahuje", sample: "Permanentka 10 vstupů" },
      odkaz: { label: "odkaz na stažení poukazu (PDF)", sample: `${site.url}/api/poukaz/…` },
      kod: { label: "kód poukazu", sample: "7KQ4-M2PX" },
      platnost: { label: "do kdy poukaz platí", sample: "13. 10. 2027" },
      uplatneni: { label: "odkaz na uplatnění", sample: `${site.url}/poukaz` },
    },
  },
  signature: {
    title: "Podpis pod každým e-mailem",
    when: "Připojí se na konec všech automatických e-mailů (hromadné zprávy mají vlastní patičku).",
    subject: "",
    body: "—\nOCTOPUSH · Každý má svou cestu.\n{{web}}",
    vars: {},
  },
} satisfies Record<string, EmailDef>;

export type EmailId = keyof typeof EMAILS;

/** Placeholders available in every e-mail. */
export const COMMON_VARS: Record<string, string> = {
  web: "adresa webu",
  firma: "provozovatel",
  email: "e-mail studia",
  telefon: "telefon studia",
  adresa: "adresa studia",
  storno_hodin: "storno zdarma (hodin před lekcí)",
  storno_vyjimky: "lekce s jinou lhůtou pro storno, např. „ (u lekcí Reformer fusion a Fitness brunch 24 h)“",
};

/** Saved texts (subject/body) per e-mail; missing = default. */
export async function savedEmailTexts() {
  const rows = await (await getDb()).select().from(content).where(like(content.key, "emails.%"));
  return new Map(rows.map((r) => [r.key, r.value]));
}

export const emailKey = (id: EmailId, part: "subject" | "body") => `emails.${id}.${part}`;

function fill(text: string, vars: Record<string, string>, common: (t: string, v: Record<string, string>) => string) {
  return common(text, vars)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Pure part of renderEmail: template (saved or default) + placeholders → subject and text. */
export function composeEmail(
  id: EmailId,
  vars: Record<string, string>,
  saved: Map<string, string>,
  common: (t: string, v: Record<string, string>) => string,
) {
  const def: EmailDef = EMAILS[id];
  const subject = fill(saved.get(emailKey(id, "subject")) ?? def.subject, vars, common).replace(/\s+/g, " ");
  const body = fill(saved.get(emailKey(id, "body")) ?? def.body, vars, common);
  const signature = fill(saved.get(emailKey("signature", "body")) ?? EMAILS.signature.body, {}, common);
  return { subject, text: signature ? `${body}\n\n${signature}` : body };
}

/** Builds the subject and text of an e-mail from the (possibly edited) template. */
export async function renderEmail(id: EmailId, vars: Record<string, string>, saved?: Map<string, string>) {
  const c = await getContent();
  return composeEmail(id, vars, saved ?? (await savedEmailTexts()), (t, v) => c.fill(t, { web: site.url, ...v }));
}

/** Sample values for the admin preview. */
export const sampleVars = (id: EmailId) =>
  Object.fromEntries(Object.entries(EMAILS[id].vars as EmailDef["vars"]).map(([k, v]) => [k, v.sample]));


/** Sends one of the automatic e-mails. Never throws (see sendMail). */
export async function sendEmail(to: string, id: EmailId, vars: Record<string, string>) {
  await sendMail({ to, ...(await renderEmail(id, vars)) });
}
