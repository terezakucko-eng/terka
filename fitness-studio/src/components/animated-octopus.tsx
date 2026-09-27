import { OCTOPUS_PARTS, OCTOPUS_VIEWBOX } from "./octopus-paths";
import { cx } from "./ui";

/**
 * Inline OCTOPUSH symbol that swims like a real octopus: the mantle squeezes,
 * the tentacles pull in together (middle ones first, tips trailing behind)
 * and slowly open again while the body glides. A slow extra sway per arm keeps
 * it from looking mechanical. Pure CSS, off for prefers-reduced-motion.
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
          // positive rotation swings a hanging arm's tip to the left = outward for left arms
          const out = -p.side;
          const fromMiddle = Math.abs(p.ox - 492);
          return (
            <g key={i} transform={`translate(${p.ox} ${p.oy})`}>
              <g
                className="octo-arm"
                style={
                  {
                    "--amp": `${out * (1.5 + (n % 3) * 0.6)}deg`,
                    "--dur": `${3.1 + (n % 4) * 0.55}s`,
                    "--delay": `${-n * 0.9}s`,
                  } as React.CSSProperties
                }
              >
                <g
                  className="octo-pulse"
                  style={
                    {
                      "--k": `${out * (5 + fromMiddle / 6)}deg`,
                      "--lag": `${(fromMiddle / 22) * 0.09}s`,
                    } as React.CSSProperties
                  }
                >
                  <path d={p.d} transform={`translate(${-p.ox} ${-p.oy})`} />
                </g>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
