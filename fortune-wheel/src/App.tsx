import { useState, useRef, useCallback, useEffect } from 'react'

const SEGMENT_COLORS = [
  '#dc004e', '#ffffff', '#f8bbd0', '#dc004e', '#fce4ec', '#ec407a',
  '#ffffff', '#f48fb1', '#dc004e', '#fce4ec', '#ff4081', '#ffffff',
  '#dc004e', '#f8bbd0', '#ec407a', '#fce4ec',
]
const MAX_VISIBLE_SEGMENTS = 16

function getSegmentColor(i: number) { return SEGMENT_COLORS[i % SEGMENT_COLORS.length] }
function getTextColor(bg: string) {
  return ['#fff0f5','#fce4ec','#f8bbd0','#f48fb1','#ffffff'].includes(bg) ? '#b0003a' : '#ffffff'
}

interface ConfettiPiece { left: string; bg: string; delay: string; duration: string; borderRadius: string; width: string; height: string }
function createConfetti(): ConfettiPiece[] {
  const c = ['#dc004e','#ff4081','#ec407a','#f48fb1','#ffcd35','#4182e3','#8c65d4']
  return Array.from({ length: 50 }, () => {
    const s = Math.random() * 10 + 6
    return { left: Math.random()*100+'%', bg: c[Math.floor(Math.random()*c.length)], delay: Math.random()*2+'s', duration: (Math.random()*2+2)+'s', borderRadius: Math.random()>.5?'50%':'2px', width: s+'px', height: s+'px' }
  })
}

function App() {
  const [names, setNames] = useState<string[]>([])
  const [inputText, setInputText] = useState('')
  const [isSpinning, setIsSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [winnerHistory, setWinnerHistory] = useState<string[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([])
  const [showInput, setShowInput] = useState(true)
  const [removeWinners, setRemoveWinners] = useState(false)
  const [inputCount, setInputCount] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotationRef = useRef(0)
  const animationRef = useRef<number>(0)
  const namesForWheel = useRef<string[]>([])

  const parseNames = useCallback((text: string): string[] => {
    return text.split(/[\n\r\t]+/).map(n => n.trim()).filter(n => n.length > 0)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setInputCount(parseNames(inputText).length), 150)
    return () => clearTimeout(t)
  }, [inputText, parseNames])

  const handleLoadNames = useCallback(() => {
    const parsed = parseNames(inputText)
    if (parsed.length > 20000) {
      alert('Maximální počet jmen je 20 000. Načteno prvních 20 000.')
      setNames(parsed.slice(0, 20000))
    } else {
      setNames(parsed)
    }
    if (parsed.length > 0) { setShowInput(false); setWinner(null); setWinnerHistory([]) }
  }, [inputText, parseNames])

  const handleClear = useCallback(() => {
    setNames([]); setInputText(''); setWinner(null); setWinnerHistory([]); setShowInput(true)
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { const t = ev.target?.result as string; if (t) setInputText(t) }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  const getDisplayNames = useCallback((): string[] => {
    if (names.length <= MAX_VISIBLE_SEGMENTS) return names
    const step = Math.floor(names.length / MAX_VISIBLE_SEGMENTS)
    return Array.from({ length: MAX_VISIBLE_SEGMENTS }, (_, i) => names[i * step])
  }, [names])

  const drawWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = parseInt(canvas.style.width) || canvas.width
    const center = size / 2
    const outerRadius = center - 6
    const radius = outerRadius - 18

    ctx.clearRect(0, 0, size, size)

    const displayNames = namesForWheel.current.length > 0 ? namesForWheel.current : getDisplayNames()
    const segmentCount = displayNames.length

    // Outer ring
    ctx.beginPath()
    ctx.arc(center, center, outerRadius, 0, Math.PI * 2)
    ctx.fillStyle = '#dc004e'
    ctx.fill()

    // Pegs
    const pegCount = Math.max(segmentCount, 24)
    for (let i = 0; i < pegCount; i++) {
      const a = (Math.PI * 2 * i) / pegCount
      ctx.beginPath()
      ctx.arc(center + Math.cos(a) * (outerRadius - 9), center + Math.sin(a) * (outerRadius - 9), 3, 0, Math.PI * 2)
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#ffcd35'
      ctx.fill()
    }

    if (segmentCount === 0) {
      ctx.beginPath()
      ctx.arc(center, center, radius, 0, Math.PI * 2)
      ctx.fillStyle = '#fce4ec'
      ctx.fill()
      ctx.fillStyle = '#dc004e'
      ctx.font = 'bold 16px Nunito, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Vložte jména', center, center - 8)
      ctx.font = '13px Nunito, sans-serif'
      ctx.fillStyle = '#999'
      ctx.fillText('a točte kolem', center, center + 10)
      return
    }

    const anglePerSegment = (Math.PI * 2) / segmentCount

    for (let i = 0; i < segmentCount; i++) {
      const startAngle = rotation + i * anglePerSegment
      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.arc(center, center, radius, startAngle, startAngle + anglePerSegment)
      ctx.closePath()
      const color = getSegmentColor(i)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = 'rgba(176, 0, 58, 0.15)'
      ctx.lineWidth = 1
      ctx.stroke()

      if (segmentCount <= MAX_VISIBLE_SEGMENTS) {
        ctx.save()
        ctx.translate(center, center)
        ctx.rotate(startAngle + anglePerSegment / 2)
        ctx.fillStyle = getTextColor(color)
        const fs = segmentCount <= 4 ? 15 : segmentCount <= 8 ? 13 : segmentCount <= 12 ? 11 : 9
        ctx.font = `bold ${fs}px Nunito, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        const name = displayNames[i]
        const ml = segmentCount <= 6 ? 18 : segmentCount <= 10 ? 15 : 12
        ctx.fillText(name.length > ml ? name.substring(0, ml) + '…' : name, radius - 12, 0)
        ctx.restore()
      }
    }

    // Inner ring
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(176, 0, 58, 0.2)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Hub
    const hr = segmentCount <= 6 ? 32 : 22
    ctx.beginPath()
    ctx.arc(center, center + 2, hr + 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(center, center, hr, 0, Math.PI * 2)
    const g = ctx.createRadialGradient(center - 4, center - 4, 0, center, center, hr)
    g.addColorStop(0, '#ff4081')
    g.addColorStop(1, '#b0003a')
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = '#880030'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(center - 4, center - 4, hr * 0.4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fill()

    if (names.length > MAX_VISIBLE_SEGMENTS) {
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 11px Nunito, sans-serif'
      ctx.fillText(`${names.length.toLocaleString('cs-CZ')}`, center, center - 3)
      ctx.font = '8px Nunito, sans-serif'
      ctx.fillText('jmen', center, center + 7)
    }
  }, [getDisplayNames, names.length])

  const spin = useCallback(() => {
    if (isSpinning || names.length === 0) return
    setIsSpinning(true); setWinner(null); setShowConfetti(false)
    namesForWheel.current = getDisplayNames()
    const winnerIndex = Math.floor(Math.random() * names.length)
    const selectedWinner = names[winnerIndex]
    const dn = namesForWheel.current
    const sc = dn.length
    const aps = (Math.PI * 2) / sc
    let tsi = dn.indexOf(selectedWinner)
    if (tsi === -1) tsi = Math.floor(Math.random() * sc)
    const ta = -Math.PI / 2 - (tsi * aps + aps / 2)
    const fs = 5 + Math.floor(Math.random() * 5)
    const tr = fs * Math.PI * 2 + (ta - rotationRef.current % (Math.PI * 2))
    const sr = rotationRef.current
    const dur = 4000 + Math.random() * 2000
    const st = performance.now()

    const animate = (ct: number) => {
      const p = Math.min((ct - st) / dur, 1)
      rotationRef.current = sr + tr * (1 - Math.pow(1 - p, 3))
      drawWheel(rotationRef.current)
      if (p < 1) { animationRef.current = requestAnimationFrame(animate) }
      else {
        setIsSpinning(false); setWinner(selectedWinner); setShowConfetti(true)
        setConfettiPieces(createConfetti())
        setWinnerHistory(prev => [selectedWinner, ...prev])
        if (removeWinners) {
          setNames(prev => { const idx = prev.indexOf(selectedWinner); if (idx !== -1) { const n = [...prev]; n.splice(idx, 1); return n }; return prev })
        }
        setTimeout(() => setShowConfetti(false), 4000)
      }
    }
    animationRef.current = requestAnimationFrame(animate)
  }, [isSpinning, names, getDisplayNames, drawWheel, removeWinners])

  useEffect(() => { namesForWheel.current = getDisplayNames(); drawWheel(rotationRef.current) }, [names, drawWheel, getDisplayNames])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const updateSize = () => {
      const container = canvas.parentElement
      if (!container) return
      // Subtract padding (32px total) and leave extra breathing room
      const available = container.getBoundingClientRect().width - 32
      const size = Math.min(available, 360)
      const dpr = window.devicePixelRatio || 1
      canvas.width = size * dpr; canvas.height = size * dpr
      canvas.style.width = size + 'px'; canvas.style.height = size + 'px'
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
      namesForWheel.current = getDisplayNames()
      drawWheel(rotationRef.current)
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [drawWheel, getDisplayNames])

  useEffect(() => { return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) } }, [])

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col overflow-x-hidden"
      style={{ background: 'linear-gradient(160deg, #fff5f8 0%, #ffffff 40%, #fef0f5 100%)' }}>

      {/* Confetti */}
      {showConfetti && confettiPieces.map((piece, i) => (
        <div key={i} className="confetti-piece" style={{ left: piece.left, backgroundColor: piece.bg, animationDelay: piece.delay, animationDuration: piece.duration, borderRadius: piece.borderRadius, width: piece.width, height: piece.height }} />
      ))}

      {/* Header - full width */}
      <header className="w-full bg-white/70 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <img src="/slon-logo.svg" alt="Růžový Slon" className="h-8" />
            <div className="w-px h-6 bg-gray-200" />
            <h1 className="text-lg font-black text-slon-primary tracking-tight">Kolo Štěstí</h1>
          </div>
          <div className="flex items-center gap-3">
            {names.length > 0 && (
              <span className="bg-slon-primary/10 text-slon-primary px-3 py-1 rounded-full text-xs font-bold hidden sm:inline-flex">
                {names.length.toLocaleString('cs-CZ')} jmen
              </span>
            )}
            <button
              onClick={() => setShowInput(!showInput)}
              className="text-sm font-semibold text-slon-primary hover:bg-slon-pink-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              {showInput ? 'Skrýt seznam' : 'Upravit seznam'}
            </button>
          </div>
        </div>
      </header>

      {/* Main content - centered on page */}
      <main className="flex-1 flex items-start sm:items-center justify-center px-6 sm:px-8 py-8 sm:py-12">
        <div className="w-full max-w-md flex flex-col items-center">

          {/* Input Panel */}
          {showInput && (
            <div className="w-full mb-8 bg-white rounded-3xl shadow-lg shadow-gray-200/50 border border-gray-100 p-6 sm:p-8">
              <h2 className="text-lg font-extrabold text-gray-800 mb-1">Seznam jmen</h2>
              <p className="text-gray-400 text-sm mb-4">
                Vložte jména na řádky, zkopírujte z Excelu, nebo nahrajte soubor.
              </p>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={"Jan Novák\nPetra Svobodová\nMartin Dvořák\n..."}
                className="w-full h-40 sm:h-48 p-4 border border-gray-200 rounded-2xl text-sm
                  text-gray-700 resize-none focus:outline-none focus:border-slon-primary
                  focus:ring-3 focus:ring-slon-primary/10 transition-all placeholder:text-gray-300
                  bg-gray-50/50"
                spellCheck={false}
              />

              <input ref={fileInputRef} type="file" accept=".txt,.csv,.tsv,text/plain" onChange={handleFileUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-200 rounded-2xl
                  text-sm font-semibold text-gray-400 hover:border-slon-primary
                  hover:text-slon-primary hover:bg-slon-pink-100/30 transition-all"
              >
                Nahrát .txt soubor
              </button>

              <div className="flex items-center justify-between mt-4 gap-3">
                <span className="text-xs text-gray-400 font-medium">
                  {inputCount.toLocaleString('cs-CZ')} jmen
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleClear}
                    className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-slon-primary rounded-xl transition-colors"
                  >
                    Smazat
                  </button>
                  <button
                    onClick={handleLoadNames}
                    disabled={inputCount === 0}
                    className="px-5 py-2 bg-slon-primary text-white font-bold rounded-xl text-sm
                      hover:bg-slon-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Načíst jména
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Winner */}
          {winner && (
            <div className="winner-animate mb-6 w-full">
              <div className="bg-white rounded-3xl shadow-lg shadow-slon-primary/10 p-6 border border-slon-pink-200 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slon-pink-100/40 to-transparent" />
                <div className="relative">
                  <p className="text-[11px] font-bold text-slon-pink-400 uppercase tracking-[0.2em] mb-2">
                    Vylosovaný výherce
                  </p>
                  <p className="text-2xl sm:text-3xl font-black text-slon-primary break-words leading-tight">
                    {winner}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Wheel */}
          <div className="relative w-full flex justify-center mb-8">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 drop-shadow-md">
              <svg width="28" height="32" viewBox="0 0 32 36">
                <defs>
                  <linearGradient id="ptr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff4081" />
                    <stop offset="100%" stopColor="#b0003a" />
                  </linearGradient>
                </defs>
                <polygon points="16,34 2,4 30,4" fill="url(#ptr)" stroke="#880030" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="w-full max-w-[360px] mx-auto drop-shadow-xl">
              <canvas ref={canvasRef} className="block mx-auto" />
            </div>
          </div>

          {/* Spin button */}
          <button
            onClick={spin}
            disabled={isSpinning || names.length === 0}
            className={`mb-4 w-full max-w-[280px] py-4 text-lg font-black text-white rounded-full
              transition-all transform hover:scale-[1.03] active:scale-95
              disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none
              ${!isSpinning && names.length > 0
                ? 'bg-gradient-to-r from-slon-primary to-slon-light shadow-xl shadow-slon-primary/25 btn-spin'
                : 'bg-gray-300 shadow-none'}
            `}
          >
            {isSpinning ? 'Točí se...' : names.length === 0 ? 'Nejdříve nahrajte jména' : 'TOČIT!'}
          </button>

          {/* Options */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none mb-8">
            <input type="checkbox" checked={removeWinners} onChange={(e) => setRemoveWinners(e.target.checked)}
              className="w-4 h-4 accent-slon-primary rounded" />
            <span className="text-sm text-gray-400">Odebrat výherce po vylosování</span>
          </label>

          {/* History */}
          {winnerHistory.length > 0 && (
            <div className="w-full bg-white rounded-3xl shadow-lg shadow-gray-200/50 p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Historie ({winnerHistory.length})
                </h3>
                <button onClick={() => setWinnerHistory([])}
                  className="text-xs text-gray-400 hover:text-slon-primary transition-colors">Vymazat</button>
              </div>
              <ol className="space-y-1.5 max-h-40 overflow-y-auto">
                {winnerHistory.map((w, i) => (
                  <li key={i} className="flex items-center gap-3 py-1 text-sm">
                    <span className="w-6 h-6 flex items-center justify-center bg-slon-pink-100
                      text-slon-primary font-bold rounded-full text-[10px] flex-shrink-0">{i + 1}</span>
                    <span className="font-medium text-gray-600 truncate">{w}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <img src="/slon-logo.svg" alt="" className="h-5 opacity-20 mx-auto mb-1.5" />
        <p className="text-[10px] text-gray-300 font-medium">{new Date().getFullYear()} Růžový Slon</p>
      </footer>
    </div>
  )
}

export default App
