"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/push";
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

  const btn = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-50";
  return (
    <div className={cx("space-y-2 text-sm", className)}>
      {shown === "loading" && <p className="text-les/50">Zjišťuji, jestli tohle zařízení umí upozornění…</p>}
      {shown === "unsupported" && <p className="text-les/60">Tenhle prohlížeč upozornění neumí. Zkus Chrome, Edge, Firefox nebo Safari.</p>}
      {shown === "ios-home" && (
        <p className="text-les/70">
          Na iPhonu fungují upozornění jen z aplikace na ploše: v Safari klepni na <strong>Sdílet</strong> →{" "}
          <strong>Přidat na plochu</strong>, otevři OCTOPUSH z plochy a tady je zapni.
        </p>
      )}
      {shown === "denied" && (
        <p className="text-les/70">Upozornění máš pro tenhle web zakázaná. Povol je v nastavení prohlížeče (ikona zámku vedle adresy) a zkus to znovu.</p>
      )}
      {shown === "off" && (
        <button type="button" onClick={enable} disabled={busy} className={cx(btn, "bg-les text-papir")}>
          <Bell className="size-4" /> {busy ? "Zapínám…" : "Zapnout upozornění"}
        </button>
      )}
      {shown === "on" && (
        <p className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 font-semibold text-ok"><Bell className="size-4" /> Upozornění jsou zapnutá</span>
          <button type="button" onClick={disable} disabled={busy} className={cx(btn, "border border-linka text-les/70")}>
            <BellOff className="size-4" /> Vypnout
          </button>
        </p>
      )}
      {msg && <p className="text-xs text-les/70">{msg}</p>}
    </div>
  );
}
