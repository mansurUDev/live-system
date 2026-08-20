import { useMemo, useState } from 'react'
import { DAY_MS } from '../../constants'
import { actBy } from '../../logic/analytics'
import { addDays, fmtDur, hhmm, startOfDay } from '../../logic/time'
import { btnGhostSm, C, card, chipDot, iconBtn, MONO } from '../../theme'
import type { Activity, TimeEntry } from '../../types'

interface Props {
  entries: TimeEntry[]
  acts: Activity[]
  now: number
  dayOffset: number
  onPrevDay: () => void
  onNextDay: () => void
  onEditEntry: (entry: TimeEntry) => void
  onAddBackdated: () => void
}

/** Лента суток и список записей выбранного дня */
export function DayView({
  entries,
  acts,
  now,
  dayOffset,
  onPrevDay,
  onNextDay,
  onEditEntry,
  onAddBackdated,
}: Props) {
  const dayStart = addDays(startOfDay(now), dayOffset)
  const dayEnd = addDays(dayStart, 1)

  // Свой тултип вместо нативного title=: у браузера подсказка всплывает с
  // задержкой в секунду, а тут блоки в среднем секунд на 43 узкие — наведение
  // на них должно отвечать сразу, а не после паузы.
  const [hovered, setHovered] = useState<{ title: string; leftPct: number } | null>(null)

  const { blocks, rows, trackedMs } = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    const blocks: { entry: TimeEntry; left: number; width: number; color: string; title: string }[] = []
    const rows: { entry: TimeEntry; time: string; name: string; color: string; dur: string }[] = []
    let trackedMs = 0

    for (const e of sorted) {
      const s = new Date(e.start).getTime()
      if (!Number.isFinite(s)) continue
      const end = e.end ? new Date(e.end).getTime() : now
      if (end <= dayStart || s >= dayEnd) continue

      const from = Math.max(s, dayStart)
      const to = Math.min(end, dayEnd)
      if (to <= from) continue

      const act = actBy(acts, e.actId)
      const color = act?.color ?? '#64748b'
      const name = act?.name ?? '(удалённая)'
      trackedMs += to - from

      blocks.push({
        entry: e,
        left: ((from - dayStart) / DAY_MS) * 100,
        width: Math.max(0.35, ((to - from) / DAY_MS) * 100),
        color,
        title: `${name} · ${hhmm(from)}–${hhmm(to)}`,
      })
      rows.push({
        entry: e,
        time: hhmm(s) + '–' + (e.end ? hhmm(end) : '…'),
        name,
        color,
        dur: fmtDur(end - s),
      })
    }
    return { blocks, rows, trackedMs }
  }, [entries, acts, now, dayStart, dayEnd])

  const dayLabel =
    dayOffset === 0
      ? 'Сегодня'
      : dayOffset === -1
        ? 'Вчера'
        : new Date(dayStart).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  return (
    <div style={card({ padding: '15px 17px' })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button className="h-ghost-bright" style={{ ...iconBtn(30), fontSize: 15 }} onClick={onPrevDay} aria-label="Предыдущий день">
          ‹
        </button>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.textBright, minWidth: 90, textAlign: 'center' }}>
          {dayLabel}
        </div>
        {dayOffset < 0 && (
          <button className="h-ghost-bright" style={{ ...iconBtn(30), fontSize: 15 }} onClick={onNextDay} aria-label="Следующий день">
            ›
          </button>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: C.muted }}>Отслежено: {fmtDur(trackedMs)}</div>
      </div>

      <div
        style={{
          position: 'relative',
          height: 38,
          borderRadius: 8,
          background: 'rgba(6,10,20,.85)',
          border: '1px solid rgba(110,160,255,.14)',
          overflow: 'hidden',
          marginTop: 12,
        }}
      >
        {blocks.map((b) => (
          <div
            key={b.entry.id}
            onClick={() => onEditEntry(b.entry)}
            onMouseEnter={() => setHovered({ title: b.title, leftPct: b.left + b.width / 2 })}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: 'absolute',
              top: 5,
              bottom: 5,
              left: b.left.toFixed(3) + '%',
              width: b.width.toFixed(3) + '%',
              background: b.color + 'cc',
              boxShadow: `0 0 8px ${b.color}66`,
              borderRadius: 3,
              cursor: 'pointer',
            }}
          />
        ))}

        {hovered && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: `${Math.min(96, Math.max(4, hovered.leftPct))}%`,
              transform: 'translateX(-50%)',
              marginBottom: 6,
              padding: '4px 9px',
              borderRadius: 7,
              background: 'rgba(8,13,26,.96)',
              border: '1px solid rgba(148,163,184,.3)',
              boxShadow: '0 4px 16px rgba(0,0,0,.4)',
              fontFamily: MONO,
              fontSize: 12,
              color: C.textBright,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            {hovered.title}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: MONO,
          fontSize: 10.5,
          color: C.faint,
          marginTop: 4,
        }}
      >
        {['00', '06', '12', '18', '24'].map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        {rows.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 290, overflow: 'auto' }}>
            {rows.map((r) => (
              <div
                key={r.entry.id}
                className="h-row-soft"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px', borderRadius: 8 }}
              >
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.muted, flex: 'none', minWidth: 96 }}>
                  {r.time}
                </span>
                <span style={chipDot(r.color)} />
                <span style={{ fontSize: 14.5, color: C.text, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                  {r.name}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.muted, flex: 'none' }}>{r.dur}</span>
                <button
                  className="h-edit"
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 12,
                    color: C.cyanBright,
                    background: 'none',
                    border: '1px solid rgba(94,234,255,.35)',
                    borderRadius: 7,
                    padding: '3px 9px',
                    cursor: 'pointer',
                    flex: 'none',
                  }}
                  onClick={() => onEditEntry(r.entry)}
                  aria-label="Изменить запись"
                >
                  ✎
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13.5, color: C.faint, padding: '4px 2px' }}>За этот день записей нет</div>
        )}

        <button
          className="h-ghost-bright"
          style={{ ...btnGhostSm, marginTop: 10, border: '1px dashed rgba(148,163,184,.4)', padding: '7px 14px' }}
          onClick={onAddBackdated}
        >
          + Запись задним числом
        </button>
      </div>
    </div>
  )
}
