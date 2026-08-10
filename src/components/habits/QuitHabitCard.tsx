import { useState } from 'react'
import { MAX_SLIP_WHY } from '../../constants'
import { slipsInDays } from '../../logic/habits'
import { fmtD, plural } from '../../logic/time'
import { useNow } from '../../state/NowProvider'
import { btnCancelSm, btnDeleteConfirm, C, input, MONO, plainCard } from '../../theme'
import type { Habit } from '../../types'

interface Props {
  habit: Habit
  days: number
  best: number
  confirming: boolean
  onAsk: () => void
  onCancel: () => void
  onBreak: (why: string) => void
  onEdit: () => void
}

export function QuitHabitCard({ habit, days, best, confirming, onAsk, onCancel, onBreak, onEdit }: Props) {
  const now = useNow()
  const c = habit.color
  const [why, setWhy] = useState('')
  const [journalOpen, setJournalOpen] = useState(false)

  const month = slipsInDays(habit, 30, now)
  const recent = [...habit.slips].slice(-3).reverse()

  const confirmBreak = () => {
    onBreak(why)
    setWhy('')
  }

  return (
    <div style={plainCard({ padding: '16px 16px 12px', textAlign: 'center', position: 'relative' })}>
      <button
        className="h-edit"
        onClick={onEdit}
        aria-label="Изменить привычку"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          fontFamily: 'inherit',
          fontSize: 12,
          color: C.muted,
          background: 'none',
          border: '1px solid rgba(148,163,184,.3)',
          borderRadius: 7,
          padding: '3px 8px',
          cursor: 'pointer',
        }}
      >
        ✎
      </button>

      <div style={{ fontSize: 14.5, fontWeight: 600, color: '#e9f1ff', overflowWrap: 'anywhere', paddingRight: 30 }}>
        {habit.name}
      </div>

      {/* счётчик — главный элемент карточки: он и держит */}
      <div
        style={{
          fontFamily: MONO,
          fontSize: 52,
          fontWeight: 600,
          lineHeight: 1.05,
          color: c,
          textShadow: `0 0 22px ${c}66`,
          marginTop: 6,
        }}
      >
        {days}
      </div>
      <div style={{ fontSize: 12, letterSpacing: '2px', color: C.dim, textTransform: 'uppercase' }}>
        {plural(days, 'день', 'дня', 'дней')} без
      </div>
      <div style={{ fontSize: 12.5, color: C.faint, marginTop: 6 }}>
        рекорд {best} {plural(best, 'день', 'дня', 'дней')}
        {/* ноль после срыва — не чистый лист: сколько раз за месяц, видно всегда */}
        {month > 0 && (
          <>
            {' · '}
            <span style={{ color: month >= 3 ? C.dangerText : C.faint }}>
              {month} {plural(month, 'срыв', 'срыва', 'срывов')} за месяц
            </span>
          </>
        )}
      </div>

      {habit.slips.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setJournalOpen((v) => !v)}
            style={{
              fontFamily: 'inherit',
              fontSize: 12,
              color: C.muted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {journalOpen ? 'скрыть журнал' : 'журнал срывов ▸'}
          </button>
          {journalOpen && (
            <div style={{ marginTop: 6, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recent.map((s) => (
                <div key={s.d} style={{ fontSize: 12.5, color: C.textSoft, lineHeight: 1.4 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.faint, marginRight: 7 }}>
                    {fmtD(s.d, now)}
                  </span>
                  {s.why || 'без причины'}
                </div>
              ))}
              {habit.slips.length > recent.length && (
                <div style={{ fontSize: 11.5, color: C.faint }}>…и ещё {habit.slips.length - recent.length}</div>
              )}
            </div>
          )}
        </div>
      )}

      {confirming ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.45 }}>
            Серия {days} {plural(days, 'день', 'дня', 'дней')} обнулится
            {month > 0 ? ` — это будет ${month + 1}-й срыв за месяц` : ''}.
          </div>
          {/* причина — самое ценное в срыве: через месяц по журналу видно, что валит */}
          <input
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            maxLength={MAX_SLIP_WHY}
            placeholder="почему? — гости, устал, стресс…"
            autoFocus
            style={{ ...input, marginTop: 8, fontSize: 13.5 }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <button style={btnDeleteConfirm} onClick={confirmBreak}>
              Да, сорвался
            </button>
            <button style={btnCancelSm} onClick={onCancel}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        // кнопка намеренно неприметная: нажимать её должно быть не по пути
        <button
          onClick={onAsk}
          style={{
            marginTop: 12,
            fontFamily: 'inherit',
            fontSize: 12.5,
            color: C.danger,
            background: 'none',
            border: '1px solid rgba(248,113,113,.28)',
            borderRadius: 8,
            padding: '5px 14px',
            cursor: 'pointer',
            opacity: 0.75,
          }}
        >
          сорвался
        </button>
      )}
    </div>
  )
}
