"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/push";
import { InstallGuide } from "./install-guide";
import { cx } from "./ui";

type State = "loading" | "unsupported" | "ios-home" | "denied" | "off" | "on";

const noSubscribe = () => () => {};
const support = (): "yes" | "no" | "ios-home" => {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  if (ios && !standalone) return "ios-home"; // iPhone allows web push only from the home-screen app
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window ? "yes" : "no";
};

function keyBytes(base64: string) {
  const b64 = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Turn push notifications on/off for this device. */
export function PushToggle({ publicKey, className }: { publicKey: string; className?: string }) {
  const supported = useSyncExternalStore(noSubscribe, support, () => "no" as const);
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (supported !== "yes") return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(Notification.permission === "denied" ? "denied" : sub ? "on" : "off"))
      .catch(() => setState("unsupported"));
  }, [supported]);

  const shown: State = supported === "no" ? "unsupported" : supported === "ios-home" ? "ios-home" : state;

  async function enable() {
    setBusy(true);
    setMsg("");
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      // the browser's push service (Google / Apple / Mozilla) sometimes doesn't answer – don't spin forever
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 20_000));
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await Promise.race([reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }), timeout]));
      await savePushSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      setState("on");
      setMsg("Hotovo – upozornění ti budou chodit do tohohle zařízení.");
    } catch {
      setMsg("Zapnout se to nepovedlo. Zkus to prosím znovu – případně v jiném prohlížeči (anonymní okno upozornění neumí).");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setMsg("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cx("space-y-2 text-sm", className)}>
      {shown === "loading" && <p className="text-les/50">Zjišťuji, jestli tohle zařízení umí upozornění…</p>}
      {shown === "unsupported" && <p className="text-les/60">Tenhle prohlížeč upozornění neumí. Zkus Chrome, Edge, Firefox nebo Safari.</p>}
      {shown === "ios-home" && (
        <div className="text-les/70">
          <p>Na iPhonu fungují upozornění jen z aplikace na ploše. Přidej si OCTOPUSH na plochu:</p>
          <InstallGuide only={["ios"]} after="Pak otevři OCTOPUSH z plochy a upozornění tady zapni." />
        </div>
      )}
      {shown === "denied" && (
        <p className="text-les/70">Upozornění máš pro tenhle web zakázaná. Povol je v nastavení prohlížeče (ikona zámku vedle adresy) a zkus to znovu.</p>
      )}
      {(shown === "off" || shown === "on") && (
        <button
          type="button"
          role="switch"
          aria-checked={shown === "on"}
          onClick={shown === "on" ? disable : enable}
          disabled={busy}
          className="flex w-full items-center justify-between gap-4 rounded-2xl border border-linka/60 bg-white/60 px-4 py-3 text-left disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            {shown === "on" ? <Bell className="size-5 text-ok" /> : <BellOff className="size-5 text-les/40" />}
            <span>
              <span className="block font-semibold">Upozornění</span>
              <span className="block text-xs text-les/60">
                {busy ? (shown === "on" ? "Vypínám…" : "Zapínám…") : shown === "on" ? "Zapnuto v tomhle zařízení" : "Vypnuto"}
              </span>
            </span>
          </span>
          <span
            aria-hidden
            className={cx(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              shown === "on" ? "bg-ok" : "bg-linka",
            )}
          >
            <span
              className={cx(
                "absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform",
                shown === "on" ? "translate-x-[1.375rem]" : "translate-x-0.5",
              )}
            />
          </span>
        </button>
      )}
      {msg && <p className="text-xs text-les/70">{msg}</p>}
    </div>
  );
}
