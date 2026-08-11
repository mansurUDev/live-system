import { useState } from 'react'
import { fmtD } from '../../logic/time'
import { btnAccent, btnGhostSm, C, chipSquare, input, MONO, plainCard } from '../../theme'
import type { LibDone, LibNote } from '../../types'

/** Заголовок полки с кнопкой добавления — общий для «Книг», «Учёбы» и «Смотреть» */
export function Shelf({ title, subtitle, onAdd }: { title: string; subtitle: string; onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.textBright }}>{title}</div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ flex: 1 }} />
      <button className="h-accent" style={{ ...btnAccent, fontSize: 13.5, padding: '8px 14px' }} onClick={onAdd}>
        + Добавить
      </button>
    </div>
  )
}

export function Empty({ text }: { text: string }) {
  return <div style={plainCard({ padding: 18, color: C.faint, fontSize: 14 })}>{text}</div>
}

const DONE_LABELS: Record<LibDone['kind'], string> = {
  book: 'книга',
  course: 'курс',
  video: 'видео',
  show: 'просмотрено',
}

/**
 * Полка завершённого. Записи всех видов лежат в одном списке `lib.done`, но
 * каждая вкладка показывает только своё: книги — в «Книгах», курсы и видео —
 * в «Учёбе», фильмы и сериалы — в «Смотреть».
 */
export function DoneShelf({ items, title, now }: { items: LibDone[]; title: string; now: number }) {
  if (!items.length) return null

  return (
    <>
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.textBright }}>{title}</div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>{items.length} на полке</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((d) => (
          <div key={d.id} style={plainCard({ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' })}>
            <span style={chipSquare(d.color)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.textBright, overflowWrap: 'anywhere' }}>
                {d.title}
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
                {d.byline}
                {d.byline ? ' · ' : ''}
                {DONE_LABELS[d.kind]}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.faint, marginTop: 3 }}>
                {fmtD(d.startedAt, now)} → {fmtD(d.finishedAt, now)}
              </div>
              {d.quote && (
                <div
                  style={{
                    fontSize: 14.5,
                    fontStyle: 'italic',
                    color: C.textSoft,
                    marginTop: 8,
                    paddingLeft: 12,
                    borderLeft: `2px solid ${d.color}88`,
                    lineHeight: 1.5,
                    overflowWrap: 'anywhere',
                  }}
                >
                  «{d.quote}»
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

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
