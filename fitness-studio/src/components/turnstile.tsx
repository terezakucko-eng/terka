"use client";

import { useEffect, useRef } from "react";

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  let s = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
  if (!s) {
    s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    document.head.appendChild(s);
  }
  return new Promise<void>((resolve) => s.addEventListener("load", () => resolve(), { once: true }));
}

/**
 * Cloudflare Turnstile – an (almost always invisible) "are you human" check.
 * Adds the hidden `cf-turnstile-response` field to the surrounding form; a token
 * is single-use, so the widget gets a fresh one after every submit.
 */
export function TurnstileWidget({ siteKey }: { siteKey: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let id: string | undefined;
    let alive = true;
    const form = el.closest("form");
    const refresh = () => setTimeout(() => id && window.turnstile?.reset(id), 500);
    loadScript().then(() => {
      if (!alive || !window.turnstile) return;
      id = window.turnstile.render(el, { sitekey: siteKey, language: "cs", appearance: "interaction-only" });
      form?.addEventListener("submit", refresh);
    });
    return () => {
      alive = false;
      form?.removeEventListener("submit", refresh);
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey]);

  return <div ref={box} />;
}
