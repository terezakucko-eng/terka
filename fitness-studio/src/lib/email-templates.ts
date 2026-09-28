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
    body: "Ahoj {{osloveni}},\n\ndíky za registraci. Každý má svou cestu.\nNa účtu tě čeká úvodní lekce zdarma – vyber si ji v rozvrhu: {{odkaz}}",
    vars: { osloveni, odkaz: { label: "odkaz na rozvrh", sample: `${site.url}/rozvrh` } },
  },
  passwordReset: {
    title: "Obnovení hesla",
    when: "Když klient klikne na „Zapomenuté heslo“.",
    subject: "Obnovení hesla",
    body: "Ahoj {{osloveni}},\n\nnové heslo si nastavíš zde (odkaz platí 1 hodinu):\n{{odkaz}}\n\nPokud jsi o změnu nežádal/a, e-mail ignoruj.",
    vars: { osloveni, odkaz: { label: "odkaz pro nastavení hesla", sample: `${site.url}/obnova-hesla?token=…` } },
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
    when: "Po rezervaci lekce (u platby převodem hned, u karty po zaplacení).",
    subject: "Rezervace potvrzena: {{lekce}}",
    body: "Ahoj {{osloveni}},\n\nmáš místo na lekci {{lekce}}.\n{{kamaradka}}\nDetail a případné storno: {{odkaz}}\n\nTěšíme se!",
    vars: {
      osloveni,
      lekce,
      kamaradka: { label: "řádek o kamarádce (+1), jinak prázdné", sample: "Rezervovali jsme i místo pro kamarádku: Jana." },
      odkaz: { label: "odkaz na lekci", sample: `${site.url}/rozvrh/…` },
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
    body: "Ahoj {{osloveni}},\n\nz pořadníku ses dostal/a na lekci {{lekce}}. Rezervace je potvrzená.\nKdybys nemohl/a, zruš ji prosím: {{odkaz}}",
    vars: { osloveni, lekce, odkaz: { label: "odkaz na lekci", sample: `${site.url}/rozvrh/…` } },
  },
  sessionCancelled: {
    title: "Lekce se nekoná",
    when: "Když v Rozvrhu zrušíš lekci – jde všem přihlášeným.",
    subject: "Lekce zrušena: {{lekce}}",
    body: "Ahoj {{osloveni}},\n\nomlouváme se, lekce {{lekce}} se nekoná. Vstup/kredit jsme ti vrátili na účet.\nVyber si jinou lekci: {{odkaz}}",
    vars: { osloveni, lekce, odkaz: { label: "odkaz na rozvrh", sample: `${site.url}/rozvrh` } },
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
  strikeWarning: {
    title: "Členství – varování před pauzou",
    when: "Když se člen po pozdním odhlášení nebo nepříchodu dostane jeden prohřešek před pauzu (Nastavení).",
    subject: "Pozor na pozdní odhlašování",
    body: "Ahoj {{osloveni}},\n\nza posledních {{dni}} dní máš {{pocet}}× pozdní odhlášení nebo nepříchod na lekci. Místo, které zůstane prázdné, by jinak mohl využít někdo z pořadníku.\n\nPři {{limit}}. prohřešku se na {{pauza_dni}} dní pozastaví přihlašování na lekce. Když nemůžeš dorazit, odhlas se prosím včas – nejpozději {{storno_hodin}} h před lekcí.\n\nDíky za pochopení!",
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
