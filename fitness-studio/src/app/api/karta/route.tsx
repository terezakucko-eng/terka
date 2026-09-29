import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getContent } from "@/content";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { userEntitlements } from "@/lib/account";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { qrSvg } from "@/lib/qr-payment";

const assets = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/DMSans-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/DMSans-SemiBold.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Allura-Regular.ttf")),
  readFile(join(process.cwd(), "public/brand/symbol-gold.svg")),
  readFile(join(process.cwd(), "public/brand/wordmark-gold.svg")),
]);
const dataUri = (svg: string | Buffer) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/** The signed-in client's member card as a 1080×1920 picture to keep in the phone's photos. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const db = await getDb();
  const [[regular, semibold, allura, symbol, wordmark], c, ents, qr] = await Promise.all([
    assets,
    getContent(),
    userEntitlements(db, user.id, true),
    qrSvg(`${site.url}/admin/klienti/${user.id}`),
  ]);
  const membership = ents.find((e) => e.kind === "membership");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "linear-gradient(170deg, #394330 0%, #1a281b 45%, #151a13 100%)",
          color: "#f3ebde",
          fontFamily: "DM Sans",
          padding: "200px 96px 180px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
        <img src={dataUri(symbol)} width={150} height={128} alt="" />
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
        <img src={dataUri(wordmark)} width={480} height={76} alt="" style={{ marginTop: 36 }} />
        <span style={{ marginTop: 28, fontSize: 30, letterSpacing: 10, color: "#d2a772", fontWeight: 600 }}>ČLENSKÁ KARTA</span>

        <div style={{ display: "flex", marginTop: 90, padding: 36, background: "#ffffff", borderRadius: 48 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
          <img src={dataUri(qr)} width={560} height={560} alt="" />
        </div>

        <span style={{ marginTop: 70, fontSize: 64, fontWeight: 600, textAlign: "center" }}>{user.name}</span>
        <span style={{ marginTop: 14, fontSize: 32, color: "rgba(243,235,222,.6)" }}>klientem od {formatDate(user.createdAt)}</span>
        {membership && (
          <span style={{ marginTop: 26, fontSize: 34, color: "#f7dbb4" }}>
            {membership.name} · do {formatDate(membership.validUntil)}
          </span>
        )}

        <div style={{ display: "flex", flex: 1 }} />
        <span style={{ fontFamily: "Allura", fontSize: 60, color: "#f7dbb4" }}>{c.raw("site.tagline")}</span>
        <span style={{ marginTop: 10, fontSize: 28, letterSpacing: 6, color: "rgba(243,235,222,.55)" }}>OCTOPUSH.FIT</span>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "DM Sans", data: regular, weight: 400, style: "normal" },
        { name: "DM Sans", data: semibold, weight: 600, style: "normal" },
        { name: "Allura", data: allura, weight: 400, style: "normal" },
      ],
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
