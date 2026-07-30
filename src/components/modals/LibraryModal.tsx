import { useState } from 'react'
import { Modal } from './Modal'
import { MAX_SECTIONS, PAL } from '../../constants'
import { parseAudio } from '../../logic/library'
import { A } from '../../state/actions'
import { btnAccent, btnGhost, C, errText, fieldLabel, input, swatch } from '../../theme'
import type { Book, Course } from '../../types'

interface Props {
  kind: 'book' | 'course'
  usedColors: string[]
  onCancel: () => void
  onCreate: (item: Book | Course) => void
}

export function LibraryModal({ kind, usedColors, onCancel, onCreate }: Props) {
  const isBook = kind === 'book'
  const [title, setTitle] = useState('')
  const [by, setBy] = useState('')
  const [color, setColor] = useState(PAL.find((c) => !usedColors.includes(c)) ?? PAL[2])
  const [pages, setPages] = useState('')
  const [audio, setAudio] = useState('')
  const [sections, setSections] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    const t = title.trim()
    if (!t) return setError('Напиши название')

    if (isBook) {
      const total = parseInt(pages.replace(/\s/g, ''), 10)
      if (!(total > 0)) return setError('Сколько всего страниц?')
      onCreate(A.newBook(t, by.trim(), color, total, audio.trim() ? parseAudio(audio) : 0))
      return
    }

    const list = sections
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!list.length) return setError('Добавь разделы — по одному на строку')
    onCreate(A.newCourse(t, by.trim(), color, list.slice(0, MAX_SECTIONS)))
  }

  return (
    <Modal
      title={isBook ? 'Новая книга' : 'Новый курс'}
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
          placeholder={isBook ? 'Атлант расправил плечи' : 'React с нуля'}
          style={input}
        />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>{isBook ? 'Автор' : 'Платформа'}</div>
        <input
          value={by}
          onChange={(e) => setBy(e.target.value)}
          placeholder={isBook ? 'Айн Рэнд' : 'Udemy'}
          style={input}
        />
      </div>

      {isBook ? (
        <div style={{ display: 'flex', gap: 10, marginTop: 13 }}>
          <div style={{ flex: 1 }}>
            <div style={fieldLabel}>Всего страниц</div>
            <input
              value={pages}
              onChange={(e) => {
                setPages(e.target.value)
                setError('')
              }}
              inputMode="numeric"
              placeholder="300"
              style={input}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={fieldLabel}>
              Аудио <span style={{ color: C.faint }}>— если слушаешь</span>
            </div>
            <input value={audio} onChange={(e) => setAudio(e.target.value)} placeholder="9:40" style={input} />
          </div>
        </div>
      ) : (
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
      )}

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
