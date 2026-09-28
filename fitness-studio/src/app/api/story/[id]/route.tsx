import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { ImageResponse } from "next/og";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { announcements } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { clampLines, storyLines } from "@/lib/story-text";

const assets = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/DMSans-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/DMSans-SemiBold.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Allura-Regular.ttf")),
  readFile(join(process.cwd(), "public/brand/symbol-gold.svg")),
  readFile(join(process.cwd(), "public/brand/wordmark-gold.svg")),
]);
const svg = (b: Buffer) => `data:image/svg+xml;base64,${b.toString("base64")}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 1080×1920 image of a board post for Instagram / Facebook stories. */
export async function GET(_: Request, { params }: RouteContext<"/api/story/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const [a] = await (await getDb()).select().from(announcements).where(eq(announcements.id, id));
  if (!a || (!a.isPublished && (await getCurrentUser())?.role !== "admin")) return new Response("Not found", { status: 404 });

  const [[regular, semibold, allura, symbol, wordmark], c] = await Promise.all([assets, getContent()]);
  const titleSize = a.title.length > 60 ? 76 : a.title.length > 30 ? 92 : 110;
  const { lines, cut } = clampLines(storyLines(a.body), a.title.length > 60 ? 420 : 560);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(170deg, #394330 0%, #1a281b 45%, #151a13 100%)",
          color: "#f3ebde",
          fontFamily: "DM Sans",
          padding: "250px 96px 260px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
          <img src={svg(symbol)} width={120} height={102} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, letterSpacing: 8, color: "#d2a772", fontWeight: 600 }}>NÁSTĚNKA</span>
            <span style={{ fontSize: 30, color: "rgba(243,235,222,.6)", marginTop: 6 }}>{formatDate(a.createdAt)}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: titleSize, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1 }}>{a.title}</div>
          <div style={{ width: 120, height: 4, background: "#d2a772", margin: "56px 0 48px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {lines.map((l, i) => (
              <div key={i} style={{ fontSize: 42, lineHeight: 1.38, color: "rgba(243,235,222,.85)" }}>{l}</div>
            ))}
          </div>
          {cut && <div style={{ fontSize: 36, color: "#f7dbb4", marginTop: 30 }}>Celé čti na nástěnce →</div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <span style={{ fontFamily: "Allura", fontSize: 64, color: "#f7dbb4" }}>{c.raw("site.tagline")}</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
          <img src={svg(wordmark)} width={420} height={67} alt="" />
          <span style={{ fontSize: 30, letterSpacing: 6, color: "rgba(243,235,222,.6)" }}>OCTOPUSH.FIT</span>
        </div>
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
      headers: { "Cache-Control": "no-store" },
    },
  );
}
