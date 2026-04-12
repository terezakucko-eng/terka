import { useEffect, useRef } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'p' | 'li'
  className?: string
  placeholder?: string
  multiline?: boolean
}

/**
 * Inline-editable text. Uses contentEditable but only writes the text back
 * on blur so React doesn't fight with the caret on every keystroke.
 */
export default function Editable({
  value,
  onChange,
  as: Tag = 'span',
  className,
  placeholder,
  multiline = false,
}: Props) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.innerText !== value) {
      el.innerText = value
    }
  }, [value])

  return (
    <Tag
      ref={ref as never}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      className={`editable ${className ?? ''}`}
      onBlur={(e) => {
        const next = (e.currentTarget as HTMLElement).innerText
        if (next !== value) onChange(next)
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).blur()
        }
      }}
    />
  )
}
