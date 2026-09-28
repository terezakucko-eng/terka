"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Input } from "./ui";

export type ClientOpt = { id: string; label: string; sub: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Search clients by name, phone or e-mail and tick the ones who get the message. */
export function ClientPicker({ clients, initial }: { clients: ClientOpt[]; initial: string[] }) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const hits = useMemo(() => {
    const needle = fold(q.trim()).replace(/\s+/g, "");
    if (!needle) return [];
    return clients
      .filter((c) => !picked.includes(c.id) && fold(c.label + c.sub).replace(/\s+/g, "").includes(needle))
      .slice(0, 8);
  }, [clients, q, picked]);

  return (
    <div className="space-y-3 rounded-xl bg-krem/40 p-4">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledej jméno, telefon nebo e-mail…" />
      {hits.length > 0 && (
        <ul className="divide-y divide-les/10 rounded-lg bg-white/70">
          {hits.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => { setPicked((p) => [...p, c.id]); setQ(""); }}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-krem"
              >
                <span className="font-medium">{c.label}</span>
                <span className="text-xs text-les/50">{c.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && !hits.length && <p className="text-xs text-les/50">Nikoho takového nenacházím.</p>}
      <div className="flex flex-wrap gap-2">
        {picked.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-les px-3 py-1 text-xs text-krem">
            <input type="hidden" name="userIds" value={id} />
            {byId.get(id)?.label ?? "?"}
            <button type="button" aria-label="Odebrat" onClick={() => setPicked((p) => p.filter((x) => x !== id))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {!picked.length && <p className="text-xs text-les/50">Zatím nikdo vybraný.</p>}
      </div>
    </div>
  );
}
