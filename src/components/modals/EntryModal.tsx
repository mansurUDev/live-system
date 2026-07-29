import { useState } from 'react'
import { Modal } from './Modal'
import { actBy } from '../../logic/analytics'
import { findConflict, resolveEnd } from '../../logic/overlap'
import { hhmm, localDateKey } from '../../logic/time'
import { uid } from '../../logic/uid'
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
} from '../../theme'
import type { Activity, TimeEntry } from '../../types'

/** Запас на то, что пользователь заполняет форму не мгновенно */
const FUTURE_TOLERANCE_MS = 60_000

interface Props {
  /** null — создаём новую запись задним числом */
  entry: TimeEntry | null
  acts: Activity[]
  entries: TimeEntry[]
  /** день, открытый в ленте — подставляется в новую запись */
  defaultDayStart: number
  onCancel: () => void
  onSave: (entry: TimeEntry) => void
  onDelete: (id: string) => void
}

export function EntryModal({
  entry,
  acts,
  entries,
  defaultDayStart,
  onCancel,
  onSave,
  onDelete,
}: Props) {
  const isEdit = !!entry
  const wasRunning = !!entry && !entry.end

  const [actId, setActId] = useState(entry?.actId ?? acts[0]?.id ?? '')
  const [date, setDate] = useState(
    entry ? localDateKey(new Date(entry.start)) : localDateKey(defaultDayStart),
  )
  const [start, setStart] = useState(entry ? hhmm(new Date(entry.start)) : '12:00')
  const [end, setEnd] = useState(entry?.end ? hhmm(new Date(entry.end)) : entry ? '' : '13:00')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = () => {
    if (!acts.some((a) => a.id === actId)) return setError('Выбери активность')
    if (!date || !start) return setError('Укажи дату и время начала')

    const startMs = new Date(`${date}T${start}`).getTime()
    if (!Number.isFinite(startMs)) return setError('Не получилось разобрать время')
    if (startMs > Date.now() + FUTURE_TOLERANCE_MS) {
      return setError('Начало не может быть в будущем')
    }

    let endMs: number | null = null
    if (end) {
      const raw = new Date(`${date}T${end}`).getTime()
      const resolved = resolveEnd(startMs, raw)
      if (!resolved.ok) return setError(resolved.error)
      endMs = resolved.end
    } else if (!wasRunning) {
      return setError('Укажи время конца')
    }

    const conflict = findConflict(entries, { start: startMs, end: endMs }, entry?.id)
    if (conflict) {
      const name = actBy(acts, conflict.actId)?.name ?? 'другой записью'
      const from = hhmm(new Date(conflict.start))
      const to = conflict.end ? hhmm(new Date(conflict.end)) : '…'
      return setError(`Пересекается с «${name}» ${from}–${to}`)
    }

    onSave({
      id: entry?.id ?? uid('e'),
      actId,
      start: new Date(startMs).toISOString(),
      end: endMs === null ? null : new Date(endMs).toISOString(),
    })
  }

  return (
    <Modal
      title={isEdit ? 'Запись времени' : 'Запись задним числом'}
      width={480}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          {isEdit &&
            (confirmDelete ? (
              <>
                <button style={btnDeleteConfirm} onClick={() => onDelete(entry.id)}>
                  Точно удалить
                </button>
                <button style={btnCancelSm} onClick={() => setConfirmDelete(false)}>
                  Отмена
                </button>
              </>
            ) : (
              <button style={btnDeleteLink} onClick={() => setConfirmDelete(true)}>
                Удалить запись
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
      <div style={{ marginTop: 12 }}>
        <div style={fieldLabel}>Активность</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 6 }}>
          {acts.map((a) => (
            <button
              key={a.id}
              style={chipBtn(actId === a.id, a.color)}
              onClick={() => {
                setActId(a.id)
                setError('')
              }}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 13, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <div style={fieldLabel}>Дата</div>
          <input
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setError('')
            }}
            type="date"
            style={{ ...input, padding: '8px 11px' }}
          />
        </div>
        <div style={{ width: 110 }}>
          <div style={fieldLabel}>Начало</div>
          <input
            value={start}
            onChange={(e) => {
              setStart(e.target.value)
              setError('')
            }}
            type="time"
            style={{ ...input, padding: '8px 11px' }}
          />
        </div>
        <div style={{ width: 110 }}>
          <div style={fieldLabel}>Конец</div>
          <input
            value={end}
            onChange={(e) => {
              setEnd(e.target.value)
              setError('')
            }}
            type="time"
            style={{ ...input, padding: '8px 11px' }}
          />
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: C.faint, marginTop: 8 }}>
        Если конец раньше начала — запись уйдёт за полночь.
      </div>
      {wasRunning && (
        <div style={{ fontSize: 12.5, color: C.cyanBright, marginTop: 4 }}>
          Это идущая запись: оставь «Конец» пустым, чтобы она продолжалась.
        </div>
      )}

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
