"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cx } from "./ui";

/** Read-only star row. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cx("inline-flex gap-0.5 text-zlato", className)} aria-label={`${rating} z 5 hvězdiček`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cx("size-4", i <= Math.round(rating) ? "fill-current" : "opacity-30")} aria-hidden />
      ))}
    </span>
  );
}

/** 1–5 star picker, submits `name`. */
export function StarInput({ name, defaultValue = 0 }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Hodnocení">
      <input type="hidden" name={name} value={value || ""} />
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} z 5`}
          onClick={() => setValue(i)}
          onMouseEnter={() => setHover(i)}
          className="p-0.5 text-zlato transition hover:scale-110"
        >
          <Star className={cx("size-8", i <= shown ? "fill-current" : "opacity-30")} aria-hidden />
        </button>
      ))}
    </div>
  );
}
