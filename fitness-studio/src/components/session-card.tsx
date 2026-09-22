import Link from "next/link";
import type { ScheduleItem } from "@/lib/queries";
import { formatRange } from "@/lib/dates";
import { Badge, cx } from "./ui";

export function spotsLabel(s: ScheduleItem, now = new Date()) {
  if (s.status === "cancelled") return { text: "Zrušeno", tone: "red" as const };
  if (s.startsAt <= now) return { text: "Proběhlo", tone: "neutral" as const };
  const left = s.capacity - s.occupied;
  if (left <= 0) return { text: "Plno · pořadník", tone: "red" as const };
  if (left <= 2) return { text: `Poslední ${left === 1 ? "místo" : "2 místa"}`, tone: "gold" as const };
  return { text: `Volno ${left}/${s.capacity}`, tone: "green" as const };
}

const myLabel: Record<string, string> = {
  confirmed: "Rezervováno",
  pending_payment: "Čeká na platbu",
  waitlist: "V pořadníku",
  attended: "Byl/a jsi",
  no_show: "Nedorazil/a",
};

export function SessionCard({ s, compact }: { s: ScheduleItem; compact?: boolean }) {
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
        ) : (
          <Badge tone={spots.tone}>{spots.text}</Badge>
        )}
        {s.isFree && s.status !== "cancelled" && <Badge tone="gold">Zdarma</Badge>}
      </div>
    </Link>
  );
}
