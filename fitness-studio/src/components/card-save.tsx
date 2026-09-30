"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { cardSavedAction } from "@/app/actions/card";
import { shareOrDownload } from "@/lib/share-image";
import { InstallButton } from "./install-button";

/** Save the member card to the phone: as a photo, or the whole site as an app on the home screen. */
export function CardSave({ embedded }: { embedded?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      const how = await shareOrDownload("/api/karta", "octopush-clenska-karta.png", { title: "Členská karta OCTOPUSH" });
      setMsg(how === "shared" ? "Hotovo – vyber „Uložit obrázek“ a kartu najdeš ve fotkách." : "Karta je stažená – najdeš ji ve stažených souborech.");
      void cardSavedAction();
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
        <p className="mb-3">Nebo si přidej OCTOPUSH na plochu – rozvrh, rezervace i karta pak budou jedním klepnutím.</p>
        <InstallButton className="bg-transparent border border-les text-les" />
      </div>
    </div>
  );
}
