import Image from "next/image";
import Link from "next/link";
import { site } from "@/config/site";
import { cx } from "./ui";

export function Wordmark({
  tone = "gold",
  className,
}: {
  tone?: "gold" | "green";
  className?: string;
}) {
  return (
    <Image
      src={`/brand/wordmark-${tone}.svg`}
      alt={site.name}
      width={410}
      height={65}
      priority
      className={cx("h-auto", className)}
    />
  );
}

export function Symbol({
  tone = "gold",
  className,
}: {
  tone?: "gold" | "green";
  className?: string;
}) {
  return (
    <Image
      src={`/brand/symbol-${tone}.svg`}
      alt=""
      width={340}
      height={290}
      className={cx("h-auto", className)}
    />
  );
}

export function LogoLink({ tone = "gold" }: { tone?: "gold" | "green" }) {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label={`${site.name} – úvod`}>
      <Symbol tone={tone} className="w-9" />
      <Wordmark tone={tone} className="w-32 sm:w-36" />
    </Link>
  );
}
