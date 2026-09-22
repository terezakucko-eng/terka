"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sendBatchAction } from "@/app/admin/messaging-actions";

/** Drives sending in small batches while the page is open. */
export function CampaignRunner({ id, total, sent }: { id: string; total: number; sent: number }) {
  const router = useRouter();
  const [done, setDone] = useState(sent);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (running.current) return;
    running.current = true;
    (async () => {
      for (;;) {
        const r = await sendBatchAction(id);
        if (r.error) {
          setError(r.error);
          break;
        }
        setDone((d) => d + r.sent + r.failed);
        if (!r.remaining) break;
      }
      router.refresh();
    })();
  }, [id, router]);

  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-zlato bg-white/60 p-5">
      <p className="font-semibold">Odesílám… {done} / {total}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-krem">
        <div className="bg-gold h-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-les/60">Nech stránku otevřenou, dokud se nedokončí. Když ji zavřeš, pokračuje se po návratu (nebo v noci automaticky).</p>
      {error && <p className="mt-3 text-sm text-chyba">{error}</p>}
    </div>
  );
}
