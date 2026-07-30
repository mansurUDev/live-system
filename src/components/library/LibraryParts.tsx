import { useState } from 'react'
import { fmtD } from '../../logic/time'
import { btnGhostSm, C, input, MONO } from '../../theme'
import type { LibNote } from '../../types'

interface Row {
  label: string
  cur: number
  total: number
  text: string
}

/**
 * Две полосы прогресса под одной книгой: читаешь и слушаешь одно произведение,
 * поэтому позиции показываются рядом, а не смешиваются в одну цифру.
 */
export function DualProgress({ rows, color }: { rows: Row[]; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 11 }}>
      {rows.map((r) => {
        const frac = r.total > 0 ? Math.max(0, Math.min(1, r.cur / r.total)) : 0
        return (
          <div key={r.label}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 11.5, letterSpacing: '1.2px', color: C.dim, textTransform: 'uppercase', minWidth: 74 }}>
                {r.label}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.textSoft }}>{r.text}</span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: 'rgba(148,163,184,.12)',
                overflow: 'hidden',
                marginTop: 4,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: frac * 100 + '%',
                  background: `linear-gradient(90deg,${color}66,${color})`,
                  boxShadow: `0 0 8px ${color}55`,
                  borderRadius: 3,
                  transition: 'width .45s cubic-bezier(.3,.8,.35,1)',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function NotesBlock({
  notes,
  onAdd,
  now,
}: {
  notes: LibNote[]
  onAdd: (text: string) => void
  now: number
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const t = draft.trim()
    if (!t) return
    onAdd(t)
    setDraft('')
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: '2px', color: C.dim, textTransform: 'uppercase' }}>Заметки</div>

      <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          placeholder="мысль или цитата"
          style={{ ...input, marginTop: 0, flex: 1 }}
        />
        <button className="h-ghost-bright" style={btnGhostSm} onClick={add}>
          +
        </button>
      </div>

      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 9, maxHeight: 200, overflow: 'auto' }}>
          {notes.map((n, i) => (
            <div key={n.d + i} style={{ fontSize: 13.5, color: C.textSoft, lineHeight: 1.45 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.faint, marginRight: 8 }}>{fmtD(n.d, now)}</span>
              <span style={{ overflowWrap: 'anywhere' }}>{n.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
