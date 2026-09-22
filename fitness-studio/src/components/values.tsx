import { Compass, Dumbbell, HeartPulse, PersonStanding, Salad, Sun, Users } from "lucide-react";
import { site } from "@/config/site";

function YinYang({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a5 5 0 0 1 0 10a5 5 0 0 0 0 10" />
      <circle cx="12" cy="7" r="1" fill="currentColor" />
      <circle cx="12" cy="17" r="1" />
    </svg>
  );
}

const icons = [Compass, Dumbbell, HeartPulse, Salad, Users, Sun, YinYang, PersonStanding];

/** The eight brand values from the moodboard. */
export function Values() {
  return (
    <ul className="grid grid-cols-2 gap-y-10 sm:grid-cols-4 lg:grid-cols-8">
      {site.values.map((v, i) => {
        const Icon = icons[i];
        return (
          <li key={v.title} className="flex flex-col items-center text-center lg:border-l lg:border-linka/60 lg:first:border-l-0">
            <span className="flex size-16 items-center justify-center rounded-full border border-les/70">
              <Icon className="size-7" strokeWidth={1.4} />
            </span>
            <span className="mt-4 text-xs font-bold uppercase tracking-[0.2em]">{v.title}</span>
            <span className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-les/60">{v.sub}</span>
          </li>
        );
      })}
    </ul>
  );
}
