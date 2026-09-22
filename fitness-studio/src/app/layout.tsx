import type { Metadata, Viewport } from "next";
import { Allura, Inter } from "next/font/google";
import { site } from "@/config/site";
import { getContent } from "@/content";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const allura = Allura({
  variable: "--font-allura",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent();
  const title = `${site.name} – ${c("site.tagline")}`;
  return {
    metadataBase: new URL(site.url),
    title: { default: title, template: `%s · ${site.name}` },
    description: c("site.description"),
    openGraph: {
      type: "website",
      locale: "cs_CZ",
      siteName: site.name,
      title,
      description: c("site.description"),
      images: [c("homeHero.image")],
    },
  };
}

export const viewport: Viewport = { themeColor: "#1a281b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="cs" className={`${inter.variable} ${allura.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
