import type { ReactNode } from "react";
import { cx } from "./ui";

export function AdminTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto rounded-2xl border border-linka/60 bg-white/60", className)}>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-linka/60 bg-krem/40 text-xs uppercase tracking-wider text-les/60">
          <tr>{head.map((h, i) => <th key={i} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-linka/40">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("px-4 py-3 align-top", className)}>{children}</td>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-linka/60 bg-white/60 p-5">
      <p className="eyebrow text-les/60">{label}</p>
      <p className="mt-2 text-3xl font-light tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-les/50">{sub}</p>}
    </div>
  );
}

/** Collapsible panel for create/edit forms. */
export function Panel({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-linka/60 bg-white/60">
      <summary className="cursor-pointer list-none px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
        <span className="mr-2 inline-block transition group-open:rotate-90">›</span>
        {title}
      </summary>
      <div className="border-t border-linka/60 p-5">{children}</div>
    </details>
  );
}
