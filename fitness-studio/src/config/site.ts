/**
 * Brand & contact details. Everything studio-specific that is not editable
 * in the admin lives here – change it once and the whole site follows.
 */
export const site = {
  name: "OCTOPUSH",
  tagline: "Každý má svou cestu.",
  claim: "More life. Better humans.",
  description:
    "Studio pohybu a rovnováhy. Tanec, pilates, silový trénink a komunita lidí, kteří jdou svou cestou. Rezervuj si lekci online během pár vteřin.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "ahoj@octopush.cz",
  phone: "+420 777 000 000",
  address: {
    street: "Doplňte ulici 123",
    city: "Ostrava",
    zip: "700 30",
    mapUrl: "https://maps.google.com/?q=Ostrava",
  },
  company: {
    name: "OCTOPUSH s.r.o.",
    ico: "00000000",
  },
  social: {
    instagram: "https://www.instagram.com/",
    facebook: "https://www.facebook.com/",
    whatsapp: "",
  },
  /** Hodnoty značky z moodboardu */
  values: [
    { title: "Směr", sub: "Tvá cesta" },
    { title: "Síla", sub: "V tvém těle" },
    { title: "Zdraví", sub: "Vitalita" },
    { title: "Výživa", sub: "Palivo" },
    { title: "Komunita", sub: "Společně" },
    { title: "Energie", sub: "Každý den" },
    { title: "Rovnováha", sub: "Tělo i mysl" },
    { title: "Svoboda", sub: "V pohybu" },
  ],
  pillars: ["Pohyb", "Lidé", "Příroda", "Harmonie"],
} as const;
