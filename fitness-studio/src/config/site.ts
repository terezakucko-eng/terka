/**
 * Fixed technical brand settings. Everything else (texts, contacts, address,
 * social links, images) is editable in Admin → Obsah webu – see
 * src/content/definitions.ts for the defaults.
 */
export const site = {
  name: "OCTOPUSH",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Fallback sender for e-mails when MAIL_FROM isn't set. */
  email: "ahoj@octopush.fit",
  // used in e-mail footers (e-mails are sent outside page requests)
  tagline: "Každý má svou cestu.",
} as const;
