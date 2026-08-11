import { useState } from 'react'
import { Modal } from './Modal'
import { MAX_SECTIONS, PAL } from '../../constants'
import { A } from '../../state/actions'
import { btnAccent, btnGhost, errText, fieldLabel, input, swatch } from '../../theme'
import type { Course } from '../../types'

interface Props {
  usedColors: string[]
  onCancel: () => void
  onCreate: (course: Course) => void
}

export function CourseModal({ usedColors, onCancel, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const [by, setBy] = useState('')
  const [color, setColor] = useState(PAL.find((c) => !usedColors.includes(c)) ?? PAL[2]!)
  const [sections, setSections] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    const t = title.trim()
    if (!t) return setError('Напиши название')

    const list = sections
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!list.length) return setError('Добавь разделы — по одному на строку')
    onCreate(A.newCourse(t, by.trim(), color, list.slice(0, MAX_SECTIONS)))
  }

  return (
    <Modal
      title="Новый курс"
      width={460}
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
          placeholder="React с нуля"
          style={input}
        />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Платформа</div>
        <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Udemy" style={input} />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Разделы — по одному на строку</div>
        <textarea
          value={sections}
          onChange={(e) => {
            setSections(e.target.value)
            setError('')
          }}
          rows={6}
          placeholder={'Основы\nХуки\nРоутинг\nТесты'}
          style={{ ...input, resize: 'vertical' }}
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

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
