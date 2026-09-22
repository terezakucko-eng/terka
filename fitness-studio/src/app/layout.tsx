import type { Metadata, Viewport } from "next";
import { Allura, Inter } from "next/font/google";
import { site } from "@/config/site";
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

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} – ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    siteName: site.name,
    title: `${site.name} – ${site.tagline}`,
    description: site.description,
  },
};

export const viewport: Viewport = { themeColor: "#1a281b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="cs" className={`${inter.variable} ${allura.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
