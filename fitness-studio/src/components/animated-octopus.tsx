import { OCTOPUS_PARTS, OCTOPUS_VIEWBOX } from "./octopus-paths";
import { cx } from "./ui";

/**
 * Inline OCTOPUSH symbol whose six lower tentacles sway gently, each at its
 * own pace; the head (with the two upper tentacles) breathes. Pure CSS,
 * switched off for prefers-reduced-motion (see globals.css).
 */
export function AnimatedOctopus({ className }: { className?: string }) {
  let arm = 0;
  return (
    <svg viewBox={OCTOPUS_VIEWBOX} className={cx("block", className)} role="img" aria-label="OCTOPUSH">
      <defs>
        {/* same gold sweep as the logo, spread over the whole symbol */}
        <linearGradient id="octo-gold" x1="344" y1="0" x2="639" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D2A772" />
          <stop offset=".52" stopColor="#F7DBB4" />
          <stop offset="1" stopColor="#C19966" />
        </linearGradient>
      </defs>
      <g fill="url(#octo-gold)" fillRule="evenodd">
        {OCTOPUS_PARTS.map((p, i) => {
          if (p.kind !== "tentacle")
            return (
              <g key={i} transform="translate(492 190)">
                <g className="octo-head">
                  <path d={p.d} transform="translate(-492 -190)" />
                </g>
              </g>
            );
          const n = arm++;
          return (
            <g key={i} transform={`translate(${p.ox} ${p.oy})`}>
              <g
                className="octo-arm"
                style={
                  {
                    "--amp": `${p.side * (4 + (n % 3))}deg`,
                    "--dur": `${3.2 + (n % 4) * 0.45}s`,
                    "--delay": `${-n * 0.7}s`,
                  } as React.CSSProperties
                }
              >
                <path d={p.d} transform={`translate(${-p.ox} ${-p.oy})`} />
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
