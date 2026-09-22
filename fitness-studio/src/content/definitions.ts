/**
 * Every editable text and image on the website, with its default.
 * Admin → Obsah webu edits these; a key missing in the DB shows the default.
 *
 * Placeholders usable in any text: {{storno_hodin}}, {{rezervace_dni}},
 * {{platba_minut}}, {{vstupy_zdarma}}, {{platnost_zdarma}}, {{firma}}, {{ico}},
 * {{adresa}}, {{email}}, {{telefon}}.
 */

export type FieldType = "text" | "textarea" | "richtext" | "image" | "url";

export type FieldDef = {
  label: string;
  type: FieldType;
  default: string;
  hint?: string;
};

export type SectionDef = {
  title: string;
  /** Page the section appears on (for the "Upravit tuto stránku" button). */
  page: string;
  fields: Record<string, FieldDef>;
};

const t = (label: string, def: string, hint?: string): FieldDef => ({ label, type: "text", default: def, hint });
const ta = (label: string, def: string, hint?: string): FieldDef => ({ label, type: "textarea", default: def, hint });
const rich = (label: string, def: string): FieldDef => ({
  label,
  type: "richtext",
  default: def,
  hint: "## Nadpis · - odrážka · **tučně** · prázdný řádek = nový odstavec · odkazy se vytvoří samy",
});
const img = (label: string, def: string): FieldDef => ({ label, type: "image", default: def });
const url = (label: string, def: string): FieldDef => ({ label, type: "url", default: def });

const value = (n: number, title: string, sub: string) => ({
  [`v${n}Title`]: t(`Hodnota ${n} – název`, title),
  [`v${n}Sub`]: t(`Hodnota ${n} – podtitul`, sub),
});

export const SECTIONS = {
  site: {
    title: "Kontakty a značka",
    page: "*",
    fields: {
      tagline: t("Claim (tagline)", "Každý má svou cestu."),
      claim: t("Psaný claim", "More life. Better humans."),
      description: ta(
        "Popis webu pro Google a sdílení",
        "Studio pohybu a rovnováhy. Tanec, pilates, silový trénink a komunita lidí, kteří jdou svou cestou. Rezervuj si lekci online během pár vteřin.",
      ),
      pillars: t("Pilíře (patička)", "Pohyb · Lidé · Příroda · Harmonie"),
      email: t("E-mail", "ahoj@octopush.fit"),
      phone: t("Telefon", "+420 777 000 000"),
      street: t("Ulice a číslo", "Doplňte ulici 123"),
      zip: t("PSČ", "700 30"),
      city: t("Město", "Ostrava"),
      mapUrl: url("Odkaz na mapu", "https://maps.google.com/?q=Ostrava"),
      companyName: t("Provozovatel (firma)", "OCTOPUSH s.r.o."),
      ico: t("IČO", "00000000"),
      instagram: url("Instagram", "https://www.instagram.com/"),
      facebook: url("Facebook", "https://www.facebook.com/"),
      whatsapp: url("WhatsApp skupina/kontakt", "", ),
    },
  },
  nav: {
    title: "Menu a patička",
    page: "*",
    fields: {
      schedule: t("Menu – Rozvrh", "Rozvrh"),
      classes: t("Menu – Lekce", "Lekce"),
      pricing: t("Menu – Ceník", "Ceník"),
      instructors: t("Menu – Lektoři", "Lektoři"),
      contact: t("Menu – Kontakt", "Kontakt"),
      book: t("Tlačítko Rezervovat", "Rezervovat"),
      footerStudio: t("Patička – nadpis kontaktů", "Studio"),
      footerLinks: t("Patička – nadpis odkazů", "Odkazy"),
    },
  },
  homeHero: {
    title: "Úvod – hlavní část",
    page: "/",
    fields: {
      eyebrow: t("Malý nadpis", "OCTOPUSH / Studio pohybu"),
      ctaPrimary: t("Hlavní tlačítko", "Rezervovat lekci"),
      ctaSecondary: t("Druhé tlačítko (nepřihlášený)", "První lekce zdarma"),
      image: img("Fotka", "/img/priroda.webp"),
      imageAlt: t("Popis fotky (pro nevidomé)", "List s kapkami rosy"),
      caption: t("Popisek fotky", "01 / Příroda"),
    },
  },
  homeCharacter: {
    title: "Úvod – charakter značky a hodnoty",
    page: "/",
    fields: {
      eyebrow: t("Malý nadpis", "02 / Charakter značky"),
      headline: t("Velký nadpis", "Síla v rovnováze."),
      side: ta("Text vpravo", "Pohyb · Lidé\nPříroda · Harmonie"),
      ...value(1, "Směr", "Tvá cesta"),
      ...value(2, "Síla", "V tvém těle"),
      ...value(3, "Zdraví", "Vitalita"),
      ...value(4, "Výživa", "Palivo"),
      ...value(5, "Komunita", "Společně"),
      ...value(6, "Energie", "Každý den"),
      ...value(7, "Rovnováha", "Tělo i mysl"),
      ...value(8, "Svoboda", "V pohybu"),
    },
  },
  homeSchedule: {
    title: "Úvod – nejbližší lekce",
    page: "/",
    fields: {
      eyebrow: t("Malý nadpis", "Nejbližší lekce"),
      title: t("Nadpis", "Vyber si svou lekci"),
      link: t("Odkaz na rozvrh", "Celý rozvrh"),
    },
  },
  homeGallery: {
    title: "Úvod – fotogalerie",
    page: "/",
    fields: {
      image1: img("Velká fotka", "/img/pohyb.webp"),
      alt1: t("Velká fotka – popis", "Pilates reformer ve studiu"),
      caption1: t("Velká fotka – popisek", "03 / Pohyb"),
      image2: img("Fotka vpravo nahoře", "/img/jidlo.webp"),
      alt2: t("Vpravo nahoře – popis", "Salát s avokádem"),
      caption2: t("Vpravo nahoře – popisek", "04 / Jídlo"),
      image3: img("Fotka vpravo dole (s claimem)", "/img/prostor.webp"),
      alt3: t("Vpravo dole – popis", "Pobřeží při západu slunce"),
      caption3: t("Vpravo dole – popisek", "05 / Prostor"),
    },
  },
  homeSteps: {
    title: "Úvod – jak to funguje",
    page: "/",
    fields: {
      eyebrow: t("Malý nadpis", "Jak to funguje"),
      title: t("Nadpis", "Tři kroky na podložku"),
      s1Title: t("Krok 1 – nadpis", "Zaregistruj se"),
      s1Text: ta("Krok 1 – text", "Účet máš za minutu – a první lekci od nás dostaneš zdarma."),
      s2Title: t("Krok 2 – nadpis", "Vyber lekci"),
      s2Text: ta(
        "Krok 2 – text",
        "V rozvrhu vidíš volná místa v reálném čase. Plno? Zapiš se do pořadníku – uvolněné místo ti automaticky přidělíme.",
      ),
      s3Title: t("Krok 3 – nadpis", "Plať, jak ti to sedí"),
      s3Text: ta(
        "Krok 3 – text",
        "Kredit, permanentka, měsíční členství nebo jednorázový vstup kartou. Storno zdarma do {{storno_hodin}} h před lekcí.",
      ),
      ctaPricing: t("Tlačítko ceník", "Ceník"),
      ctaClasses: t("Tlačítko lekce", "Typy lekcí"),
    },
  },
  homeNews: {
    title: "Úvod – aktuality",
    page: "/",
    fields: { eyebrow: t("Malý nadpis", "Aktuality") },
  },
  schedule: {
    title: "Rozvrh",
    page: "/rozvrh",
    fields: {
      eyebrow: t("Malý nadpis", "Rozvrh"),
      title: t("Nadpis", "Najdi si svou lekci."),
      intro: ta("Úvodní text", "Klikni na lekci a rezervuj. Storno zdarma v termínu, plné lekce mají pořadník."),
      empty: t("Prázdný týden", "Na tento týden zatím nejsou vypsané žádné lekce."),
    },
  },
  classes: {
    title: "Lekce",
    page: "/lekce",
    fields: {
      eyebrow: t("Malý nadpis", "Lekce"),
      title: t("Nadpis", "Pohyb pro tělo i mysl."),
      intro: ta("Úvodní text", "Tanec, pilates, síla i regenerace. Vyber si podle nálady – nebo zkus všechno."),
    },
  },
  instructors: {
    title: "Lektoři",
    page: "/lektori",
    fields: {
      eyebrow: t("Malý nadpis", "Lektoři"),
      title: t("Nadpis", "Lidé, kteří tě povedou."),
      intro: ta("Úvodní text", "Každý z nás má svou cestu. Rádi tě kus té tvojí doprovodíme."),
    },
  },
  pricing: {
    title: "Ceník",
    page: "/cenik",
    fields: {
      eyebrow: t("Malý nadpis", "Ceník"),
      title: t("Nadpis", "Každý má svou cestu. I k ceníku."),
      intro: ta("Úvodní text", "Členství, permanentka, kredit nebo jednorázový vstup – vyber si, co sedí tvému rytmu."),
      freeEyebrow: t("Pruh „vstup zdarma“ – malý nadpis", "Vstup zdarma"),
      freeTitle: t("Pruh „vstup zdarma“ – nadpis", "První lekce je na nás."),
      freeText: ta(
        "Pruh „vstup zdarma“ – text",
        "Po registraci ti ji připíšeme na účet, platí {{platnost_zdarma}} dní. Sleduj také lekce označené „Zdarma“ v rozvrhu.",
      ),
      membershipTitle: t("Členství – nadpis", "Členství"),
      membershipText: ta("Členství – text", "Pro ty, kdo chodí pravidelně. Měsíční platba kartou, bez závazku."),
      passTitle: t("Permanentky – nadpis", "Permanentky"),
      passText: ta("Permanentky – text", "Balíček vstupů s delší platností – ideální, když chodíš nepravidelně."),
      creditTitle: t("Kredit – nadpis", "Kredit"),
      creditText: ta("Kredit – text", "Dobij si peněženku a plať kreditem za jakoukoliv lekci."),
      dropInTitle: t("Jednorázový vstup – nadpis", "Jednorázový vstup"),
      dropInText: ta("Jednorázový vstup – text", "Bez závazku – zaplatíš kartou přímo při rezervaci lekce."),
      info1Title: t("Info 1 – nadpis", "Storno"),
      info1Text: ta(
        "Info 1 – text",
        "Zdarma nejpozději {{storno_hodin}} h před začátkem lekce – vstup/kredit se vrátí na účet. Později vstup propadá.",
      ),
      info2Title: t("Info 2 – nadpis", "Pořadník"),
      info2Text: ta("Info 2 – text", "Plná lekce? Zapiš se, a když se místo uvolní, automaticky tě přihlásíme a strhneme vstup."),
      info3Title: t("Info 3 – nadpis", "Na recepci"),
      info3Text: ta("Info 3 – text", "Permanentky i kredit koupíš také hotově nebo kartou přímo ve studiu."),
    },
  },
  auth: {
    title: "Přihlášení a registrace",
    page: "/prihlaseni",
    fields: {
      image: img("Fotka vedle formuláře", "/img/pohyb.webp"),
      loginTitle: t("Přihlášení – nadpis", "Vítej zpět."),
      registerTitle: t("Registrace – nadpis", "Začni svou cestu."),
      registerText: t("Registrace – podtitul", "Po registraci máš první lekci zdarma."),
    },
  },
  terms: {
    title: "Obchodní podmínky",
    page: "/obchodni-podminky",
    fields: {
      body: rich(
        "Text",
        `## 1. Provozovatel
{{firma}}, IČO {{ico}}, {{adresa}}, e-mail {{email}}.

## 2. Rezervace lekcí
- Rezervace probíhá online přes klientský účet, nejdříve {{rezervace_dni}} dní před lekcí.
- Lekci lze zaplatit kreditem, permanentkou, členstvím, vstupem zdarma nebo jednorázově platební kartou.
- Neuhrazená rezervace jednorázového vstupu se uvolní po {{platba_minut}} minutách.

## 3. Storno podmínky
- Rezervaci lze bezplatně zrušit nejpozději {{storno_hodin}} hodin před začátkem lekce; vstup nebo kredit se vrací na účet.
- Při pozdějším zrušení nebo neúčasti vstup propadá.
- Zruší-li lekci studio, vstup se vrací vždy. Jednorázový vstup zaplacený kartou je vrácen ve formě kreditu.
- Při uvolnění místa je automaticky přihlášen klient z pořadníku a je mu stržen vstup.

## 4. Kredit, permanentky a členství
- Kredit je nepřenosný a nepropadá. 1 kredit odpovídá ceně uvedené u lekce.
- Permanentky platí po dobu uvedenou v ceníku od data nákupu.
- Členství se automaticky obnovuje každý měsíc platbou kartou. Obnovení lze kdykoliv zrušit v účtu; členství pak platí do konce zaplaceného období.

## 5. Platby
Online platby zpracovává Stripe Payments Europe, Ltd. Ceny jsou uvedeny v Kč včetně DPH (je-li provozovatel plátcem).

## 6. Odstoupení od smlouvy
Spotřebitel bere na vědomí, že dle § 1837 písm. j) občanského zákoníku nelze odstoupit od smlouvy o využití volného času, je-li plněno v určeném termínu. U permanentek a kreditu lze odstoupit do 14 dnů od nákupu, pokud nebyly čerpány.

## 7. Zdraví a bezpečnost
Klient cvičí na vlastní odpovědnost a je povinen upozornit lektora na zdravotní omezení.`,
      ),
    },
  },
  privacy: {
    title: "Ochrana osobních údajů",
    page: "/ochrana-osobnich-udaju",
    fields: {
      body: rich(
        "Text",
        `## Správce
{{firma}}, IČO {{ico}}, kontakt {{email}}.

## Jaké údaje zpracováváme a proč
- Jméno, e-mail, telefon – vedení klientského účtu a rezervací (plnění smlouvy).
- Historie rezervací a plateb – plnění smlouvy a zákonné účetní povinnosti.
- E-mail a telefon pro novinky (newsletter, SMS, WhatsApp) – pouze se souhlasem, který lze kdykoliv odvolat v profilu nebo odkazem ve zprávě.

## Příjemci
Poskytovatel hostingu a databáze, platební brána Stripe, služby pro odesílání e-mailů, SMS a WhatsApp zpráv. Údaje neprodáváme.

## Doba uložení
Po dobu trvání účtu, účetní doklady po dobu stanovenou zákonem.

## Cookies
Web používá pouze technicky nezbytnou cookie pro přihlášení. Analytické ani marketingové cookies nepoužíváme.

## Vaše práva
Máte právo na přístup, opravu, výmaz, omezení zpracování, přenositelnost a vznesení námitky, a právo podat stížnost u ÚOOÚ. Žádosti posílejte na {{email}}.`,
      ),
    },
  },
  notFound: {
    title: "Stránka nenalezena (404)",
    page: "*",
    fields: { title: t("Nadpis", "Tahle cesta nikam nevede."), button: t("Tlačítko", "Zpět na úvod") },
  },
} satisfies Record<string, SectionDef>;

export type SectionId = keyof typeof SECTIONS;
export type ContentKey = {
  [S in SectionId]: `${S}.${Extract<keyof (typeof SECTIONS)[S]["fields"], string>}`;
}[SectionId];

export function fieldDef(key: string): FieldDef | undefined {
  const [section, field] = key.split(".");
  return (SECTIONS as Record<string, SectionDef>)[section]?.fields[field];
}
