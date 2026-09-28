"use client";

import { useState } from "react";
import { Download, Share2 } from "lucide-react";

/**
 * Stories image of a board post: on a phone "Sdílet do stories" opens the
 * share sheet (Instagram / Facebook stories), elsewhere the image downloads.
 */
export function StoryShare({ id, title, url }: { id: string; title: string; url: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const src = `/api/story/${id}`;
  const fileName = `octopush-${title.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40)}.png`;

  async function share() {
    setBusy(true);
    setMsg("");
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: url });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
        setMsg("Obrázek je stažený – nahraj ho do stories v telefonu.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg("Sdílení se nepovedlo, zkus obrázek stáhnout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-5 rounded-xl bg-krem/40 p-4">
      <a href={src} target="_blank" rel="noreferrer" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated image, not worth optimizing */}
        <img src={src} alt={`Stories: ${title}`} width={108} height={192} loading="lazy" className="rounded-lg shadow" />
      </a>
      <div className="space-y-3 text-sm">
        <p className="font-semibold">Stories na Instagram a Facebook</p>
        <p className="max-w-sm text-les/70">
          Na telefonu klepni na <strong>Sdílet do stories</strong> a vyber Instagram nebo Facebook. Na počítači se obrázek stáhne.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={share} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-les px-4 py-2 text-xs font-semibold text-papir disabled:opacity-50">
            <Share2 className="size-4" /> {busy ? "Připravuji…" : "Sdílet do stories"}
          </button>
          <a href={src} download={fileName} className="inline-flex items-center gap-2 rounded-full border border-les px-4 py-2 text-xs font-semibold">
            <Download className="size-4" /> Stáhnout obrázek
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-les px-4 py-2 text-xs font-semibold"
          >
            Příspěvek s odkazem na FB
          </a>
        </div>
        {msg && <p className="text-xs text-les/70">{msg}</p>}
      </div>
    </div>
  );
}
