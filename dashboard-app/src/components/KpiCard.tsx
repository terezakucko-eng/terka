import type { Kpi } from '../data'
import { ArrowUp, ArrowDown } from './Icons'

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const up = kpi.deltaPct >= 0
  const source = kpi.hint.startsWith('Power BI') ? 'pbi' : 'ga4'
  return (
    <div className="fade-up rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{kpi.label}</span>
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            source === 'pbi' ? 'bg-[#f2c811]' : 'bg-[#e8710a]'
          }`}
          title={kpi.hint}
        />
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
        {kpi.value}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-sm">
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
            up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(kpi.deltaPct).toFixed(1)} %
        </span>
        <span className="text-xs text-slate-400">vs. předchozí období</span>
      </div>
    </div>
  )
}
