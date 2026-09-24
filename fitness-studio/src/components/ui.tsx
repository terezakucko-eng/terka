import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { extendTailwindMerge } from "tailwind-merge";

// knows our custom utilities so `bg-forest` overrides `bg-white/50` etc.
const merge = extendTailwindMerge({
  extend: { classGroups: { "bg-color": ["bg-forest", "bg-gold"], "text-color": ["text-gold"] } },
});

/** Joins classes; later ones win on conflict (e.g. a Card's background). */
export function cx(...c: (string | false | null | undefined)[]) {
  return merge(c.filter(Boolean).join(" "));
}

type Variant = "gold" | "dark" | "outline" | "outline-light" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  gold: "bg-gold text-les hover:brightness-105 shadow-[0_8px_24px_-12px_rgba(210,167,114,.8)]",
  dark: "bg-les text-papir hover:bg-mech",
  outline: "border border-les/30 text-les hover:border-les hover:bg-les hover:text-papir",
  "outline-light": "border border-zlato/50 text-zlato-light hover:bg-zlato hover:text-les",
  ghost: "text-les hover:bg-les/5",
  danger: "border border-chyba/40 text-chyba hover:bg-chyba hover:text-papir",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition disabled:opacity-50 disabled:pointer-events-none";

export function buttonClass(variant: Variant = "dark", extra?: string) {
  return cx(base, variants[variant], extra);
}

export function Button({
  variant = "dark",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "dark",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

/** Editorial label – „01 / PŘÍRODA" */
export function Eyebrow({
  n,
  children,
  className,
}: {
  n?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cx("eyebrow", className)}>
      {n && <span className="mr-2">{n} /</span>}
      {children}
    </p>
  );
}

export function Container({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("mx-auto w-full max-w-6xl px-4 sm:px-6", className)} {...p} />;
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-linka/60">
      <Container className="py-12 sm:py-16">
        <Eyebrow className="text-zeme">{eyebrow}</Eyebrow>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">{title}</h1>
        {children && <div className="mt-5 max-w-2xl text-lg text-les/70">{children}</div>}
      </Container>
    </section>
  );
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return (
    <div
      className={cx("rounded-2xl border border-linka/60 bg-white/50 p-5 sm:p-6", className)}
      {...p}
    />
  );
}

type Tone = "neutral" | "gold" | "green" | "red" | "dark" | "solid";
const tones: Record<Tone, string> = {
  neutral: "bg-krem/70 text-les",
  gold: "bg-zlato/25 text-zeme",
  green: "bg-salvej/15 text-ok",
  red: "bg-chyba/10 text-chyba",
  dark: "bg-les text-zlato-light",
  solid: "bg-gold text-les",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export const inputClass =
  "w-full rounded-xl border border-linka bg-white/70 px-4 py-3 text-sm text-les placeholder:text-les/40 focus:border-zlato focus:outline-none focus:ring-2 focus:ring-zlato/30";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-les/70">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-les/50">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={4} {...props} className={cx(inputClass, props.className)} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-linka px-6 py-10 text-center text-sm text-les/60">
      {children}
    </p>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx("border-linka/60", className)} />;
}
