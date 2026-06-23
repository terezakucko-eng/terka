// ============================================================================
//  UKÁZKOVÁ (mock) data pro KPI karty a grafy.
//  Slouží k tomu, aby dashboard "žil", než se napojí reálné API.
//  Reálná GA4/Power BI data se zobrazují přes embedované reporty (viz config.ts),
//  KPI karty níže jdou později nahradit živým API proxy (viz README).
// ============================================================================

export type RangeKey = '7d' | '28d' | '90d'

export interface Kpi {
  label: string
  value: string
  deltaPct: number // meziroční/meziobdobní změna v %
  hint: string
}

export interface SeriesPoint {
  date: string // 'DD.MM.'
  sessions: number
  users: number
}

export interface Channel {
  name: string
  sessions: number
  color: string
}

export interface DashboardData {
  kpis: Kpi[]
  series: SeriesPoint[]
  channels: Channel[]
}

function makeSeries(days: number, base: number, spread: number): SeriesPoint[] {
  const out: SeriesPoint[] = []
  const today = new Date('2026-06-23')
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    // deterministický pseudonáhodný průběh, ať se data nemění při každém renderu
    const wave = Math.sin(i / 3) * 0.35 + Math.cos(i / 7) * 0.2
    const sessions = Math.round(base * (1 + wave) + ((i * 37) % spread))
    out.push({
      date: `${d.getDate()}.${d.getMonth() + 1}.`,
      sessions,
      users: Math.round(sessions * 0.78),
    })
  }
  return out
}

export const mockData: Record<RangeKey, DashboardData> = {
  '7d': {
    kpis: [
      { label: 'Uživatelé', value: '4 812', deltaPct: 12.4, hint: 'GA4 · totalUsers' },
      { label: 'Návštěvy (sessions)', value: '6 137', deltaPct: 9.1, hint: 'GA4 · sessions' },
      { label: 'Míra zapojení', value: '58,3 %', deltaPct: 3.2, hint: 'GA4 · engagementRate' },
      { label: 'Konverze', value: '214', deltaPct: -4.7, hint: 'GA4 · conversions' },
      { label: 'Tržby', value: '312 480 Kč', deltaPct: 18.6, hint: 'Power BI · Revenue' },
      { label: 'Prům. hodnota obj.', value: '1 460 Kč', deltaPct: 5.3, hint: 'Power BI · AOV' },
    ],
    series: makeSeries(7, 820, 120),
    channels: [
      { name: 'Organic Search', sessions: 2240, color: '#4f46e5' },
      { name: 'Paid Search', sessions: 1380, color: '#e8710a' },
      { name: 'Direct', sessions: 1020, color: '#0ea5e9' },
      { name: 'Social', sessions: 940, color: '#ec4899' },
      { name: 'Referral', sessions: 557, color: '#10b981' },
    ],
  },
  '28d': {
    kpis: [
      { label: 'Uživatelé', value: '19 540', deltaPct: 8.7, hint: 'GA4 · totalUsers' },
      { label: 'Návštěvy (sessions)', value: '25 110', deltaPct: 6.4, hint: 'GA4 · sessions' },
      { label: 'Míra zapojení', value: '56,9 %', deltaPct: 1.8, hint: 'GA4 · engagementRate' },
      { label: 'Konverze', value: '892', deltaPct: 7.2, hint: 'GA4 · conversions' },
      { label: 'Tržby', value: '1 284 900 Kč', deltaPct: 14.1, hint: 'Power BI · Revenue' },
      { label: 'Prům. hodnota obj.', value: '1 440 Kč', deltaPct: 2.1, hint: 'Power BI · AOV' },
    ],
    series: makeSeries(28, 780, 160),
    channels: [
      { name: 'Organic Search', sessions: 9120, color: '#4f46e5' },
      { name: 'Paid Search', sessions: 5680, color: '#e8710a' },
      { name: 'Direct', sessions: 4210, color: '#0ea5e9' },
      { name: 'Social', sessions: 3760, color: '#ec4899' },
      { name: 'Referral', sessions: 2340, color: '#10b981' },
    ],
  },
  '90d': {
    kpis: [
      { label: 'Uživatelé', value: '61 280', deltaPct: 11.2, hint: 'GA4 · totalUsers' },
      { label: 'Návštěvy (sessions)', value: '79 940', deltaPct: 9.9, hint: 'GA4 · sessions' },
      { label: 'Míra zapojení', value: '57,4 %', deltaPct: 2.6, hint: 'GA4 · engagementRate' },
      { label: 'Konverze', value: '2 870', deltaPct: 10.4, hint: 'GA4 · conversions' },
      { label: 'Tržby', value: '4 102 350 Kč', deltaPct: 16.8, hint: 'Power BI · Revenue' },
      { label: 'Prům. hodnota obj.', value: '1 429 Kč', deltaPct: 3.4, hint: 'Power BI · AOV' },
    ],
    series: makeSeries(90, 760, 200),
    channels: [
      { name: 'Organic Search', sessions: 28900, color: '#4f46e5' },
      { name: 'Paid Search', sessions: 18200, color: '#e8710a' },
      { name: 'Direct', sessions: 13400, color: '#0ea5e9' },
      { name: 'Social', sessions: 11900, color: '#ec4899' },
      { name: 'Referral', sessions: 7540, color: '#10b981' },
    ],
  },
}
