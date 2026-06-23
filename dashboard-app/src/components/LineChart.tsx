import { useId } from 'react'
import type { SeriesPoint } from '../data'

// Jednoduchý SVG spojnicový graf (sessions + users), bez externí knihovny.
export function LineChart({ data }: { data: SeriesPoint[] }) {
  const gradId = useId()
  const W = 760
  const H = 240
  const PAD = { top: 16, right: 16, bottom: 28, left: 40 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const max = Math.max(...data.map((d) => d.sessions)) * 1.15
  const x = (i: number) => PAD.left + (i / Math.max(1, data.length - 1)) * innerW
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH

  const line = (key: 'sessions' | 'users') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ')

  const area = `${line('sessions')} L ${x(data.length - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`

  // max 7 popisků na ose X, ať se nepřekrývají
  const step = Math.ceil(data.length / 7)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Vývoj návštěvnosti">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const gy = PAD.top + innerH * t
        return (
          <g key={t}>
            <line x1={PAD.left} y1={gy} x2={W - PAD.right} y2={gy} stroke="#eef0f5" strokeWidth="1" />
            <text x={PAD.left - 8} y={gy + 4} textAnchor="end" className="fill-slate-400" fontSize="10">
              {Math.round((max * (1 - t)) / 100) * 100}
            </text>
          </g>
        )
      })}

      <path d={area} fill={`url(#${gradId})`} />
      <path d={line('sessions')} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={line('users')} fill="none" stroke="#818cf8" strokeWidth="2" strokeDasharray="4 4" strokeLinejoin="round" />

      {data.map((d, i) =>
        i % step === 0 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400" fontSize="10">
            {d.date}
          </text>
        ) : null,
      )}
    </svg>
  )
}
