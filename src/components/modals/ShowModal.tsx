import { useState } from 'react'
import { Modal } from './Modal'
import { PAL, SHOW_KIND_LABELS, SHOW_KINDS } from '../../constants'
import { cleanShareUrl } from '../../logic/links'
import { A } from '../../state/actions'
import { btnAccent, btnGhost, C, chipBtn, errText, fieldLabel, input, swatch } from '../../theme'
import type { Show, ShowKind } from '../../types'

interface Props {
  usedColors: string[]
  onCancel: () => void
  onCreate: (show: Show) => void
}

export function ShowModal({ usedColors, onCancel, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ShowKind>('film')
  const [color, setColor] = useState(PAL.find((c) => !usedColors.includes(c)) ?? PAL[8]!)
  const [link, setLink] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    const t = title.trim()
    if (!t) return setError('Напиши название')
    onCreate(A.newShow(t, kind, color, link.trim() ? cleanShareUrl(link.trim()) : ''))
  }

  return (
    <Modal
      title="Новое в очереди"
      width={440}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnGhost} onClick={onCancel}>
            Отмена
          </button>
          <button className="h-accent" style={btnAccent} onClick={submit}>
            Добавить
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
            <button key={k} style={chipBtn(kind === k, '#60a5fa')} onClick={() => setKind(k)}>
              {SHOW_KIND_LABELS[k]}
            </button>
          ))}
        </div>
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
