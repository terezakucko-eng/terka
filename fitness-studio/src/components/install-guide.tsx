"use client";

import { useState, useSyncExternalStore } from "react";
import { cx } from "./ui";

export type Os = "ios" | "android" | "desktop";

const detect = (): Os => {
  const ua = navigator.userAgent;
  // iPadOS pretends to be a Mac – touch gives it away
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return /Android/.test(ua) ? "android" : "desktop";
};
const noSubscribe = () => () => {};

/** The visitor's system (guessed from the browser); "desktop" while rendering on the server. */
export const useOs = () => useSyncExternalStore(noSubscribe, detect, () => "desktop" as Os);

const tabs: { os: Os; label: string }[] = [
  { os: "ios", label: "iPhone / iPad" },
  { os: "android", label: "Android" },
  { os: "desktop", label: "Počítač" },
];

const steps: Record<Os, { browser: string; how: React.ReactNode }[]> = {
  ios: [
    {
      browser: "Safari",
      how: <>klepni dole na <strong>Sdílet</strong> (čtvereček se šipkou) → <strong>Přidat na plochu</strong> → Přidat.</>,
    },
    {
      browser: "Chrome / Edge",
      how: <>klepni nahoře vedle adresy na <strong>Sdílet</strong> → <strong>Přidat na plochu</strong>.</>,
    },
  ],
  android: [
    { browser: "Chrome", how: <>menu <strong>⋮</strong> vpravo nahoře → <strong>Přidat na plochu</strong> (nebo „Nainstalovat aplikaci“).</> },
    { browser: "Samsung Internet", how: <>menu <strong>≡</strong> dole → <strong>Přidat stránku do</strong> → Domovská obrazovka.</> },
    { browser: "Firefox", how: <>menu <strong>⋮</strong> → <strong>Nainstalovat</strong> (nebo „Přidat na plochu“).</> },
  ],
  desktop: [
    { browser: "Chrome / Edge", how: <>ikona <strong>instalace</strong> na konci adresního řádku, nebo menu → <strong>Nainstalovat stránku jako aplikaci</strong>.</> },
    { browser: "Safari na Macu", how: <>menu <strong>Soubor</strong> → <strong>Přidat do Docku</strong>.</> },
  ],
};

/**
 * How to put OCTOPUSH on the home screen – one tab per system, the visitor's
 * own one open first, so Android and computer users get their steps too.
 * `after` is appended to every set of steps (e.g. "then open it from there").
 */
export function InstallGuide({ after, only }: { after?: React.ReactNode; only?: Os[] }) {
  const os = useOs();
  const [picked, setPicked] = useState<Os | null>(null);
  const shown = tabs.filter((t) => !only || only.includes(t.os));
  const active = picked ?? (shown.some((t) => t.os === os) ? os : shown[0].os);

  return (
    <div className="mt-2 space-y-2">
      {shown.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Tvůj telefon">
          {shown.map((t) => (
            <button
              key={t.os}
              type="button"
              role="tab"
              aria-selected={active === t.os}
              onClick={() => setPicked(t.os)}
              className={cx(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                active === t.os ? "border-les bg-les text-papir" : "border-linka text-les/70",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-1.5">
        {steps[active].map((s) => (
          <li key={s.browser}>
            <strong className="text-les">{s.browser}:</strong> {s.how}
          </li>
        ))}
      </ul>
      {after && <p>{after}</p>}
    </div>
  );
}
