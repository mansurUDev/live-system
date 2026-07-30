import { plural } from '../../logic/time'
import { btnCancelSm, btnDeleteConfirm, C, MONO, plainCard } from '../../theme'
import type { Habit } from '../../types'

interface Props {
  habit: Habit
  days: number
  best: number
  confirming: boolean
  onAsk: () => void
  onCancel: () => void
  onBreak: () => void
  onEdit: () => void
}

export function QuitHabitCard({ habit, days, best, confirming, onAsk, onCancel, onBreak, onEdit }: Props) {
  const c = habit.color

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
      </div>

      {confirming ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.45 }}>
            Точно? Серия {days} {plural(days, 'день', 'дня', 'дней')} обнулится.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <button style={btnDeleteConfirm} onClick={onBreak}>
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
