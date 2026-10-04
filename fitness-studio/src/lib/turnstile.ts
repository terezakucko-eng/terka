/**
 * Cloudflare Turnstile (anti-bot check on registration). Off until both keys
 * are set in the environment – then the form shows the widget and the server
 * verifies its token.
 */
export function turnstileSiteKey() {
  return process.env.TURNSTILE_SECRET_KEY ? process.env.TURNSTILE_SITE_KEY || null : null;
}

export async function turnstileOk(token: string, ip?: string, fetcher: typeof fetch = fetch) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.TURNSTILE_SITE_KEY) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    // Cloudflare unreachable: don't lock real people out, the other checks still apply
    console.error("turnstile verify failed", e);
    return true;
  }
}
