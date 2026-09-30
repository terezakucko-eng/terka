import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cx } from "./ui";

export function AdminTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/**
 * Admin table. On phones every row turns into a card: the header row hides and
 * each cell shows its column name above the value – nothing scrolls sideways.
 */
export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  const rows = Children.map(children, (row) => {
    if (!isValidElement<{ children?: ReactNode }>(row) || row.type !== "tr") return row;
    const cells = Children.toArray(row.props.children).map((cell, i) =>
      isValidElement(cell) && cell.type === Td ? cloneElement(cell as ReactElement<TdProps>, { label: head[i] }) : cell,
    );
    return cloneElement(row, {}, cells);
  });
  return (
    <div className={cx("rounded-2xl border border-linka/60 bg-white/60 md:overflow-x-auto", className)}>
      <table className="w-full text-left text-sm max-md:block">
        <thead className="border-b border-linka/60 bg-krem/40 text-xs uppercase tracking-wider text-les/60 max-md:hidden">
          <tr>{head.map((h, i) => <th key={i} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-linka/40 max-md:block [&>tr]:max-md:block [&>tr]:max-md:px-4 [&>tr]:max-md:py-3">{rows}</tbody>
      </table>
    </div>
  );
}

type TdProps = { children?: ReactNode; className?: string; colSpan?: number; label?: ReactNode };

export function Td({ children, className, colSpan, label }: TdProps) {
  const empty = children === null || children === undefined || children === false || children === "";
  return (
    <td
      colSpan={colSpan}
      className={cx("px-4 py-3 align-top max-md:flex max-md:gap-3 max-md:px-0 max-md:py-1", empty && "max-md:hidden", className)}
    >
      {label && !empty && (
        <span className="w-24 shrink-0 pt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-les/45 md:hidden">{label}</span>
      )}
      <div className="min-w-0 max-md:flex-1">{children}</div>
    </td>
  );
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
