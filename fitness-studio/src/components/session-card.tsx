import Link from "next/link";
import type { ScheduleItem } from "@/lib/queries";
import { formatOpens, formatRange } from "@/lib/dates";
import { Badge, cx } from "./ui";

/**
 * Clients see only how busy a class is, never the exact numbers. "Last spots"
 * only makes sense for group classes – an individual session (1–2 people) is
 * simply free or taken.
 */
export function availabilityText(left: number, capacity: number) {
  if (capacity <= 2) return left > 0 ? "Volno" : "Obsazeno";
  if (left <= 0) return "Obsazeno (náhradníci)";
  if (left === 1) return "Poslední 1 místo";
  if (left === 2) return "Poslední 2 místa";
  return "Volno";
}

export function spotsLabel(s: ScheduleItem, now = new Date()) {
  if (s.status === "cancelled") return { text: "Zrušeno", tone: "red" as const };
  if (s.startsAt <= now) return { text: "Proběhlo", tone: "neutral" as const };
  const left = s.capacity - s.occupied;
  const text = availabilityText(left, s.capacity);
  const tone = left <= 0 ? "red" : left <= 2 && s.capacity > 2 ? "gold" : "green";
  return { text, tone: tone as "red" | "gold" | "green" };
}

const myLabel: Record<string, string> = {
  confirmed: "Rezervováno",
  pending_payment: "Čeká na platbu",
  waitlist: "V pořadníku",
  attended: "Byl/a jsi",
  no_show: "Nedorazil/a",
};

/** `opensAt`: the class is beyond this viewer's booking window – show when booking opens instead. */
export function SessionCard({ s, compact, opensAt }: { s: ScheduleItem; compact?: boolean; opensAt?: Date | null }) {
  const spots = spotsLabel(s);
  const past = s.startsAt <= new Date() || s.status === "cancelled";
  return (
    <Link
      href={`/rozvrh/${s.id}`}
      className={cx(
        "group block rounded-2xl border border-linka/60 bg-white/60 p-4 transition hover:-translate-y-0.5 hover:border-zlato hover:shadow-[0_12px_30px_-18px_rgba(21,26,19,.5)]",
        past && "opacity-55",
        s.myStatus && "border-zlato bg-zlato/10",
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: s.classType.color }}
    >
      <p className="text-xs font-semibold tabular-nums text-les/60">
        {formatRange(s.startsAt, s.durationMin)}
      </p>
      <p className={cx("mt-1 font-semibold leading-tight", !compact && "text-lg")}>
        {s.classType.name}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {s.myStatus ? (
          <Badge tone="dark">{myLabel[s.myStatus] ?? s.myStatus}</Badge>
        ) : opensAt ? (
          <Badge>Rezervace možná od{"\u00a0"}{formatOpens(opensAt)}</Badge>
        ) : (
          <Badge tone={spots.tone}>{spots.text}</Badge>
        )}
        {s.isFree && s.status !== "cancelled" && <Badge tone="gold">Zdarma</Badge>}
      </div>
    </Link>
  );
}
