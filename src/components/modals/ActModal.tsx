import { useState } from 'react'
import { Modal } from './Modal'
import { CAT_KEYS, CATS, MAX_ACT_NAME, PAL } from '../../constants'
import { mergeAct } from '../../logic/actLayout'
import { uid } from '../../logic/uid'
import { plural } from '../../logic/time'
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
import type { Activity, Category, TimeEntry } from '../../types'

interface Props {
  /** null — создаём новую кнопку */
  act: Activity | null
  acts: Activity[]
  entries: TimeEntry[]
  onCancel: () => void
  onSave: (act: Activity) => void
  onDelete: (id: string) => void
}

export function ActModal({ act, acts, entries, onCancel, onSave, onDelete }: Props) {
  const [name, setName] = useState(act?.name ?? '')
  const [cat, setCat] = useState<Category>(act?.cat ?? 'byt')
  const [color, setColor] = useState(act?.color ?? PAL[Math.floor(Math.random() * 8)]!)
  // защита от битой ссылки — например, кнопку-цель удалили в другой вкладке
  const [nextId, setNextId] = useState<string | null>(() =>
    act?.nextId && acts.some((a) => a.id === act.nextId) ? act.nextId : null,
  )
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const usageCount = act ? entries.filter((e) => e.actId === act.id).length : 0
  const chainTargets = acts.filter((a) => a.id !== act?.id)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return setError('Напиши название')
    onSave(
      mergeAct(act, {
        id: act?.id ?? uid('act'),
        name: trimmed.slice(0, MAX_ACT_NAME),
        color,
        cat,
        ...(nextId ? { nextId } : null),
      }),
    )
  }

  return (
    <Modal
      title={act ? 'Кнопка активности' : 'Новая кнопка'}
      width={460}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          {act &&
            (confirmDelete ? (
              <>
                <button style={btnDeleteConfirm} onClick={() => onDelete(act.id)}>
                  Точно удалить
                </button>
                <button style={btnCancelSm} onClick={() => setConfirmDelete(false)}>
                  Отмена
                </button>
              </>
            ) : (
              <button style={btnDeleteLink} onClick={() => setConfirmDelete(true)}>
                Удалить кнопку
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
        <div style={fieldLabel}>Название</div>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          type="text"
          maxLength={MAX_ACT_NAME}
          placeholder="например, Чтение"
          style={input}
        />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Категория</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 6 }}>
          {CAT_KEYS.map((k) => (
            <button key={k} style={chipBtn(cat === k, CATS[k].color)} onClick={() => setCat(k)}>
              {CATS[k].label.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Цвет</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {PAL.map((c) => (
            <button key={c} style={swatch(color === c, c)} onClick={() => setColor(c)} aria-label={'Цвет ' + c} />
          ))}
        </div>
      </div>

      {chainTargets.length > 0 && (
        <div style={{ marginTop: 13 }}>
          <div style={fieldLabel}>Обычно после неё идёт…</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 6 }}>
            <button style={chipBtn(nextId === null, '#94a3b8')} onClick={() => setNextId(null)}>
              нет
            </button>
            {chainTargets.map((a) => (
              <button key={a.id} style={chipBtn(nextId === a.id, a.color)} onClick={() => setNextId(a.id)}>
                {a.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {confirmDelete && usageCount > 0 && (
        <div style={{ marginTop: 12, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          {usageCount} {plural(usageCount, 'запись', 'записи', 'записей')} по этой кнопке останутся в
          аналитике — они перейдут в категорию «Прочее».
        </div>
      )}

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
