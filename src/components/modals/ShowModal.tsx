import { useState } from 'react'
import { Modal } from './Modal'
import { MAX_SHOW_KIND, PAL, SHOW_KIND_LABELS, SHOW_KINDS } from '../../constants'
import { cleanShareUrl } from '../../logic/links'
import { A } from '../../state/actions'
import { btnAccent, btnGhost, C, chipBtn, errText, fieldLabel, input, swatch } from '../../theme'
import type { Show } from '../../types'

interface Props {
  usedColors: string[]
  /** запись для правки; без неё модалка создаёт новую */
  initial?: Show
  onCancel: () => void
  onSave: (show: Show) => void
}

export function ShowModal({ usedColors, initial, onCancel, onSave }: Props) {
  const builtinInitial = initial !== undefined && (SHOW_KINDS as readonly string[]).includes(initial.kind)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [kind, setKind] = useState<string>(builtinInitial ? initial!.kind : 'film')
  // null — выбран встроенный вид; строка — включён режим своей категории
  const [custom, setCustom] = useState<string | null>(
    initial !== undefined && !builtinInitial ? initial.kind : null,
  )
  const [color, setColor] = useState(
    initial?.color ?? (PAL.find((c) => !usedColors.includes(c)) ?? PAL[8]!),
  )
  const [link, setLink] = useState(initial?.link ?? '')
  const [error, setError] = useState('')

  const submit = () => {
    const t = title.trim()
    if (!t) return setError('Напиши название')
    if (custom !== null && !custom.trim()) return setError('Напиши свою категорию')
    const k = custom !== null ? custom.trim().slice(0, MAX_SHOW_KIND) : kind
    const cleanLink = link.trim() ? cleanShareUrl(link.trim()) : ''
    onSave(initial ? { ...initial, title: t, kind: k, color, link: cleanLink } : A.newShow(t, k, color, cleanLink))
  }

  return (
    <Modal
      title={initial ? 'Изменить' : 'Новое в очереди'}
      width={440}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnGhost} onClick={onCancel}>
            Отмена
          </button>
          <button className="h-accent" style={btnAccent} onClick={submit}>
            {initial ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      }
    >
      <div style={{ marginTop: 12 }}>
        <div style={fieldLabel}>Название</div>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setError('')
          }}
          autoFocus
          placeholder="Начало"
          style={input}
        />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Вид</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {SHOW_KINDS.map((k) => (
            <button
              key={k}
              style={chipBtn(custom === null && kind === k, '#60a5fa')}
              onClick={() => {
                setKind(k)
                setCustom(null)
              }}
            >
              {SHOW_KIND_LABELS[k]}
            </button>
          ))}
          <button style={chipBtn(custom !== null, '#60a5fa')} onClick={() => setCustom((c) => c ?? '')}>
            Своя…
          </button>
        </div>
        {custom !== null && (
          <input
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value)
              setError('')
            }}
            autoFocus
            maxLength={MAX_SHOW_KIND}
            placeholder="Стендапы"
            aria-label="Своя категория"
            style={input}
          />
        )}
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>
          Где смотрю <span style={{ color: C.faint }}>— необязательно</span>
        </div>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" style={input} />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Цвет</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {PAL.map((c) => (
            <button key={c} style={swatch(color === c, c)} onClick={() => setColor(c)} aria-label={'Цвет ' + c} />
          ))}
        </div>
      </div>

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
