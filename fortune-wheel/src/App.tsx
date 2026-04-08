import { useState, useRef, useCallback, useEffect } from 'react'

const MAX_VISIBLE = 20

// Pastel pink palette for segments
const COLORS = [
  '#dc004e', '#f9e2ea', '#f06292', '#fce4ec',
  '#ec407a', '#f8bbd0', '#d81b60', '#fff0f5',
  '#e91e63', '#fce4ec', '#f48fb1', '#fff5f8',
  '#c2185b', '#f8bbd0', '#ff4081', '#fce4ec',
  '#ad1457', '#f9e2ea', '#e91e63', '#fff0f5',
]

function segColor(i: number) { return COLORS[i % COLORS.length] }
function textColor(bg: string) {
  return ['#fce4ec','#f8bbd0','#fff0f5','#f9e2ea','#fff5f8'].includes(bg) ? '#c2185b' : '#ffffff'
}

interface Confetti { left: string; bg: string; delay: string; dur: string; r: string; w: string; h: string }
function makeConfetti(): Confetti[] {
  const c = ['#dc004e','#ff4081','#ec407a','#f48fb1','#ffcd35','#fff']
  return Array.from({ length: 60 }, () => {
    const s = Math.random() * 8 + 4
    return { left: Math.random()*100+'%', bg: c[Math.floor(Math.random()*c.length)], delay: Math.random()*2+'s', dur: (Math.random()*2+2)+'s', r: Math.random()>.5?'50%':'0', w: s+'px', h: s+'px' }
  })
}

export default function App() {
  const [names, setNames] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [confetti, setConfetti] = useState<Confetti[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [panel, setPanel] = useState(true)
  const [remove, setRemove] = useState(false)
  const [count, setCount] = useState(0)

  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rot = useRef(0)
  const anim = useRef(0)
  const wheelNames = useRef<string[]>([])

  const parse = useCallback((t: string) => t.split(/[\n\r\t]+/).map(s => s.trim()).filter(Boolean), [])

  useEffect(() => { const t = setTimeout(() => setCount(parse(input).length), 100); return () => clearTimeout(t) }, [input, parse])

  const load = useCallback(() => {
    let p = parse(input)
    if (p.length > 20000) { alert('Max 20 000 jmen. Načteno prvních 20 000.'); p = p.slice(0, 20000) }
    setNames(p)
    if (p.length) { setPanel(false); setWinner(null); setHistory([]) }
  }, [input, parse])

  const clear = useCallback(() => { setNames([]); setInput(''); setWinner(null); setHistory([]); setPanel(true) }, [])

  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = ev => { const t = ev.target?.result as string; if (t) setInput(t) }
    r.readAsText(f); e.target.value = ''
  }, [])

  const getDisplay = useCallback((): string[] => {
    if (names.length <= MAX_VISIBLE) return names
    const step = Math.floor(names.length / MAX_VISIBLE)
    return Array.from({ length: MAX_VISIBLE }, (_, i) => names[i * step])
  }, [names])

  const draw = useCallback((rotation: number) => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d'); if (!ctx) return
    const size = parseInt(cv.style.width) || cv.width
    const cx = size / 2, cy = size / 2
    const R = size / 2 - 4

    ctx.clearRect(0, 0, size, size)

    // Outer shadow ring
    ctx.beginPath()
    ctx.arc(cx, cy, R + 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(220, 0, 78, 0.08)'
    ctx.fill()

    const dn = wheelNames.current.length ? wheelNames.current : getDisplay()
    const n = dn.length

    if (!n) {
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = '#fce4ec'
      ctx.fill()
      ctx.fillStyle = '#dc004e'
      ctx.font = '600 14px Nunito, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Vložte jména', cx, cy)
      return
    }

    const seg = (Math.PI * 2) / n

    // Draw segments
    for (let i = 0; i < n; i++) {
      const a = rotation + i * seg
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, R, a, a + seg)
      ctx.closePath()
      ctx.fillStyle = segColor(i)
      ctx.fill()

      // Thin white separator
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Text
      if (n <= MAX_VISIBLE) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(a + seg / 2)
        ctx.fillStyle = textColor(segColor(i))
        const fs = n <= 4 ? 14 : n <= 8 ? 12 : n <= 14 ? 10 : 8
        ctx.font = `700 ${fs}px Nunito, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        const name = dn[i]
        const ml = n <= 6 ? 16 : n <= 12 ? 12 : 10
        ctx.fillText(name.length > ml ? name.slice(0, ml) + '…' : name, R - 14, 0)
        ctx.restore()
      }
    }

    // Outer ring
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(220, 0, 78, 0.15)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Center button
    const hr = n <= 6 ? 28 : 20
    ctx.beginPath()
    ctx.arc(cx, cy, hr, 0, Math.PI * 2)
    ctx.fillStyle = '#1a1a2e'
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '800 11px Nunito, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Spin', cx, cy)
  }, [getDisplay, names.length])

  const spin = useCallback(() => {
    if (spinning || !names.length) return
    setSpinning(true); setWinner(null); setShowConfetti(false)
    wheelNames.current = getDisplay()
    const wi = Math.floor(Math.random() * names.length)
    const w = names[wi]
    const dn = wheelNames.current, sc = dn.length, seg = (Math.PI * 2) / sc
    let ti = dn.indexOf(w); if (ti < 0) ti = Math.floor(Math.random() * sc)
    const ta = -Math.PI / 2 - (ti * seg + seg / 2)
    const spins = 6 + Math.floor(Math.random() * 4)
    const total = spins * Math.PI * 2 + (ta - rot.current % (Math.PI * 2))
    const sr = rot.current, dur = 4500 + Math.random() * 1500, st = performance.now()

    const animate = (t: number) => {
      const p = Math.min((t - st) / dur, 1)
      rot.current = sr + total * (1 - Math.pow(1 - p, 4))
      draw(rot.current)
      if (p < 1) anim.current = requestAnimationFrame(animate)
      else {
        setSpinning(false); setWinner(w); setShowConfetti(true); setConfetti(makeConfetti())
        setHistory(h => [w, ...h])
        if (remove) setNames(prev => { const i = prev.indexOf(w); if (i >= 0) { const n = [...prev]; n.splice(i, 1); return n } return prev })
        setTimeout(() => setShowConfetti(false), 4000)
      }
    }
    anim.current = requestAnimationFrame(animate)
  }, [spinning, names, getDisplay, draw, remove])

  useEffect(() => { wheelNames.current = getDisplay(); draw(rot.current) }, [names, draw, getDisplay])

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const resize = () => {
      const el = cv.parentElement; if (!el) return
      const s = Math.min(el.getBoundingClientRect().width, 320)
      const d = window.devicePixelRatio || 1
      cv.width = s * d; cv.height = s * d
      cv.style.width = s + 'px'; cv.style.height = s + 'px'
      cv.getContext('2d')?.scale(d, d)
      wheelNames.current = getDisplay(); draw(rot.current)
    }
    resize(); window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [draw, getDisplay])

  useEffect(() => () => { if (anim.current) cancelAnimationFrame(anim.current) }, [])

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col overflow-x-hidden bg-slon-primary">

      {showConfetti && confetti.map((c, i) => (
        <div key={i} className="confetti-piece" style={{ left: c.left, backgroundColor: c.bg, animationDelay: c.delay, animationDuration: c.dur, borderRadius: c.r, width: c.w, height: c.h }} />
      ))}

      {/* Centered content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 sm:py-12">

        {/* Title */}
        <div className="text-center mb-6 sm:mb-8">
          <img src="/slon-logo.svg" alt="" className="h-8 mx-auto mb-3 brightness-0 invert opacity-60" />
          <h1 className="text-white text-xl sm:text-2xl font-black tracking-tight">Kolo Štěstí</h1>
        </div>

        {/* Winner */}
        {winner && (
          <div className="winner-animate mb-6 sm:mb-8 text-center max-w-xs w-full">
            <p className="text-white/50 text-[10px] uppercase tracking-[0.25em] font-bold mb-1">Výherce</p>
            <p className="text-white text-2xl sm:text-3xl font-black break-words leading-tight">{winner}</p>
          </div>
        )}

        {/* Wheel */}
        <div className="relative mb-8 sm:mb-10">
          {/* Pointer */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-white drop-shadow-md" />
          </div>
          <div className="max-w-[280px] sm:max-w-[320px] mx-auto">
            <canvas ref={canvasRef} className="block mx-auto rounded-full" />
          </div>
        </div>

        {/* Spin button */}
        <button
          onClick={spin}
          disabled={spinning || !names.length}
          className={`mb-4 px-10 py-3 text-sm font-black rounded-full transition-all
            transform hover:scale-105 active:scale-95
            disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none
            ${spinning || !names.length ? 'bg-white/20 text-white/50' : 'bg-white text-slon-primary shadow-lg btn-spin'}
          `}
        >
          {spinning ? 'Točí se...' : !names.length ? 'Nahrajte jména' : 'TOČIT!'}
        </button>

        {/* Options */}
        <label className="flex items-center gap-2 cursor-pointer select-none mb-6 sm:mb-8">
          <input type="checkbox" checked={remove} onChange={e => setRemove(e.target.checked)}
            className="w-3.5 h-3.5 accent-white rounded" />
          <span className="text-xs text-white/50">Odebrat výherce po vylosování</span>
        </label>

        {/* Toggle input panel */}
        <button
          onClick={() => setPanel(!panel)}
          className="text-xs font-semibold text-white/60 hover:text-white transition-colors mb-4"
        >
          {panel ? 'Skrýt seznam' : names.length ? 'Upravit seznam' : 'Nahrát jména'}
          {names.length > 0 && !panel && <span className="ml-1.5 bg-white/20 px-2 py-0.5 rounded-full text-[10px]">{names.length.toLocaleString('cs-CZ')}</span>}
        </button>

        {/* Input panel */}
        {panel && (
          <div className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={"Jan Novák\nPetra Svobodová\nMartin Dvořák"}
              className="w-full h-32 p-3 bg-white/10 border border-white/10 rounded-xl text-sm
                text-white placeholder:text-white/30 resize-none focus:outline-none
                focus:border-white/30 transition-all"
              spellCheck={false}
            />

            <input ref={fileRef} type="file" accept=".txt,.csv,.tsv,text/plain" onChange={onFile} className="hidden" />

            <div className="flex gap-2 mt-3">
              <button onClick={() => fileRef.current?.click()}
                className="flex-1 py-2 border border-dashed border-white/20 rounded-xl text-xs font-semibold text-white/50 hover:border-white/40 hover:text-white/70 transition-all">
                Nahrát .txt
              </button>
              <button onClick={clear}
                className="py-2 px-4 text-xs font-semibold text-white/40 hover:text-white/70 rounded-xl transition-colors">
                Smazat
              </button>
              <button onClick={load} disabled={!count}
                className="py-2 px-5 bg-white text-slon-primary font-bold rounded-xl text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                Načíst ({count.toLocaleString('cs-CZ')})
              </button>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="w-full max-w-xs mt-6 sm:mt-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Historie ({history.length})</p>
              <button onClick={() => setHistory([])} className="text-[10px] text-white/30 hover:text-white/60 transition-colors">Vymazat</button>
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {history.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-4 h-4 flex items-center justify-center bg-white/10 rounded-full text-[9px] text-white/50 font-bold flex-shrink-0">{i+1}</span>
                  <span className="text-white/60 truncate">{w}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
