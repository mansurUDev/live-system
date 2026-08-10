import { useState } from 'react'
import { Modal } from './Modal'
import { MAX_HABIT_NAME, PAL } from '../../constants'
import { A } from '../../state/actions'
import {
  btnAccent,
  btnCancelSm,
  btnDeleteConfirm,
  btnDeleteLink,
  btnGhost,
  C,
  chipBtn,
  errText,
  fieldLabel,
  input,
  swatch,
} from '../../theme'
import type { Habit, HabitType } from '../../types'

const TYPES: { key: HabitType; label: string; hint: string }[] = [
  { key: 'do', label: 'Делаю каждый день', hint: 'серия растёт, пока не пропустишь' },
  { key: 'quit', label: 'Держусь без', hint: 'счётчик дней без срыва и журнал причин' },
  { key: 'log', label: 'Замер', hint: 'время числом, без «смог/не смог» — для того, что не полностью в твоей власти' },
]

/** Часы, в которые чаще всего случаются срывы, — быстрые пресеты */
const RISK_PRESETS = [15, 21, 22, 23, 0]

interface Props {
  /** null — создаём новую */
  habit: Habit | null
  usedColors: string[]
  onCancel: () => void
  onSave: (habit: Habit) => void
  onDelete: (id: string) => void
}

export function HabitModal({ habit, usedColors, onCancel, onSave, onDelete }: Props) {
  const [type, setType] = useState<HabitType>(habit?.type ?? 'do')
  const [name, setName] = useState(habit?.name ?? '')
  const [color, setColor] = useState(habit?.color ?? PAL.find((c) => !usedColors.includes(c)) ?? PAL[1])
  const [riskHour, setRiskHour] = useState<number | null>(habit?.riskHour ?? null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return setError('Напиши название')

    // тип у заведённой привычки не меняем: у «делаю» и «держусь без» разные
    // счётчики, и подмена обнулила бы накопленное
    const base = habit ?? A.newHabit(type, trimmed.slice(0, MAX_HABIT_NAME), color)
    onSave({ ...base, name: trimmed.slice(0, MAX_HABIT_NAME), color, riskHour })
  }

  return (
    <Modal
      title={habit ? 'Привычка' : 'Новая привычка'}
      width={440}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          {habit &&
            (confirmDelete ? (
              <>
                <button style={btnDeleteConfirm} onClick={() => onDelete(habit.id)}>
                  Точно удалить
                </button>
                <button style={btnCancelSm} onClick={() => setConfirmDelete(false)}>
                  Отмена
                </button>
              </>
            ) : (
              <button style={btnDeleteLink} onClick={() => setConfirmDelete(true)}>
                Удалить привычку
              </button>
            ))}
          <div style={{ flex: 1 }} />
          <button style={btnGhost} onClick={onCancel}>
            Отмена
          </button>
          <button className="h-accent" style={btnAccent} onClick={submit}>
            Сохранить
          </button>
        </div>
      }
    >
      {!habit && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              style={{
                textAlign: 'left',
                width: '100%',
                fontFamily: 'inherit',
                color: '#dbe4f5',
                cursor: 'pointer',
                padding: '9px 13px',
                borderRadius: 11,
                border: `1px solid ${type === t.key ? 'rgba(94,234,255,.55)' : 'rgba(148,163,184,.2)'}`,
                background: type === t.key ? 'rgba(34,211,238,.1)' : 'rgba(148,163,184,.04)',
                ...(type === t.key ? { boxShadow: '0 0 14px rgba(34,211,238,.2)' } : null),
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 15 }}>{t.label}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: C.muted, marginTop: 1 }}>{t.hint}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Название</div>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          type="text"
          maxLength={MAX_HABIT_NAME}
          placeholder={
            type === 'quit' ? 'например, Газировка' : type === 'log' ? 'например, Во сколько лёг' : 'например, Английский 40 минут'
          }
          style={input}
        />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Цвет</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {PAL.map((c) => (
            <button key={c} style={swatch(color === c, c)} onClick={() => setColor(c)} aria-label={'Цвет ' + c} />
          ))}
        </div>
      </div>

      {(habit?.type ?? type) !== 'log' && (
        <div style={{ marginTop: 13 }}>
          <div style={fieldLabel}>
            Час риска <span style={{ color: C.faint }}>— необязательно</span>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 6 }}>
            <button style={chipBtn(riskHour === null, '#94a3b8')} onClick={() => setRiskHour(null)}>
              нет
            </button>
            {RISK_PRESETS.map((hh) => (
              <button key={hh} style={chipBtn(riskHour === hh, '#f87171')} onClick={() => setRiskHour(hh)}>
                {hh}:00
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 5, lineHeight: 1.45 }}>
            время, к которому обычно случается срыв или становится поздно — брифинг предупредит за
            пару часов, пока решение ещё можно принять
          </div>
        </div>
      )}

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
