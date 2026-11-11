import { cx } from "./ui";

/** The pink ribbon marking a charity class in the schedule. */
export function Ribbon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Benefiční lekce" className={cx("inline-block shrink-0", className)}>
      <title>Benefiční lekce</title>
      <path
        fillRule="evenodd"
        fill="#e8559a"
        d="M12 1.5c-2.4 0-4 1.9-4 4.3 0 2 1.1 4.1 2.4 6.1L5.6 19.8l2.9 2.4 3.5-5.5 3.5 5.5 2.9-2.4-4.8-7.9c1.3-2 2.4-4.1 2.4-6.1 0-2.4-1.6-4.3-4-4.3Zm0 2.4c1 0 1.5.9 1.5 2 0 1.2-.6 2.6-1.5 4-.9-1.4-1.5-2.8-1.5-4 0-1.1.5-2 1.5-2Z"
      />
    </svg>
  );
}
