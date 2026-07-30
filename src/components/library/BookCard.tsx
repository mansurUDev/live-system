import { useState } from 'react'
import { bookProgress, fmtAudio, parseAudio } from '../../logic/library'
import { fmtD } from '../../logic/time'
import { useNow } from '../../state/NowProvider'
import {
  btnAccent,
  btnCancelSm,
  btnDeleteLink,
  btnDeleteConfirm,
  C,
  chipSquare,
  fieldLabel,
  input,
  MONO,
  plainCard,
} from '../../theme'
import { DualProgress, NotesBlock } from './LibraryParts'
import type { Book } from '../../types'

interface Props {
  book: Book
  open: boolean
  onToggle: () => void
  onSave: (book: Book) => void
  onNote: (text: string) => void
  onFinish: () => void
  onDelete: () => void
}

export function BookCard({ book, open, onToggle, onSave, onNote, onFinish, onDelete }: Props) {
  const now = useNow()
  const [page, setPage] = useState(String(book.pageCur || ''))
  const [audio, setAudio] = useState(book.audioTotal > 0 ? fmtAudio(book.audioCur) : '')
  const [excerpt, setExcerpt] = useState(book.excerpt)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const pct = bookProgress(book)

  const savePosition = () => {
    const p = parseInt(page.replace(/\s/g, ''), 10)
    onSave({
      ...book,
      pageCur: Number.isFinite(p) ? Math.max(0, Math.min(book.pageTotal || p, p)) : book.pageCur,
      audioCur: book.audioTotal > 0 ? Math.min(book.audioTotal, parseAudio(audio)) : book.audioCur,
      excerpt: excerpt.slice(0, 400),
    })
  }

  return (
    <div style={plainCard({ padding: '13px 15px' })}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}
      >
        <span style={chipSquare(book.color)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.textBright, overflowWrap: 'anywhere' }}>
            {book.title}
          </div>
          {book.author && <div style={{ fontSize: 13, color: C.muted, marginTop: 1 }}>{book.author}</div>}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: book.color, flex: 'none' }}>
          {pct}%
        </div>
      </div>

      <DualProgress
        color={book.color}
        rows={[
          { label: 'страницы', cur: book.pageCur, total: book.pageTotal, text: `${book.pageCur} из ${book.pageTotal}` },
          ...(book.audioTotal > 0
            ? [
                {
                  label: 'аудио',
                  cur: book.audioCur,
                  total: book.audioTotal,
                  text: `${fmtAudio(book.audioCur)} из ${fmtAudio(book.audioTotal)}`,
                },
              ]
            : []),
        ]}
      />

      {open && (
        <div style={{ marginTop: 14, borderTop: '1px dashed rgba(148,163,184,.25)', paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 110px' }}>
              <div style={fieldLabel}>Страница</div>
              <input
                value={page}
                onChange={(e) => setPage(e.target.value)}
                inputMode="numeric"
                placeholder="142"
                style={input}
              />
            </div>
            {book.audioTotal > 0 && (
              <div style={{ flex: '1 1 110px' }}>
                <div style={fieldLabel}>Аудио</div>
                <input
                  value={audio}
                  onChange={(e) => setAudio(e.target.value)}
                  placeholder="3:15"
                  style={{ ...input, fontFamily: MONO }}
                />
              </div>
            )}
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={fieldLabel}>Отрывок, где остановился</div>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              placeholder="…и тогда он понял"
              style={{ ...input, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 9, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="h-accent" style={{ ...btnAccent, fontSize: 13.5, padding: '8px 14px' }} onClick={savePosition}>
              Сохранить позицию
            </button>
            <button className="h-ghost-bright" style={btnCancelSm} onClick={onFinish}>
              Дочитал
            </button>
            <div style={{ flex: 1 }} />
            {confirmDelete ? (
              <>
                <button style={btnDeleteConfirm} onClick={onDelete}>
                  Точно убрать
                </button>
                <button style={btnCancelSm} onClick={() => setConfirmDelete(false)}>
                  Отмена
                </button>
              </>
            ) : (
              <button style={btnDeleteLink} onClick={() => setConfirmDelete(true)}>
                Убрать
              </button>
            )}
          </div>

          <NotesBlock notes={book.notes} onAdd={onNote} now={now} />

          <div style={{ fontSize: 12, color: C.faint, marginTop: 10 }}>начата {fmtD(book.startedAt, now)}</div>
        </div>
      )}
    </div>
  )
}
