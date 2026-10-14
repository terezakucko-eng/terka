"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * Hover / focus tooltip for the charts inside: any element with `data-tip`
 * ("value\nlabel") shows it – the value first and strong, the label below.
 */
export function ChartTooltip({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ lines: string[]; x: number; y: number } | null>(null);

  const show = (el: Element | null, x?: number, y?: number) => {
    const mark = el?.closest("[data-tip]");
    if (!mark || !box.current) return setTip(null);
    const host = box.current.getBoundingClientRect();
    const r = mark.getBoundingClientRect();
    // keep the tooltip inside the chart
    const left = (x ?? r.left + r.width / 2) - host.left;
    setTip({
      lines: (mark.getAttribute("data-tip") ?? "").split("\n"),
      x: Math.max(70, Math.min(left, host.width - 70)),
      y: (y ?? r.top) - host.top,
    });
  };

  return (
    <div
      ref={box}
      className={`relative ${className ?? ""}`}
      onPointerMove={(e) => show(e.target as Element, e.clientX, e.clientY)}
      onPointerLeave={() => setTip(null)}
      onFocus={(e) => show(e.target as Element)}
      onBlur={() => setTip(null)}
    >
      {children}
      {tip && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-les px-3 py-2 text-xs text-papir shadow-lg"
          style={{ left: tip.x, top: tip.y - 10 }}
        >
          <strong className="block text-sm">{tip.lines[0]}</strong>
          {tip.lines.slice(1).map((l, i) => (
            <span key={i} className="block text-papir/70">{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
