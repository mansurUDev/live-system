import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { C, input } from '../../theme'

interface Props {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  hint?: string
  label?: string
  big?: boolean
}

/**
 * Поле для суммы.
 *
 * Держит собственный черновик, пока идёт набор: иначе «1000» на середине ввода
 * превращалось бы в «1» и правило хранилища тут же возвращало бы его в поле.
 * В хранилище уходит только разобранное число.
 */
export function MoneyField({ value, onChange, placeholder, hint, label, big }: Props) {
  const [draft, setDraft] = useState(() => (value ? String(value) : ''))

  // значение могло измениться снаружи — например, приехало из другой вкладки
  useEffect(() => {
    setDraft((d) => (parse(d) === value ? d : value ? String(value) : ''))
  }, [value])

  const style: CSSProperties = big
    ? { ...input, fontSize: 22, fontWeight: 600, padding: '12px 13px' }
    : input

  return (
    <div>
      {label && <div style={{ fontSize: 13, color: C.muted }}>{label}</div>}
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = parse(e.target.value)
          if (n !== null) onChange(n)
        }}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        style={style}
      />
      {hint && <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function parse(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.')
  if (!t) return 0
  const v = parseFloat(t)
  return Number.isFinite(v) && v >= 0 ? v : null
}
