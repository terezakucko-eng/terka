import { useState, useRef, useCallback, useEffect } from 'react'

// Brand colors - alternating for wheel segments
const SEGMENT_COLORS = [
  '#dc004e',
  '#ffffff',
  '#f8bbd0',
  '#dc004e',
  '#fce4ec',
  '#ec407a',
  '#ffffff',
  '#f48fb1',
  '#dc004e',
  '#fce4ec',
  '#ff4081',
  '#ffffff',
  '#dc004e',
  '#f8bbd0',
  '#ec407a',
  '#fce4ec',
]

const MAX_VISIBLE_SEGMENTS = 16

function getSegmentColor(index: number): string {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length]
}

function getTextColor(bgColor: string): string {
  const light = ['#fff0f5', '#fce4ec', '#f8bbd0', '#f48fb1', '#ffffff']
  return light.includes(bgColor) ? '#b0003a' : '#ffffff'
}

interface ConfettiPiece {
  left: string
  bg: string
  delay: string
  duration: string
  borderRadius: string
  width: string
  height: string
}

function createConfetti(): ConfettiPiece[] {
  const colors = ['#dc004e', '#ff4081', '#ec407a', '#f48fb1', '#ffcd35', '#4182e3', '#8c65d4']
  return Array.from({ length: 50 }, () => {
    const size = Math.random() * 10 + 6
    return {
      left: Math.random() * 100 + '%',
      bg: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2 + 's',
      duration: (Math.random() * 2 + 2) + 's',
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      width: size + 'px',
      height: size + 'px',
    }
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

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotationRef = useRef(0)
  const animationRef = useRef<number>(0)
  const namesForWheel = useRef<string[]>([])

  const parseNames = useCallback((text: string): string[] => {
    return text
      .split(/[\n\r\t]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setInputCount(parseNames(inputText).length)
    }, 150)
    return () => clearTimeout(timer)
  }, [inputText, parseNames])

  const handleLoadNames = useCallback(() => {
    const parsed = parseNames(inputText)
    if (parsed.length > 20000) {
      alert('Maximální počet jmen je 20 000. Načteno prvních 20 000.')
      setNames(parsed.slice(0, 20000))
    } else {
      setNames(parsed)
    }
    if (parsed.length > 0) {
      setShowInput(false)
      setWinner(null)
      setWinnerHistory([])
    }
  }, [inputText, parseNames])

  const handleClear = useCallback(() => {
    setNames([])
    setInputText('')
    setWinner(null)
    setWinnerHistory([])
    setShowInput(true)
  }, [])

  const getDisplayNames = useCallback((): string[] => {
    if (names.length <= MAX_VISIBLE_SEGMENTS) return names
    const step = Math.floor(names.length / MAX_VISIBLE_SEGMENTS)
    const display: string[] = []
    for (let i = 0; i < MAX_VISIBLE_SEGMENTS; i++) {
      display.push(names[i * step])
    }
    return display
  }, [names])

  // Draw wheel
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

    // Outer decorative ring
    ctx.beginPath()
    ctx.arc(center, center, outerRadius, 0, Math.PI * 2)
    ctx.fillStyle = '#dc004e'
    ctx.fill()

    // Decorative pegs on outer ring
    const pegCount = Math.max(segmentCount, 24)
    for (let i = 0; i < pegCount; i++) {
      const angle = (Math.PI * 2 * i) / pegCount
      const px = center + Math.cos(angle) * (outerRadius - 9)
      const py = center + Math.sin(angle) * (outerRadius - 9)
      ctx.beginPath()
      ctx.arc(px, py, 3, 0, Math.PI * 2)
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#ffcd35'
      ctx.fill()
    }

    if (segmentCount === 0) {
      // Empty wheel
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

    // Draw segments
    for (let i = 0; i < segmentCount; i++) {
      const startAngle = rotation + i * anglePerSegment
      const endAngle = startAngle + anglePerSegment

      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.arc(center, center, radius, startAngle, endAngle)
      ctx.closePath()
      const color = getSegmentColor(i)
      ctx.fillStyle = color
      ctx.fill()

      // Subtle separator line
      ctx.strokeStyle = 'rgba(176, 0, 58, 0.15)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Text
      if (segmentCount <= MAX_VISIBLE_SEGMENTS) {
        ctx.save()
        ctx.translate(center, center)
        ctx.rotate(startAngle + anglePerSegment / 2)

        ctx.fillStyle = getTextColor(color)
        const fontSize = segmentCount <= 4 ? 15 : segmentCount <= 8 ? 13 : segmentCount <= 12 ? 11 : 9
        ctx.font = `bold ${fontSize}px Nunito, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'

        const name = displayNames[i]
        const maxLen = segmentCount <= 6 ? 18 : segmentCount <= 10 ? 15 : 12
        const displayText = name.length > maxLen ? name.substring(0, maxLen) + '…' : name
        ctx.fillText(displayText, radius - 12, 0)
        ctx.restore()
      }
    }

    // Inner ring shadow
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(176, 0, 58, 0.2)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Center hub
    const hubRadius = segmentCount <= 6 ? 32 : 22
    // Hub shadow
    ctx.beginPath()
    ctx.arc(center, center + 2, hubRadius + 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fill()
    // Hub body
    ctx.beginPath()
    ctx.arc(center, center, hubRadius, 0, Math.PI * 2)
    const hubGrad = ctx.createRadialGradient(center - 4, center - 4, 0, center, center, hubRadius)
    hubGrad.addColorStop(0, '#ff4081')
    hubGrad.addColorStop(1, '#b0003a')
    ctx.fillStyle = hubGrad
    ctx.fill()
    ctx.strokeStyle = '#880030'
    ctx.lineWidth = 2
    ctx.stroke()

    // Hub highlight
    ctx.beginPath()
    ctx.arc(center - 4, center - 4, hubRadius * 0.4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fill()

    // Hub text
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (names.length > MAX_VISIBLE_SEGMENTS) {
      ctx.font = 'bold 11px Nunito, sans-serif'
      ctx.fillText(`${names.length.toLocaleString('cs-CZ')}`, center, center - 3)
      ctx.font = '8px Nunito, sans-serif'
      ctx.fillText('jmen', center, center + 7)
    }
  }, [getDisplayNames, names.length])

  // Spin
  const spin = useCallback(() => {
    if (isSpinning || names.length === 0) return

    setIsSpinning(true)
    setWinner(null)
    setShowConfetti(false)

    namesForWheel.current = getDisplayNames()

    const winnerIndex = Math.floor(Math.random() * names.length)
    const selectedWinner = names[winnerIndex]

    const displayNames = namesForWheel.current
    const segmentCount = displayNames.length
    const anglePerSegment = (Math.PI * 2) / segmentCount

    let targetSegmentIndex = displayNames.indexOf(selectedWinner)
    if (targetSegmentIndex === -1) {
      targetSegmentIndex = Math.floor(Math.random() * segmentCount)
    }

    const targetAngle = -Math.PI / 2 - (targetSegmentIndex * anglePerSegment + anglePerSegment / 2)
    const fullSpins = 5 + Math.floor(Math.random() * 5)
    const totalRotation = fullSpins * Math.PI * 2 + (targetAngle - rotationRef.current % (Math.PI * 2))

    const startRotation = rotationRef.current
    const duration = 4000 + Math.random() * 2000
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      rotationRef.current = startRotation + totalRotation * eased
      drawWheel(rotationRef.current)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setIsSpinning(false)
        setWinner(selectedWinner)
        setShowConfetti(true)
        setConfettiPieces(createConfetti())
        setWinnerHistory(prev => [selectedWinner, ...prev])

        if (removeWinners) {
          setNames(prev => {
            const idx = prev.indexOf(selectedWinner)
            if (idx !== -1) {
              const next = [...prev]
              next.splice(idx, 1)
              return next
            }
            return prev
          })
        }

        setTimeout(() => setShowConfetti(false), 4000)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [isSpinning, names, getDisplayNames, drawWheel, removeWinners])

  useEffect(() => {
    namesForWheel.current = getDisplayNames()
    drawWheel(rotationRef.current)
  }, [names, drawWheel, getDisplayNames])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateSize = () => {
      const container = canvas.parentElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      const size = Math.min(rect.width, 460)
      const dpr = window.devicePixelRatio || 1
      canvas.width = size * dpr
      canvas.height = size * dpr
      canvas.style.width = size + 'px'
      canvas.style.height = size + 'px'
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
      namesForWheel.current = getDisplayNames()
      drawWheel(rotationRef.current)
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [drawWheel, getDisplayNames])

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slon-pink-100 via-white to-slon-pink-200">
      {/* Confetti */}
      {showConfetti && confettiPieces.map((piece, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: piece.left,
            backgroundColor: piece.bg,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            borderRadius: piece.borderRadius,
            width: piece.width,
            height: piece.height,
          }}
        />
      ))}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slon-pink-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <img
              src="/slon-logo.svg"
              alt="Růžový Slon"
              className="h-8 sm:h-9"
            />
            <div className="w-px h-7 bg-slon-pink-300 hidden sm:block" />
            <h1 className="text-lg sm:text-xl font-black text-slon-primary tracking-tight">
              Kolo Štěstí
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {names.length > 0 && (
              <span className="bg-slon-primary/10 text-slon-primary px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                {names.length.toLocaleString('cs-CZ')} jmen
              </span>
            )}
            <button
              onClick={() => setShowInput(!showInput)}
              className="text-sm font-bold text-slon-primary hover:bg-slon-pink-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              {showInput ? 'Skrýt' : 'Upravit seznam'}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10">

        {/* Input Panel - collapsible */}
        {showInput && (
          <div className="mb-8 bg-white rounded-2xl shadow-sm border border-slon-pink-200/60 p-5 sm:p-6 max-w-2xl mx-auto">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-extrabold text-gray-800">Seznam jmen</h2>
                <p className="text-gray-400 text-sm mt-0.5">
                  Každé jméno na nový řádek, nebo kopie sloupce z Excelu (max 20 000)
                </p>
              </div>
              <img src="/elephant.jpg" alt="" className="w-16 h-16 rounded-xl object-cover hidden sm:block shadow-sm" />
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={"Jan Novák\nPetra Svobodová\nMartin Dvořák\n..."}
              className="w-full h-52 sm:h-64 p-4 border border-gray-200 rounded-xl text-sm
                text-gray-700 resize-none focus:outline-none focus:border-slon-primary
                focus:ring-2 focus:ring-slon-primary/10 transition-all placeholder:text-gray-300
                bg-gray-50/50"
              spellCheck={false}
            />

            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400 font-semibold">
                {inputCount.toLocaleString('cs-CZ')} jmen
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleClear}
                  className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-slon-primary rounded-lg transition-colors"
                >
                  Smazat vše
                </button>
                <button
                  onClick={handleLoadNames}
                  disabled={inputCount === 0}
                  className="px-5 py-2 bg-slon-primary text-white font-bold rounded-xl text-sm
                    hover:bg-slon-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                    shadow-sm"
                >
                  Načíst a točit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wheel + controls centered */}
        <div className="flex flex-col items-center">

          {/* Winner banner */}
          {winner && (
            <div className="winner-animate mb-6 w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-lg p-5 border border-slon-pink-200 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slon-pink-100/50 to-transparent" />
                <div className="relative">
                  <p className="text-xs font-bold text-slon-pink-400 uppercase tracking-widest mb-1">
                    Vylosovaný výherce
                  </p>
                  <p className="text-2xl sm:text-3xl font-black text-slon-primary break-words leading-tight">
                    {winner}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Wheel area */}
          <div className="relative mb-6">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 drop-shadow-md">
              <svg width="32" height="36" viewBox="0 0 32 36">
                <defs>
                  <linearGradient id="ptr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff4081" />
                    <stop offset="100%" stopColor="#b0003a" />
                  </linearGradient>
                </defs>
                <polygon points="16,34 2,4 30,4" fill="url(#ptr)" stroke="#880030" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="w-full max-w-[460px] drop-shadow-xl">
              <canvas ref={canvasRef} className="w-full" />
            </div>
          </div>

          {/* Spin button */}
          <button
            onClick={spin}
            disabled={isSpinning || names.length === 0}
            className={`mb-4 py-3.5 px-12 text-lg font-black text-white rounded-full
              transition-all transform hover:scale-105 active:scale-95
              disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none
              ${!isSpinning && names.length > 0
                ? 'bg-gradient-to-r from-slon-primary to-slon-light shadow-lg shadow-slon-primary/30 btn-spin'
                : 'bg-gray-300 shadow-none'}
            `}
          >
            {isSpinning ? 'Točí se...' : names.length === 0 ? 'Nejdříve nahrajte jména' : 'TOČIT KOLEM!'}
          </button>

          {/* Options */}
          <label className="flex items-center gap-2 cursor-pointer select-none mb-6">
            <input
              type="checkbox"
              checked={removeWinners}
              onChange={(e) => setRemoveWinners(e.target.checked)}
              className="w-4 h-4 accent-slon-primary rounded"
            />
            <span className="text-sm text-gray-500">
              Odebrat výherce po vylosování
            </span>
          </label>

          {/* Winner History */}
          {winnerHistory.length > 0 && (
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-5 border border-slon-pink-200/60">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider">
                  Historie ({winnerHistory.length})
                </h3>
                <button
                  onClick={() => setWinnerHistory([])}
                  className="text-xs text-gray-400 hover:text-slon-primary transition-colors"
                >
                  Vymazat
                </button>
              </div>
              <ol className="space-y-1 max-h-44 overflow-y-auto">
                {winnerHistory.map((w, i) => (
                  <li key={i} className="flex items-center gap-2.5 py-1 text-sm">
                    <span className="w-5 h-5 flex items-center justify-center bg-slon-pink-200
                      text-slon-primary font-bold rounded-full text-[10px] flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-medium text-gray-600 truncate">{w}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-5 px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <img src="/slon-logo.svg" alt="Růžový Slon" className="h-6 opacity-40" />
        </div>
        <p className="text-xs text-gray-400">
          {new Date().getFullYear()} Růžový Slon
        </p>
      </footer>
    </div>
  )
}

export default App
