import { useState, useRef, useCallback, useEffect } from 'react'

// Brand colors for wheel segments
const SEGMENT_COLORS = [
  '#dc004e', // primary crimson
  '#fff0f5', // lavender blush
  '#ff4081', // bright pink
  '#fce4ec', // pink tint
  '#ec407a', // medium pink
  '#f8bbd0', // light pink
  '#b0003a', // dark crimson
  '#f48fb1', // pink
  '#e91e63', // pink 500
  '#ffffff', // white
  '#c2185b', // pink 700
  '#fce4ec', // pink tint
]

const MAX_VISIBLE_SEGMENTS = 16

function getSegmentColor(index: number): string {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length]
}

function getTextColor(bgColor: string): string {
  // Dark text on light backgrounds, white text on dark backgrounds
  const light = ['#fff0f5', '#fce4ec', '#f8bbd0', '#f48fb1', '#ffffff']
  return light.includes(bgColor) ? '#dc004e' : '#ffffff'
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
  return Array.from({ length: 40 }, () => {
    const size = Math.random() * 8 + 6
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

// Růžový Slon brand logo (S in eye shape)
function SlonLogo({ className }: { className?: string }) {
  return (
    <img
      src="/slon-logo.svg"
      alt="Růžový Slon"
      className={className}
      style={{ filter: 'brightness(0) invert(1)' }}
    />
  )
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

  // Parse names from input text (handles newlines, tabs, commas)
  const parseNames = useCallback((text: string): string[] => {
    return text
      .split(/[\n\r\t]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0)
  }, [])

  // Update input count with a small delay for performance with large inputs
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

  // Get display names for wheel (limited to MAX_VISIBLE_SEGMENTS)
  const getDisplayNames = useCallback((): string[] => {
    if (names.length <= MAX_VISIBLE_SEGMENTS) return names
    // Show a representative sample
    const step = Math.floor(names.length / MAX_VISIBLE_SEGMENTS)
    const display: string[] = []
    for (let i = 0; i < MAX_VISIBLE_SEGMENTS; i++) {
      display.push(names[i * step])
    }
    return display
  }, [names])

  // Draw wheel on canvas
  const drawWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = parseInt(canvas.style.width) || canvas.width
    const center = size / 2
    const radius = center - 12

    ctx.clearRect(0, 0, size, size)

    const displayNames = namesForWheel.current.length > 0 ? namesForWheel.current : getDisplayNames()
    const segmentCount = displayNames.length

    if (segmentCount === 0) {
      // Draw empty wheel
      ctx.beginPath()
      ctx.arc(center, center, radius, 0, Math.PI * 2)
      ctx.fillStyle = '#fce4ec'
      ctx.fill()
      ctx.strokeStyle = '#dc004e'
      ctx.lineWidth = 4
      ctx.stroke()

      ctx.fillStyle = '#dc004e'
      ctx.font = 'bold 18px Nunito, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Nahrajte jména', center, center)
      return
    }

    const anglePerSegment = (Math.PI * 2) / segmentCount

    // Draw segments
    for (let i = 0; i < segmentCount; i++) {
      const startAngle = rotation + i * anglePerSegment
      const endAngle = startAngle + anglePerSegment

      // Segment fill
      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.arc(center, center, radius, startAngle, endAngle)
      ctx.closePath()
      const color = getSegmentColor(i)
      ctx.fillStyle = color
      ctx.fill()

      // Segment border
      ctx.strokeStyle = 'rgba(220, 0, 78, 0.3)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Text on segment
      if (segmentCount <= MAX_VISIBLE_SEGMENTS) {
        ctx.save()
        ctx.translate(center, center)
        ctx.rotate(startAngle + anglePerSegment / 2)

        const textColor = getTextColor(color)
        ctx.fillStyle = textColor
        const fontSize = segmentCount <= 6 ? 14 : segmentCount <= 10 ? 12 : 10
        ctx.font = `bold ${fontSize}px Nunito, sans-serif`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'

        const name = displayNames[i]
        const maxLen = segmentCount <= 6 ? 18 : 14
        const displayText = name.length > maxLen ? name.substring(0, maxLen) + '…' : name
        ctx.fillText(displayText, radius - 15, 0)

        ctx.restore()
      }
    }

    // Center circle
    ctx.beginPath()
    ctx.arc(center, center, segmentCount <= 6 ? 35 : 25, 0, Math.PI * 2)
    ctx.fillStyle = '#dc004e'
    ctx.fill()
    ctx.strokeStyle = '#b0003a'
    ctx.lineWidth = 3
    ctx.stroke()

    // Center text
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px Nunito, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (names.length > MAX_VISIBLE_SEGMENTS) {
      ctx.fillText(`${names.length}`, center, center - 5)
      ctx.font = '9px Nunito, sans-serif'
      ctx.fillText('jmen', center, center + 7)
    } else {
      ctx.fillText('TOČI', center, center)
    }

    // Outer ring
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.strokeStyle = '#dc004e'
    ctx.lineWidth = 4
    ctx.stroke()

    // Tick marks on outer ring
    for (let i = 0; i < segmentCount; i++) {
      const angle = rotation + i * anglePerSegment
      ctx.beginPath()
      ctx.moveTo(
        center + Math.cos(angle) * (radius - 8),
        center + Math.sin(angle) * (radius - 8)
      )
      ctx.lineTo(
        center + Math.cos(angle) * (radius + 2),
        center + Math.sin(angle) * (radius + 2)
      )
      ctx.strokeStyle = '#dc004e'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [getDisplayNames, names.length])

  // Spin the wheel
  const spin = useCallback(() => {
    if (isSpinning || names.length === 0) return

    setIsSpinning(true)
    setWinner(null)
    setShowConfetti(false)

    // Prepare display names
    namesForWheel.current = getDisplayNames()

    // Random winner from ALL names
    const winnerIndex = Math.floor(Math.random() * names.length)
    const selectedWinner = names[winnerIndex]

    // Calculate target rotation
    const displayNames = namesForWheel.current
    const segmentCount = displayNames.length
    const anglePerSegment = (Math.PI * 2) / segmentCount

    // Find which display segment to land on (or closest match)
    let targetSegmentIndex = displayNames.indexOf(selectedWinner)
    if (targetSegmentIndex === -1) {
      targetSegmentIndex = Math.floor(Math.random() * segmentCount)
    }

    // The pointer is at the top (270 degrees / -PI/2), so we need the target segment
    // to be at that position after rotation
    const targetAngle = -Math.PI / 2 - (targetSegmentIndex * anglePerSegment + anglePerSegment / 2)
    const fullSpins = 5 + Math.floor(Math.random() * 5) // 5-10 full rotations
    const totalRotation = fullSpins * Math.PI * 2 + (targetAngle - rotationRef.current % (Math.PI * 2))

    const startRotation = rotationRef.current
    const duration = 4000 + Math.random() * 2000 // 4-6 seconds
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing: cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3)

      rotationRef.current = startRotation + totalRotation * eased
      drawWheel(rotationRef.current)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        // Spin complete
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

        // Hide confetti after 4 seconds
        setTimeout(() => setShowConfetti(false), 4000)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [isSpinning, names, getDisplayNames, drawWheel, removeWinners])

  // Initial draw
  useEffect(() => {
    namesForWheel.current = getDisplayNames()
    drawWheel(rotationRef.current)
  }, [names, drawWheel, getDisplayNames])

  // Handle canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateSize = () => {
      const container = canvas.parentElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      const size = Math.min(rect.width, 500)
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

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  const availableNames = names.length

  return (
    <div className="min-h-screen flex flex-col">
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
      <header className="bg-slon-primary text-white py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SlonLogo className="h-10 hidden sm:block" />
            <div className="hidden sm:block w-px h-10 bg-white/30" />
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              Kolo Štěstí
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {names.length > 0 && (
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                {availableNames} jmen
              </span>
            )}
            <button
              onClick={() => setShowInput(!showInput)}
              className="bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 rounded-lg font-bold text-sm"
            >
              {showInput ? 'Skrýt seznam' : 'Upravit seznam'}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <div className={`grid gap-6 ${showInput ? 'lg:grid-cols-[1fr_1.4fr]' : 'lg:grid-cols-1'}`}>

          {/* Name Input Panel */}
          {showInput && (
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-slon-pink-200">
              <h2 className="text-xl font-extrabold text-slon-primary mb-1">
                Seznam jmen
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                Vložte jména — každé na nový řádek, nebo zkopírujte sloupec z Excelu (max 20 000)
              </p>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={"Jan Novák\nPetra Svobodová\nMartin Dvořák\n..."}
                className="w-full h-64 lg:h-80 p-4 border-2 border-slon-pink-200 rounded-xl text-sm
                  font-medium text-gray-700 resize-none focus:outline-none focus:border-slon-primary
                  focus:ring-2 focus:ring-slon-primary/20 transition-all placeholder:text-gray-300"
                spellCheck={false}
              />

              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-400 font-semibold">
                  {inputCount.toLocaleString('cs-CZ')} jmen rozpoznáno
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleClear}
                    className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-slon-primary
                      hover:bg-slon-pink-100 rounded-lg transition-colors"
                  >
                    Smazat
                  </button>
                  <button
                    onClick={handleLoadNames}
                    disabled={inputCount === 0}
                    className="px-6 py-2 bg-slon-primary text-white font-extrabold rounded-lg
                      hover:bg-slon-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                      shadow-md hover:shadow-lg"
                  >
                    Načíst jména
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Wheel Section */}
          <div className="flex flex-col items-center gap-4">
            {/* Winner display */}
            {winner && (
              <div className="winner-animate w-full bg-white rounded-2xl shadow-xl p-6 border-2 border-slon-primary text-center">
                <p className="text-sm font-bold text-slon-pink-500 uppercase tracking-wider mb-1">
                  Výherce
                </p>
                <p className="text-3xl sm:text-4xl font-black text-slon-primary break-words">
                  {winner}
                </p>
              </div>
            )}

            {/* Wheel */}
            <div className="relative w-full flex justify-center">
              {/* Pointer triangle */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
                <svg width="36" height="30" viewBox="0 0 36 30">
                  <polygon points="18,28 4,2 32,2" fill="#dc004e" stroke="#b0003a" strokeWidth="2" />
                </svg>
              </div>

              <div className="w-full max-w-[500px]">
                <canvas
                  ref={canvasRef}
                  className="w-full"
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-3 w-full max-w-md">
              <button
                onClick={spin}
                disabled={isSpinning || names.length === 0}
                className={`w-full py-4 px-8 text-xl font-black text-white rounded-2xl
                  transition-all transform hover:scale-[1.02] active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none
                  shadow-xl hover:shadow-2xl
                  ${!isSpinning && names.length > 0 ? 'bg-slon-primary hover:bg-slon-dark btn-spin' : 'bg-gray-400'}
                `}
              >
                {isSpinning ? 'Točí se...' : names.length === 0 ? 'Nejdříve nahrajte jména' : 'TOČIT!'}
              </button>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={removeWinners}
                    onChange={(e) => setRemoveWinners(e.target.checked)}
                    className="w-4 h-4 accent-slon-primary"
                  />
                  <span className="text-sm font-semibold text-gray-600">
                    Odebrat výherce po vylosování
                  </span>
                </label>
              </div>
            </div>

            {/* Winner History */}
            {winnerHistory.length > 0 && (
              <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-5 border border-slon-pink-200">
                <h3 className="text-lg font-extrabold text-slon-primary mb-3 flex items-center justify-between">
                  <span>Historie výherců</span>
                  <button
                    onClick={() => setWinnerHistory([])}
                    className="text-xs font-bold text-gray-400 hover:text-slon-primary transition-colors"
                  >
                    Smazat
                  </button>
                </h3>
                <ol className="space-y-1.5 max-h-48 overflow-y-auto">
                  {winnerHistory.map((w, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-6 h-6 flex items-center justify-center bg-slon-pink-200
                        text-slon-primary font-bold rounded-full text-xs flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-gray-700 truncate">{w}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Elephant mascot */}
      <div className="flex justify-center pb-6 px-4">
        <img
          src="/elephant.jpg"
          alt="Růžový Slon maskot"
          className="w-full max-w-lg rounded-2xl shadow-lg"
        />
      </div>

      {/* Footer */}
      <footer className="bg-slon-primary/5 border-t border-slon-pink-200 py-4 px-6 text-center">
        <p className="text-sm font-semibold text-gray-400">
          Kolo Štěstí &middot; Růžový Slon &middot; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}

export default App
