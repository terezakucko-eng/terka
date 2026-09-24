/**
 * Fixed technical brand settings. Everything else (texts, contacts, address,
 * social links, images) is editable in Admin → Obsah webu – see
 * src/content/definitions.ts for the defaults.
 */
export const site = {
  name: "OCTOPUSH",
  url:
    // SITE_URL is read at runtime (Docker); NEXT_PUBLIC_ is baked in at build
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    // Vercel preview/devel: stable per-branch address, else this deployment's
    (process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`) ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    "http://localhost:3000",
  /** Fallback sender for e-mails when MAIL_FROM isn't set. */
  email: "ahoj@octopush.fit",
  // used in e-mail footers (e-mails are sent outside page requests)
  tagline: "Každý má svou cestu.",
} as const;
