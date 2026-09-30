"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, MoreVertical, Plus, Share, Smartphone, X } from "lucide-react";
import { canPromptInstall, isStandalone, justInstalled, promptInstall, subscribeInstall } from "@/lib/install-prompt";
import { useOs, type Os } from "./install-guide";
import { cx } from "./ui";

const never = () => false;

/**
 * "Přidat na plochu" in one tap. Chrome / Edge / Samsung show their own
 * "Install?" dialog; iPhone has no such dialog for websites, so the button
 * opens a short picture guide there instead.
 */
export function InstallButton({ className, after }: { className?: string; after?: string }) {
  const os = useOs();
  const canPrompt = useSyncExternalStore(subscribeInstall, canPromptInstall, never);
  const installed = useSyncExternalStore(subscribeInstall, () => justInstalled() || isStandalone(), never);
  const [guide, setGuide] = useState(false);

  if (installed)
    return (
      <p className={cx("flex items-center gap-2 text-sm font-semibold text-ok", className)}>
        <Check className="size-4" /> OCTOPUSH máš na ploše
      </p>
    );

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (canPrompt) await promptInstall();
          else setGuide(true);
        }}
        className={cx(
          "inline-flex w-full items-center justify-center gap-2 rounded-full bg-les px-5 py-3 text-xs font-semibold uppercase tracking-wider text-papir",
          className,
        )}
      >
        <Smartphone className="size-4" /> Přidat na plochu
      </button>
      {guide && <InstallSteps os={os} after={after} onClose={() => setGuide(false)} />}
    </>
  );
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-linka/60">{children}</span>
);

const STEPS: Record<Os, { icon: React.ReactNode; text: React.ReactNode }[]> = {
  ios: [
    {
      icon: <Key><Share className="size-6 text-[#0a84ff]" /></Key>,
      text: <>Klepni na <strong>Sdílet</strong> – v Safari dole uprostřed, v Chromu nahoře vedle adresy.</>,
    },
    {
      icon: <Key><Plus className="size-6" /></Key>,
      text: <>Sjeď níž a vyber <strong>Přidat na plochu</strong>.</>,
    },
    { icon: <Key><Check className="size-6 text-ok" /></Key>, text: <>Vpravo nahoře klepni na <strong>Přidat</strong>. Hotovo 🐙</> },
  ],
  android: [
    { icon: <Key><MoreVertical className="size-6" /></Key>, text: <>Otevři menu prohlížeče <strong>⋮</strong> (vpravo nahoře, v Samsungu ≡ dole).</> },
    { icon: <Key><Plus className="size-6" /></Key>, text: <>Vyber <strong>Přidat na plochu</strong> nebo <strong>Nainstalovat aplikaci</strong>.</> },
    { icon: <Key><Check className="size-6 text-ok" /></Key>, text: <>Potvrď <strong>Přidat</strong>. Hotovo 🐙</> },
  ],
  desktop: [
    { icon: <Key><Plus className="size-6" /></Key>, text: <>V Chromu nebo Edge klikni na ikonu <strong>instalace</strong> na konci adresního řádku.</> },
    { icon: <Key><Check className="size-6 text-ok" /></Key>, text: <>Potvrď <strong>Nainstalovat</strong>. V Safari na Macu: <strong>Soubor → Přidat do Docku</strong>.</> },
  ],
};

function InstallSteps({ os, after, onClose }: { os: Os; after?: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-les/60 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jak přidat OCTOPUSH na plochu"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl bg-papir p-6 text-les shadow-2xl"
      >
        <button type="button" onClick={onClose} aria-label="Zavřít" className="absolute right-4 top-4 text-les/50 hover:text-les">
          <X className="size-5" />
        </button>
        <h2 className="pr-8 text-xl font-semibold">Přidej si OCTOPUSH na plochu</h2>
        <ol className="mt-5 space-y-4">
          {STEPS[os].map((s, i) => (
            <li key={i} className="flex items-center gap-4 text-sm">
              {s.icon}
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        {after && <p className="mt-5 rounded-xl bg-krem/60 p-3 text-xs text-les/70">{after}</p>}
        {os === "ios" && (
          // the Share button sits at the bottom of the screen in Safari – point at it
          <p className="mt-5 text-center text-xs text-les/50">Tlačítko Sdílet najdeš pod tímto oknem ↓</p>
        )}
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-full border border-les/30 py-2.5 text-xs font-semibold uppercase tracking-wider">
          Rozumím
        </button>
      </div>
    </div>
  );
}
