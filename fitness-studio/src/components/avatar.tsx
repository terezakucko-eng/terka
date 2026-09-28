import { initials, parseAvatar } from "@/lib/profile";
import { cx } from "./ui";

/** Round profile picture: photo, picked emoji avatar, or initials. */
export function Avatar({
  user,
  size = 40,
  className,
}: {
  user: { name: string; avatar?: string | null };
  size?: number;
  className?: string;
}) {
  const a = parseAvatar(user.avatar);
  const style = { width: size, height: size, fontSize: size * (a.kind === "emoji" ? 0.55 : 0.38) };
  const base = cx("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", className);
  if (a.kind === "photo")
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.url} alt="" width={size} height={size} className={cx(base, "object-cover")} style={style} />;
  if (a.kind === "emoji")
    return <span aria-hidden className={cx(base, "bg-zlato/20")} style={style}>{a.emoji}</span>;
  return (
    <span aria-hidden className={cx(base, "bg-mech font-semibold text-zlato-light")} style={style}>
      {initials(user.name)}
    </span>
  );
}
