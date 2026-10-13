"use client";

import { useState } from "react";
import { buttonClass } from "./ui";

/** Copies a text (e.g. a calendar address) and says so for a moment. */
export function CopyButton({ text, label = "Kopírovat odkaz", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("outline", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Zkopíruj si odkaz:", text);
        }
      }}
    >
      {done ? "Zkopírováno ✓" : label}
    </button>
  );
}
