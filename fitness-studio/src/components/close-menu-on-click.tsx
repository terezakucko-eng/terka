"use client";

import { useEffect, useRef } from "react";

/** Closes the surrounding <details> menu when a link inside it is tapped (client-side navigation keeps it open otherwise). */
export function CloseMenuOnClick() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const details = ref.current?.closest("details");
    if (!details) return;
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a")) details.open = false;
    };
    details.addEventListener("click", onClick);
    return () => details.removeEventListener("click", onClick);
  }, []);
  return <span ref={ref} hidden />;
}
