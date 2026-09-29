"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Smartphone } from "lucide-react";
import { cardPromptDoneAction } from "@/app/actions/card";
import { shareOrDownload } from "@/lib/share-image";

type Platform = "ios" | "android" | "other";

const detect = (): Platform => {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : "other";
};
const noSubscribe = () => () => {};

/** Save the member card to the phone: as a photo, or the whole site as an app on the home screen. */
export function CardSave({ embedded }: { embedded?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const platform = useSyncExternalStore(noSubscribe, detect, () => "other" as Platform);
  const [install, setInstall] = useState<{ prompt: () => Promise<void> } | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const how = await shareOrDownload("/api/karta", "octopush-clenska-karta.png", { title: "Členská karta OCTOPUSH" });
      setMsg(how === "shared" ? "Hotovo – vyber „Uložit obrázek“ a kartu najdeš ve fotkách." : "Karta je stažená – najdeš ji ve stažených souborech.");
      void cardPromptDoneAction();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg("Uložení se nepovedlo, zkus to prosím znovu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={embedded ? "space-y-4 text-sm" : "mt-6 space-y-4 rounded-2xl border border-linka/60 bg-white/60 p-5 text-sm"}>
      {!embedded && <p className="font-semibold">Ulož si kartu do mobilu</p>}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-les px-5 py-3 text-xs font-semibold uppercase tracking-wider text-papir disabled:opacity-50"
      >
        <Download className="size-4" /> {busy ? "Připravuji…" : "Uložit kartu jako obrázek"}
      </button>
      {msg && <p className="text-xs text-les/70">{msg}</p>}
      <div className="border-t border-linka/60 pt-4 text-les/70">
        <p className="flex items-center gap-2 font-semibold text-les"><Smartphone className="size-4" /> Nebo si přidej OCTOPUSH na plochu</p>
        {install ? (
          <button
            type="button"
            onClick={async () => {
              await install.prompt();
              setInstall(null);
              void cardPromptDoneAction();
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-les px-4 py-2 text-xs font-semibold"
          >
            Přidat na plochu
          </button>
        ) : platform === "ios" ? (
          <p className="mt-2">V Safari klepni na <strong>Sdílet</strong> (čtvereček se šipkou) → <strong>Přidat na plochu</strong>. Rozvrh, rezervace i karta pak budou jedním klepnutím.</p>
        ) : platform === "android" ? (
          <p className="mt-2">V Chromu otevři menu <strong>⋮</strong> → <strong>Přidat na plochu</strong> (nebo „Nainstalovat aplikaci“).</p>
        ) : (
          <p className="mt-2">Otevři tuhle stránku v mobilu – v Safari přes Sdílet → Přidat na plochu, v Chromu přes menu ⋮ → Přidat na plochu.</p>
        )}
      </div>
    </div>
  );
}
