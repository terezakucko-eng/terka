/**
 * Every editable text and image on the website, with its default.
 * Admin → Obsah webu edits these; a key missing in the DB shows the default.
 *
 * Placeholders usable in any text: {{storno_hodin}}, {{prohresky}}, {{prohresky_dni}}, {{pauza_dni}}, {{rezervace_dni}}, {{rezervace_dni_clenove}}, {{rezervace_okno}}, {{rezervace_okno_clenove}},
 * {{platba_minut}}, {{vstupy_zdarma}}, {{platnost_zdarma}}, {{firma}}, {{ico}},
 * {{adresa}}, {{email}}, {{telefon}}.
 */

export type FieldType = "text" | "textarea" | "richtext" | "image" | "url";

export type FieldDef = {
  label: string;
  type: FieldType;
  default: string;
  hint?: string;
  /** May be left empty – the line then disappears from the website. */
  optional?: boolean;
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
  hint: "Formátuj tlačítky nad textem. Enter = nový odstavec, Shift+Enter = nový řádek.",
});
const OPT_HINT = "Můžeš nechat prázdné – řádek na webu zmizí.";
const opt = (label: string, def: string): FieldDef => ({ label, type: "text", default: def, hint: OPT_HINT, optional: true });
const optArea = (label: string, def: string): FieldDef => ({ label, type: "textarea", default: def, hint: OPT_HINT, optional: true });
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
      claim: opt("Claim (motto)", "More life. Better humans."),
      description: ta(
        "Popis webu pro Google a sdílení",
        "Studio pohybu a rovnováhy. Tanec, pilates, silový trénink a komunita lidí, kteří jdou svou cestou. Rezervuj si lekci online během pár vteřin.",
      ),
      pillars: opt("Pilíře (patička)", "Pohyb · Lidé · Příroda · Harmonie"),
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
  promoBar: {
    title: "Akční lišta (nahoře na webu)",
    page: "/",
    fields: {
      text: {
        label: "Text lišty",
        type: "text",
        default: "",
        optional: true,
        hint: "Např. „−20 % na první permanentku do neděle“. Prázdné = lišta se nezobrazuje.",
      },
      linkLabel: opt("Text odkazu", "Chci to"),
      linkUrl: t("Kam odkaz vede", "/cenik", "Stránka webu (/cenik, /masaze…) nebo celá adresa https://…"),
      until: {
        label: "Zobrazovat do (včetně)",
        type: "text",
        default: "",
        optional: true,
        hint: "Datum ve tvaru 2026-10-31. Po něm lišta sama zmizí. Prázdné = pořád.",
      },
    },
  },
  popup: {
    title: "Vyskakovací okno (pop-up)",
    page: "/",
    fields: {
      title: {
        label: "Nadpis",
        type: "text",
        default: "",
        optional: true,
        hint: "Prázdné = okno se nezobrazuje. Každý návštěvník ho uvidí jednou; po změně textu znovu.",
      },
      text: optArea("Text", ""),
      image: { label: "Obrázek (nepovinný)", type: "image", default: "", optional: true },
      buttonLabel: opt("Text tlačítka", "Chci to"),
      buttonUrl: t("Kam tlačítko vede", "/cenik", "Stránka webu (/cenik, /rozvrh…) nebo celá adresa https://…"),
      until: {
        label: "Zobrazovat do (včetně)",
        type: "text",
        default: "",
        optional: true,
        hint: "Datum ve tvaru 2026-10-31. Po něm okno samo zmizí. Prázdné = pořád.",
      },
    },
  },
  nav: {
    title: "Menu a patička",
    page: "*",
    fields: {
      schedule: t("Menu – Rozvrh", "Rozvrh"),
      classes: t("Menu – Lekce", "Lekce"),
      pricing: t("Menu – Ceník", "Ceník"),
      massages: t("Menu – Masáže", "Masáže"),
      board: opt("Menu – Nástěnka (prázdné = skrýt z menu)", "Nástěnka"),
      about: t("Menu – O mně", "O mně"),
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
      eyebrow: opt("Malý nadpis nad logem (prázdné = nezobrazovat)", ""),
      ctaPrimary: t("Hlavní tlačítko", "Rezervovat lekci"),
      ctaSecondary: t("Druhé tlačítko (nepřihlášený)", "První lekce zdarma"),
      image: img("Fotka", "/img/priroda.webp"),
      imageAlt: t("Popis fotky (pro nevidomé)", "List s kapkami rosy"),
      caption: opt("Popisek fotky", "01 / Příroda"),
    },
  },
  homeRebrand: {
    title: "Úvod – přechod z MOVE IN ZONE (dočasné)",
    page: "/",
    fields: {
      logo: { label: "Logo MOVE IN ZONE", type: "image", default: "", optional: true, hint: "Bez loga se ukáže jen text." },
      title: opt("Nadpis", "MOVE IN ZONE je teď OCTOPUSH"),
      text: optArea("Text", "Stejné studio, stejná lektorka i parta – mění se jen název a web. Permanentky, kredit i členství platí dál."),
      until: {
        label: "Zobrazovat do (RRRR-MM-DD)",
        type: "text",
        default: "2026-10-31",
        hint: "Po tomhle dni pruh z úvodní stránky sám zmizí. Prázdné = nezobrazovat.",
        optional: true,
      },
    },
  },
  homeCharacter: {
    title: "Úvod – charakter značky a hodnoty",
    page: "/",
    fields: {
      eyebrow: opt("Malý nadpis", "Charakter značky"),
      headline: t("Velký nadpis", "Osm chapadel OCTOPUSH."),
      lead: optArea("Věta pod nadpisem", "Každé chapadlo je jedna věc, kterou ti pohyb dává."),
      side: optArea("Text vpravo", "Pohyb · Lidé\nPříroda · Harmonie"),
      ...value(1, "Směr", "Tvá cesta"),
      ...value(2, "Síla", "V tvém těle"),
      ...value(3, "Zdraví", "Základ všeho"),
      ...value(4, "Výživa", "Co tě pohání"),
      ...value(5, "Komunita", "Držíme spolu"),
      ...value(6, "Energie", "Na celý den"),
      ...value(7, "Rovnováha", "Tělo i mysl"),
      ...value(8, "Svoboda", "Hýbej se po svém"),
    },
  },
  homeSchedule: {
    title: "Úvod – nejbližší lekce",
    page: "/",
    fields: {
      eyebrow: opt("Malý nadpis", "Nejbližší lekce"),
      title: t("Nadpis", "Vyber si svou lekci"),
      link: t("Odkaz na rozvrh", "Celý rozvrh"),
    },
  },
  homeGallery: {
    title: "Úvod – fotogalerie",
    page: "/",
    fields: {
      image1: img("Fotka 1", "/img/pohyb.webp"),
      alt1: t("Fotka 1 – popis", "Pilates reformer ve studiu"),
      caption1: opt("Fotka 1 – popisek", "Pohyb"),
      image2: img("Fotka 2", "/img/jidlo.webp"),
      alt2: t("Fotka 2 – popis", "Salát s avokádem"),
      caption2: opt("Fotka 2 – popisek", "Lidé"),
      image3: img("Fotka 3", "/img/priroda.webp"),
      alt3: t("Fotka 3 – popis", "Příroda"),
      caption3: opt("Fotka 3 – popisek", "Příroda"),
      image4: img("Fotka 4", "/img/prostor.webp"),
      alt4: t("Fotka 4 – popis", "Pobřeží při západu slunce"),
      caption4: opt("Fotka 4 – popisek", "Harmonie"),
    },
  },
  homeSteps: {
    title: "Úvod – jak to funguje",
    page: "/",
    fields: {
      eyebrow: opt("Malý nadpis", "Jak to funguje"),
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
        "Kredit, permanentka, členství nebo jednorázový vstup převodem. Storno zdarma do {{storno_hodin}} h před lekcí.",
      ),
      ctaPricing: t("Tlačítko ceník", "Ceník"),
      ctaClasses: t("Tlačítko lekce", "Typy lekcí"),
    },
  },
  homeNews: {
    title: "Úvod – aktuality",
    page: "/",
    fields: { eyebrow: opt("Malý nadpis", "Aktuality") },
  },
  schedule: {
    title: "Rozvrh",
    page: "/rozvrh",
    fields: {
      eyebrow: opt("Malý nadpis", "Rozvrh"),
      title: t("Nadpis", "Najdi si svou lekci."),
      intro: ta("Úvodní text", "Klikni na lekci a rezervuj. Storno zdarma v termínu, plné lekce mají pořadník."),
      empty: t("Prázdný týden", "Na tento týden zatím nejsou vypsané žádné lekce."),
    },
  },
  classes: {
    title: "Lekce",
    page: "/lekce",
    fields: {
      eyebrow: opt("Malý nadpis", "Lekce"),
      title: t("Nadpis", "Pohyb pro tělo i mysl."),
      intro: ta("Úvodní text", "Tanec, pilates, síla i regenerace. Vyber si podle nálady – nebo zkus všechno."),
    },
  },
  reviews: {
    title: "Recenze",
    page: "/recenze",
    fields: {
      eyebrow: opt("Malý nadpis", "Recenze"),
      title: t("Nadpis", "Co říkají naši lidé."),
      intro: ta("Úvodní text", "Zkušenosti klientů OCTOPUSH. Chodíš k nám? Budeme rádi za pár slov."),
      homeTitle: t("Nadpis na úvodní stránce", "Co o nás říkají"),
      googleUrl: { label: "Odkaz na hodnocení na Googlu (prázdné = profil OCTOPUSH)", type: "url", default: "https://g.page/r/CUvZHNMtZbNBEAE/review", optional: true },
    },
  },
  board: {
    title: "Nástěnka",
    page: "/nastenka",
    fields: {
      eyebrow: opt("Malý nadpis", "Nástěnka"),
      title: t("Nadpis", "Co je nového v OCTOPUSH."),
      intro: ta("Úvodní text", "Novinky ze studia – a prostor pro tvoje reakce."),
    },
  },
  massages: {
    title: "Masáže",
    page: "/masaze",
    fields: {
      eyebrow: opt("Malý nadpis", "Masáže"),
      title: t("Nadpis", "Čas jen pro tebe."),
      intro: ta("Úvodní text", "Uvolni tělo po tréninku i po dlouhém dni. Vyber si masáž a volný termín – rezervace zabere minutu."),
      paymentInfo: ta(
        "Jak se platí",
        "Masáž zaplatíš předem – kartou online hned po rezervaci, nebo převodem (platební údaje i QR kód ti ukážeme po rezervaci). Máš-li permanentku na masáže, strhne se z ní vstup.",
      ),
      noSlots: ta("Když nejsou volné termíny", "Teď nejsou vypsané žádné volné termíny. Napiš nám nebo zavolej, rádi se domluvíme."),
      bankAccount: {
        label: "Číslo účtu pro platby převodem",
        type: "text",
        default: "5072631349/0800",
        hint: "Platí pro všechny platby převodem (lekce, permanentky, kredit, masáže).",
      },
      bankHolder: t("Majitel účtu (ukáže se u platby)", "MOVE IN ZONE s.r.o."),
    },
  },
  about: {
    title: "O mně",
    page: "/o-mne",
    fields: {
      eyebrow: opt("Malý nadpis", "O mně"),
      title: t("Nadpis", "Ahoj, tady tvoje lektorka."),
      intro: rich("Úvodní text", "Každý má svou cestu. Ráda tě kus té tvojí doprovodím."),
      image: img("Moje fotka", "/img/pohyb.webp"),
      imageAlt: t("Popis fotky", "Lektorka studia OCTOPUSH"),
      caption: opt("Popisek fotky", "Lektorka & zakladatelka"),
      body: rich(
        "Příběh",
        `## Proč OCTOPUSH
Napiš sem, jak studio vzniklo a co pro tebe pohyb znamená.

## Co u mě najdeš
- tanec, který spojuje
- pilates – síla v rovnováze
- silový trénink pro běžný život

## Vzdělání a certifikace
- doplň své kurzy a certifikáty`,
      ),
      cta: t("Tlačítko", "Přijď si zacvičit"),
    },
  },
  pricing: {
    title: "Ceník",
    page: "/cenik",
    fields: {
      eyebrow: opt("Malý nadpis", "Ceník"),
      title: t("Nadpis", "Každý má svou cestu. I k ceníku."),
      intro: ta("Úvodní text", "Členství, permanentka, kredit nebo jednorázový vstup – vyber si, co sedí tvému rytmu."),
      freeEyebrow: t("Pruh „vstup zdarma“ – malý nadpis", "Vstup zdarma"),
      freeTitle: t("Pruh „vstup zdarma“ – nadpis", "První lekce je na nás."),
      freeText: ta(
        "Pruh „vstup zdarma“ – text",
        "Po registraci ti ji připíšeme na účet, platí {{platnost_zdarma}} dní. Sleduj také lekce označené „Zdarma“ v rozvrhu.",
      ),
      membershipTitle: t("Členství – nadpis", "Členství"),
      membershipText: ta("Členství – text", "Pro ty, kdo chodí pravidelně – nejvýhodnější cena za lekci. Platí se měsíčně, závazek na 12 měsíců."),
      passTitle: t("Permanentky – nadpis", "Permanentky"),
      passText: ta("Permanentky – text", "Balíček vstupů na lekce s platností. Běžná lekce = 1 vstup, u některých lekcí se strhne víc vstupů – vždy to najdeš u lekce."),
      creditTitle: t("Kredit – nadpis", "Kredit"),
      creditText: ta("Kredit – text", "Dobij si kredit a plať jím za lekce – kolik kreditů lekce stojí, vidíš u každé lekce. Platnost se prodlouží s každým dobitím."),
      solariumTitle: t("Solárium – nadpis", "Solárium"),
      solariumText: ta("Solárium – text", "Permanentka na minuty pro členy. Minuty ti odečteme na recepci po každém opalování."),
      massagePassTitle: t("Permanentky na masáže – nadpis", "Masáže"),
      massagePassText: ta(
        "Permanentky na masáže – text",
        "Permanentka na více masáží. Termín si rezervuješ online a při platbě zvolíš „Permanentkou“.",
      ),
      dropInTitle: t("Jednorázový vstup – nadpis", "Jednorázový vstup"),
      dropInText: ta("Jednorázový vstup – text", "Bez závazku – zaplatíš převodem nebo kreditem."),
      info1Title: t("Info 1 – nadpis", "Storno"),
      info1Text: ta(
        "Info 1 – text",
        "Zdarma nejpozději {{storno_hodin}} h před začátkem lekce – vstup/kredit se vrátí na účet. Později vstup propadá.",
      ),
      info2Title: t("Info 2 – nadpis", "Pořadník"),
      info2Text: ta("Info 2 – text", "Plná lekce? Zapiš se, a když se místo uvolní, automaticky tě přihlásíme a strhneme vstup."),
      info3Title: t("Info 3 – nadpis", "Na recepci"),
      info3Text: ta("Info 3 – text", "Permanentky, členství i kredit koupíš také hotově nebo kartou přímo ve studiu."),
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
- Rezervace probíhá online přes klientský účet: {{rezervace_okno}} (s aktivním členstvím {{rezervace_okno_clenove}}).
- Lekci lze zaplatit kreditem, permanentkou, členstvím, vstupem zdarma nebo jednorázově převodem.
- Neuhrazená rezervace jednorázového vstupu se uvolní po {{platba_minut}} minutách.

## 3. Storno podmínky
- Rezervaci lze bezplatně zrušit nejpozději {{storno_hodin}} hodin před začátkem lekce; vstup nebo kredit se vrací na účet.
- Při pozdějším zrušení nebo neúčasti vstup propadá.
- Členství nemá omezený počet lekcí, proto se pozdní zrušení a neúčast u členů počítají jako prohřešek. Po {{prohresky}} prohřešcích za {{prohresky_dni}} dní se přihlašování na nové lekce pozastaví na {{pauza_dni}} dní; na již rezervované lekce lze chodit. Před pauzou přijde upozornění e-mailem.
- Zruší-li lekci studio, vstup se vrací vždy. Jednorázový vstup zaplacený kartou je vrácen ve formě kreditu.
- Při uvolnění místa je automaticky přihlášen klient z pořadníku a je mu stržen vstup.

## 4. Kredit, permanentky a členství
- Kredit je nepřenosný a nepropadá. 1 kredit odpovídá ceně uvedené u lekce.
- Permanentky platí po dobu uvedenou v ceníku od data nákupu.
- Členství je závazné na 12 měsíců a platí se měsíčně. Členství v účtu klienta spravuje studio – o změnu nebo ukončení požádej na recepci.

## 5. Platby
Online platby zpracovává Stripe Payments Europe, Ltd. Ceny jsou uvedeny v Kč včetně DPH (je-li provozovatel plátcem).

## 6. Odstoupení od smlouvy
Spotřebitel bere na vědomí, že dle § 1837 písm. j) občanského zákoníku nelze odstoupit od smlouvy o využití volného času, je-li plněno v určeném termínu. U permanentek a kreditu lze odstoupit do 14 dnů od nákupu, pokud nebyly čerpány.

## 7. Zdraví a bezpečnost
- Klient se lekcí účastní dobrovolně a na vlastní odpovědnost. Rezervací potvrzuje, že jeho zdravotní stav mu účast na zvolené lekci dovoluje.
- Posouzení vlastního zdravotního stavu je odpovědností klienta. Má-li klient zdravotní potíže, je po úrazu či operaci, je těhotný nebo si není jistý, zda je pro něj cvičení vhodné, je povinen se před účastí poradit s lékařem.
- Klient je povinen před lekcí upozornit lektora na veškerá zdravotní omezení, úrazy, těhotenství a užívané léky, které mohou mít vliv na cvičení. Lektor není lékař ani fyzioterapeut a zdravotní stav klienta neposuzuje.
- Klient je povinen řídit se pokyny lektora, cvičit v mezích svých možností, cvik přerušit při bolesti či nevolnosti a neprodleně to lektorovi oznámit. Klient nesmí cvičit pod vlivem alkoholu, drog nebo léků snižujících pozornost.
- Klient je povinen používat vybavení studia (včetně reformerů) jen podle pokynů lektora a vzniklou závadu ihned nahlásit.
- Studio ani lektor neodpovídají za újmu, která vznikne tím, že klient zamlčel zdravotní omezení, nerespektoval pokyny lektora, cvičil nad rámec svých možností nebo porušil tyto podmínky či provozní řád. Za újmu způsobenou vlastním jednáním klienta odpovídá klient; za škodu, kterou klient úmyslně nebo z nedbalosti způsobí na vybavení studia nebo jiným osobám, odpovídá v plném rozsahu.
- Lektor může klienta z lekce vyloučit nebo mu účast nedoporučit, pokud jeho stav či chování ohrožuje jeho samotného nebo ostatní. Vstup se v takovém případě nevrací.
- Studio neodpovídá za odložené věci, cennosti a peníze, které nebyly předány do úschovy.
- Tato ustanovení nevylučují odpovědnost studia v případech, kdy ji podle zákona vyloučit nelze.`,
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
- Datum narození a svátek – nepovinné, vyplňujete je sami v profilu, abychom vám mohli popřát. Kdykoliv je můžete v profilu smazat.
- Přezdívka a profilová fotka (nebo zvolený avatar) – nepovinné, slouží k zobrazení u vašich reakcí na nástěnce, kde je uvidí její návštěvníci, a k tomu, aby vás recepce poznala. Kdykoliv je můžete v profilu změnit nebo odstranit.
- Reakce na nástěnce – zobrazují se ostatním návštěvníkům nástěnky spolu s přezdívkou (případně křestním jménem) a profilovkou. Svou reakci můžete kdykoliv smazat.
- Jméno kamarádky, kterou přivedete na lekci (+1) – jen pro evidenci rezervace; jméno nám předáváte se souhlasem dotyčné osoby.

## Příjemci
Poskytovatel hostingu a databáze, banka (platby převodem), služby pro odesílání e-mailů, SMS a WhatsApp zpráv. Údaje neprodáváme.

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
