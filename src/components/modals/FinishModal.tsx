import { useState } from 'react'
import { Modal } from './Modal'
import { MAX_QUOTE } from '../../constants'
import { btnAccent, btnGhost, C, fieldLabel, input } from '../../theme'

interface Props {
  title: string
  onCancel: () => void
  onConfirm: (quote: string) => void
}

/**
 * Завершение книги или курса. Цитата не обязательна, но именно она потом делает
 * полку живой — поэтому её спрашивают в момент, когда впечатление ещё свежее.
 */
export function FinishModal({ title, onCancel, onConfirm }: Props) {
  const [quote, setQuote] = useState('')

  return (
    <Modal
      title="На полку"
      width={440}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnGhost} onClick={onCancel}>
            Отмена
          </button>
          <button className="h-accent" style={btnAccent} onClick={() => onConfirm(quote.trim().slice(0, MAX_QUOTE))}>
            Готово
          </button>
        </div>
      }
    >
      <div style={{ marginTop: 12, fontSize: 15, color: C.textBright, overflowWrap: 'anywhere' }}>«{title}»</div>
      <div style={{ fontSize: 13.5, color: C.muted, marginTop: 4 }}>
        Уедет на полку «Прочитано и изучено» с датами начала и конца.
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={fieldLabel}>
          Что запомнилось <span style={{ color: C.faint }}>— необязательно</span>
        </div>
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          rows={3}
          maxLength={MAX_QUOTE}
          placeholder="фраза или мысль, ради которой стоило"
          style={{ ...input, resize: 'vertical' }}
        />
      </div>
    </Modal>
  )
}
