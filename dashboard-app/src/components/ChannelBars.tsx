import type { Channel } from '../data'

// Horizontální pruhový graf kanálů (akviziční kanály z GA4).
export function ChannelBars({ channels }: { channels: Channel[] }) {
  const max = Math.max(...channels.map((c) => c.sessions))
  const total = channels.reduce((s, c) => s + c.sessions, 0)

  return (
    <div className="space-y-3">
      {channels.map((c) => {
        const pct = (c.sessions / total) * 100
        return (
          <div key={c.name}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{c.name}</span>
              <span className="tabular-nums text-slate-500">
                {c.sessions.toLocaleString('cs-CZ')}{' '}
                <span className="text-slate-400">({pct.toFixed(1)} %)</span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(c.sessions / max) * 100}%`, background: c.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
