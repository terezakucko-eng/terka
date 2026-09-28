import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("SMSbrána.cz (SMS Connect)", () => {
  it("signs the request and reads the XML reply", async () => {
    vi.stubEnv("SMSBRANA_LOGIN", "studio");
    vi.stubEnv("SMSBRANA_PASSWORD", "tajne");
    const fetchMock = vi.fn(async () => new Response("<result><err>0</err><sms_id>377</sms_id></result>"));
    vi.stubGlobal("fetch", fetchMock);
    const { sendSms } = await import("@/lib/messaging");
    const r = await sendSms("+420777123456", "Ahoj z OCTOPUSH");
    expect(r).toEqual({ ok: true, ref: "377" });
    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url.host).toBe("api.smsbrana.cz");
    const q = url.searchParams;
    expect(q.get("action")).toBe("send_sms");
    expect(q.get("number")).toBe("420777123456");
    expect(q.get("message")).toBe("Ahoj z OCTOPUSH");
    expect(q.get("password")).toBeNull();
    expect(q.get("time")).toMatch(/^\d{8}T\d{6}$/);
    expect(q.get("auth")).toBe(createHash("md5").update("tajne" + q.get("time") + q.get("sul")).digest("hex"));
  });

  it("reports gateway errors", async () => {
    vi.stubEnv("SMSBRANA_LOGIN", "studio");
    vi.stubEnv("SMSBRANA_PASSWORD", "tajne");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<result><err>3</err></result>")));
    const { sendSms } = await import("@/lib/messaging");
    const r = await sendSms("+420777123456", "x");
    expect(r.ok).toBe(false);
  });
});
