"use client";

import { Children, useEffect, useState, type ReactNode } from "react";

/**
 * Photos that take turns in one frame with a slow cross-fade (the home page hero).
 * The first one is in the page from the start; with one photo nothing moves, and
 * nothing moves either for those who ask for less motion.
 */
export function HeroSlides({ children, seconds = 3 }: { children: ReactNode; seconds?: number }) {
  const slides = Children.toArray(children);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!document.hidden) setCurrent((i) => (i + 1) % slides.length);
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [slides.length, seconds]);

  return slides.map((slide, i) => (
    <div
      key={i}
      aria-hidden={i !== current}
      className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
      style={{ opacity: i === current ? 1 : 0 }}
    >
      {slide}
    </div>
  ));
}
