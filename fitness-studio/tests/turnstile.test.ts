import { afterEach, describe, expect, it, vi } from "vitest";
import { turnstileOk, turnstileSiteKey } from "@/lib/turnstile";

const reply = (success: boolean) => vi.fn(async () => new Response(JSON.stringify({ success })));

afterEach(() => vi.unstubAllEnvs());

describe("turnstile", () => {
  it("is off (and lets everyone through) until both keys are set", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const f = reply(false);
    expect(turnstileSiteKey()).toBeNull();
    expect(await turnstileOk("", undefined, f)).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  it("asks Cloudflare once the keys are set", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect(turnstileSiteKey()).toBe("site");
    expect(await turnstileOk("", "1.2.3.4", reply(true))).toBe(false);
    const ok = reply(true);
    expect(await turnstileOk("tok", "1.2.3.4", ok)).toBe(true);
    const body = (ok.mock.calls[0] as unknown as [string, { body: URLSearchParams }])[1].body;
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.2.3.4");
    expect(await turnstileOk("tok", undefined, reply(false))).toBe(false);
  });
});
