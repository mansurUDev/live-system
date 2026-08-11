import { useState } from 'react'
import { Modal } from './Modal'
import { PAL } from '../../constants'
import { cleanShareUrl, isHttpUrl } from '../../logic/links'
import { fmtAudio, parseAudio } from '../../logic/library'
import { A } from '../../state/actions'
import { btnAccent, btnGhost, C, errText, fieldLabel, input, swatch } from '../../theme'
import type { Book } from '../../types'

interface Props {
  /** null — создаём новую книгу */
  book: Book | null
  usedColors: string[]
  onCancel: () => void
  onSave: (book: Book) => void
}

export function BookModal({ book, usedColors, onCancel, onSave }: Props) {
  const [title, setTitle] = useState(book?.title ?? '')
  const [by, setBy] = useState(book?.author ?? '')
  const [color, setColor] = useState(book?.color ?? PAL.find((c) => !usedColors.includes(c)) ?? PAL[2]!)
  const [pages, setPages] = useState(book?.pageTotal ? String(book.pageTotal) : '')
  const [audio, setAudio] = useState(book && book.audioTotal > 0 ? fmtAudio(book.audioTotal) : '')
  const [link, setLink] = useState(book?.audioLink ?? '')
  const [error, setError] = useState('')

  const submit = () => {
    const t = title.trim()
    if (!t) return setError('Напиши название')

    const parsedPages = pages.trim() ? parseInt(pages.replace(/\s/g, ''), 10) : 0
    // на создании объём обязателен — без него нет ни прогресса, ни плана по прочтению;
    // на правке ноль допустим: книга могла приехать из идеи, где страниц ещё не знали
    if (!book && !(parsedPages > 0)) return setError('Сколько всего страниц?')
    const pageTotal = Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : 0

    const rawLink = link.trim()
    const audioLink = rawLink ? cleanShareUrl(rawLink) : ''
    if (rawLink && !isHttpUrl(audioLink)) return setError('Ссылка должна начинаться с http:// или https://')

    const audioTotal = audio.trim() ? parseAudio(audio) : 0

    if (!book) {
      onSave(A.newBook(t, by.trim(), color, pageTotal, audioTotal, audioLink))
      return
    }

    onSave({
      ...book,
      title: t,
      author: by.trim(),
      color,
      pageTotal,
      audioTotal,
      audioLink,
      // объём мог ужаться ниже текущей позиции — иначе прогресс уедет за 100%
      pageCur: pageTotal > 0 ? Math.min(book.pageCur, pageTotal) : book.pageCur,
      audioCur: audioTotal > 0 ? Math.min(book.audioCur, audioTotal) : book.audioCur,
    })
  }

  return (
    <Modal
      title={book ? 'Книга' : 'Новая книга'}
      width={460}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnGhost} onClick={onCancel}>
            Отмена
          </button>
          <button className="h-accent" style={btnAccent} onClick={submit}>
            {book ? 'Сохранить' : 'Добавить'}
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
          placeholder="Атлант расправил плечи"
          style={input}
        />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Автор</div>
        <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Айн Рэнд" style={input} />
      </div>

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

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>
          Ссылка на аудиокнигу <span style={{ color: C.faint }}>— необязательно</span>
        </div>
        <input
          value={link}
          onChange={(e) => {
            setLink(e.target.value)
            setError('')
          }}
          placeholder="https://…"
          style={input}
        />
        <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>
          куда открыть плеер — на карточке появится кнопка «Слушать»
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

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
