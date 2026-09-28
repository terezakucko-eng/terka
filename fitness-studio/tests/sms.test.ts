import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const env = () => {
  vi.stubEnv("SMSBRANA_LOGIN", "movein_h1");
  vi.stubEnv("SMSBRANA_PASSWORD", "tajne");
};

describe("SMSbrána.cz (SMS Connect v3)", () => {
  it("signs the request per the documentation and reads the XML reply", async () => {
    env();
    const fetchMock = vi.fn(async () => new Response("<result><err>0</err><sms_id>377351</sms_id></result>"));
    vi.stubGlobal("fetch", fetchMock);
    const { sendSmsBrana } = await import("@/lib/messaging");
    const r = await sendSmsBrana("+420777123456", "Zítra: Reformer – těšíme se!", new Date("2026-10-01T20:27:20Z"));
    expect(r).toEqual({ ok: true, ref: "377351" });
    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(`${url.origin}${url.pathname}`).toBe("https://api.smsbrana.cz/smsconnect/");
    const q = url.searchParams;
    expect(q.get("action")).toBe("send_sms");
    expect(q.get("login")).toBe("movein_h1");
    expect(q.get("time")).toBe("20261001T222720"); // Prague summer time, the documentation's own example
    expect(q.get("password")).toBeNull();
    expect(q.get("auth")).toBe(createHash("md5").update("tajne" + q.get("time") + q.get("salt")).digest("hex"));
    expect(q.get("number")).toBe("+420777123456");
    expect(q.get("message")).toBe('Zitra: Reformer - tesime se!');
  });

  it("explains gateway errors", async () => {
    env();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<result><err>9</err></result>")));
    const { sendSmsBrana } = await import("@/lib/messaging");
    const r = await sendSmsBrana("+420777123456", "x");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("kreditu");
  });

  it("falls back to the backup endpoint when the main one is down", async () => {
    env();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(new Response("<result><err>0</err><sms_id>1</sms_id></result>"));
    vi.stubGlobal("fetch", fetchMock);
    const { sendSmsBrana } = await import("@/lib/messaging");
    expect((await sendSmsBrana("+420777123456", "x")).ok).toBe(true);
    expect(String(fetchMock.mock.calls[1][0])).toContain("api-backup.smsbrana.cz");
  });

  it("uses the Prague winter time too", async () => {
    const { smsConnectTime } = await import("@/lib/messaging");
    expect(smsConnectTime(new Date("2026-01-15T08:00:00Z"))).toBe("20260115T090000");
  });
});
