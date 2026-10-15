"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "./ui";

/**
 * "Studuji…" tick for the student drop-in: shown (and required) only while the
 * student option is picked in the surrounding booking form.
 */
export function StudentConfirm({ text }: { text: string }) {
  const ref = useRef<HTMLLabelElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const sync = () => setOn(!!form.querySelector('input[name="option"][data-student]:checked'));
    // React resets the form after an action – look again once it has
    const later = () => setTimeout(sync);
    sync();
    form.addEventListener("change", sync);
    form.addEventListener("reset", later);
    return () => {
      form.removeEventListener("change", sync);
      form.removeEventListener("reset", later);
    };
  }, []);
  return (
    <label ref={ref} className={cx("mt-4 gap-3 text-xs text-les/70", on ? "flex" : "hidden")}>
      <input type="checkbox" name="student" required={on} className="mt-0.5 size-4 shrink-0 accent-[#c9a26b]" />
      <span>{text}</span>
    </label>
  );
}
