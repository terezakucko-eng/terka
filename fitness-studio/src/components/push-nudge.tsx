"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { enablePush, usePushSupport } from "./push-toggle";

const DISMISSED = "octo-push-nudge";
const ASK_AGAIN_MS = 30 * 86_400_000;

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || !!(navigator as { standalone?: boolean }).standalone;

/**
 * When a logged-in client opens OCTOPUSH from the home screen and hasn't
 * decided about notifications yet, offer them right there – one tap. The
 * switch in Profil stays for changing it later.
 */
export function PushNudge({ publicKey }: { publicKey: string }) {
  const supported = usePushSupport();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (supported !== "yes" || !standalone() || Notification.permission !== "default") return;
    try {
      const at = Number(localStorage.getItem(DISMISSED));
      if (at && Date.now() - at < ASK_AGAIN_MS) return;
    } catch {}
    let alive = true;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => alive && !sub && setOpen(true))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [supported]);

  function close() {
    try {
      localStorage.setItem(DISMISSED, String(Date.now()));
    } catch {}
    setOpen(false);
  }

  async function turnOn() {
    setBusy(true);
    setMsg("");
    try {
      await enablePush(publicKey);
      setOpen(false); // allowed or refused, the browser has now remembered the answer
    } catch {
      setMsg("Nepovedlo se – zkus to prosím znovu, nebo později v Profilu.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div role="dialog" aria-label="Zapnout upozornění" className="relative mx-auto max-w-md rounded-3xl bg-les p-5 text-papir shadow-2xl">
        <button type="button" onClick={close} aria-label="Zavřít" className="absolute right-4 top-4 text-papir/50 hover:text-papir">
          <X className="size-5" />
        </button>
        <p className="flex items-center gap-2 pr-8 font-semibold">
          <Bell className="size-5 text-zlato" /> Zapnout upozornění?
        </p>
        <p className="mt-2 text-sm text-papir/75">Připomeneme ti lekci a dáme vědět, když se uvolní místo z pořadníku nebo se lekce ruší.</p>
        {msg && <p className="mt-2 text-xs text-papir/75">{msg}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={turnOn}
            disabled={busy}
            className="flex-1 rounded-full bg-zlato px-4 py-3 text-xs font-semibold uppercase tracking-wider text-les disabled:opacity-60"
          >
            {busy ? "Zapínám…" : "Zapnout"}
          </button>
          <button type="button" onClick={close} className="rounded-full border border-papir/30 px-4 py-3 text-xs font-semibold uppercase tracking-wider">
            Teď ne
          </button>
        </div>
      </div>
    </div>
  );
}
