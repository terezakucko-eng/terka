"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ClientOpt } from "./client-picker";
import { Input } from "./ui";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Pick one client by surname, first name, phone or e-mail. Submits the
 * client's id as `name` (or the typed e-mail when nobody was picked).
 */
export function ClientSelect({
  clients,
  name,
  onPick,
}: {
  clients: ClientOpt[];
  name: string;
  /** Called with the picked client's id, or null when cleared. */
  onPick?: (id: string | null) => void;
}) {
  const [picked, setPicked] = useState<ClientOpt | null>(null);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return clients
      .filter((c) => {
        const hay = fold(`${c.label} ${c.sub}`);
        const flat = hay.replace(/\s+/g, "");
        return words.every((w) => hay.includes(w) || flat.includes(w));
      })
      .sort((a, b) => Number(!fold(a.label).startsWith(words[0])) - Number(!fold(b.label).startsWith(words[0])))
      .slice(0, 8);
  }, [clients, q]);

  // cleared together with the form after a successful submit
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    const reset = () => {
      setPicked(null);
      setQ("");
      onPick?.(null);
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [onPick]);

  const pick = (c: ClientOpt) => {
    setPicked(c);
    setQ("");
    onPick?.(c.id);
  };

  return (
    <div ref={box} className="space-y-2">
      <input type="hidden" name={name} value={picked?.id ?? q.trim()} />
      {picked ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-les px-4 py-2 text-sm text-krem">
          {picked.label} <span className="text-xs text-krem/60">{picked.sub}</span>
          <button
            type="button"
            aria-label="Vybrat jiného klienta"
            onClick={() => {
              setPicked(null);
              onPick?.(null);
            }}
          >
            <X className="size-4" />
          </button>
        </span>
      ) : (
        <>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits.length) {
                e.preventDefault();
                pick(hits[0]);
              }
            }}
            placeholder="Příjmení, jméno, telefon nebo e-mail…"
            aria-label="Klient"
            autoComplete="off"
          />
          {hits.length > 0 && (
            <ul className="divide-y divide-les/10 overflow-hidden rounded-lg border border-linka/60 bg-white">
              {hits.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => pick(c)} className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-krem">
                    <span className="font-medium">{c.label}</span>
                    <span className="truncate text-xs text-les/50">{c.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim() && !hits.length && <p className="text-xs text-les/50">Nikoho takového nenacházím.</p>}
        </>
      )}
    </div>
  );
}
