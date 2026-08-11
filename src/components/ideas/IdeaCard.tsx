import { useState } from 'react'
import { btnCancelSm, btnDeleteConfirm, btnDeleteLink, btnEdit, C, chipDot, plainCard } from '../../theme'
import { Lightbox } from './Lightbox'
import type { Idea } from '../../types'

interface Props {
  idea: Idea
  confirmingDelete: boolean
  onToggleDone: () => void
  onEdit: () => void
  onToBook: () => void
  onToExpense: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}

/** После этой длины текст сворачивается в ~4 строки — точный подсчёт строк не нужен, это не типографика */
const COLLAPSE_AT = 220

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function IdeaCard({
  idea,
  confirmingDelete,
  onToggleDone,
  onEdit,
  onToBook,
  onToExpense,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const long = idea.text.length > COLLAPSE_AT

  return (
    <div style={plainCard({ padding: '13px 15px', opacity: idea.done ? 0.7 : 1 })}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <button
          onClick={onToggleDone}
          aria-label={idea.done ? 'Не воплощена' : 'Воплощена'}
          style={{
            marginTop: 2,
            width: 20,
            height: 20,
            borderRadius: 6,
            border: `1.5px solid ${idea.done ? C.ok : 'rgba(148,163,184,.4)'}`,
            background: idea.done ? C.ok : 'transparent',
            color: '#031018',
            fontSize: 13,
            lineHeight: '17px',
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          {idea.done ? '✓' : ''}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 15.5,
                fontWeight: 600,
                color: C.textBright,
                overflowWrap: 'anywhere',
                textDecoration: idea.done ? 'line-through' : 'none',
              }}
            >
              {idea.title}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted }}>
              <span style={chipDot('#fbbf24')} />
              {idea.category}
            </span>
          </div>

          {idea.text && (
            <>
              <div
                style={{
                  fontSize: 14,
                  color: C.textSoft,
                  marginTop: 7,
                  overflowWrap: 'anywhere',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                  ...(expanded
                    ? null
                    : {
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical' as const,
                        overflow: 'hidden',
                      }),
                }}
              >
                {idea.text}
              </div>
              {long && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    marginTop: 4,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    color: C.cyanBright,
                  }}
                >
                  {expanded ? 'свернуть' : 'развернуть'}
                </button>
              )}
            </>
          )}

          {idea.images.length > 0 && (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
              {idea.images.map((url, i) => (
                <button
                  key={url}
                  onClick={() => setLightboxIndex(i)}
                  aria-label="Открыть фото"
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'zoom-in',
                    borderRadius: 8,
                    overflow: 'hidden',
                    flex: 'none',
                    lineHeight: 0,
                  }}
                >
                  <img
                    src={url}
                    alt=""
                    style={{ width: 60, height: 60, objectFit: 'cover', display: 'block' }}
                  />
                </button>
              ))}
            </div>
          )}

          {idea.links.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 9 }}>
              {idea.links.map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: C.cyanBright, overflowWrap: 'anywhere' }}
                >
                  {l.label} <span style={{ color: C.faint }}>· {hostname(l.url)}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 9, marginTop: 11, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="h-edit" onClick={onEdit} aria-label="Изменить идею" style={btnEdit}>
          ✎
        </button>
        {/* книга — не идея: у неё есть позиция и срок, им место во вкладке «Книги» */}
        <button className="h-ghost-bright" style={btnCancelSm} onClick={onToBook}>
          В книги
        </button>
        {/* покупка — не идея: у неё есть цена и срок, им место в «Финансах» */}
        <button className="h-ghost-bright" style={btnCancelSm} onClick={onToExpense}>
          В расходы
        </button>
        <div style={{ flex: 1 }} />
        {confirmingDelete ? (
          <>
            <button style={btnDeleteConfirm} onClick={onDelete}>
              Точно убрать
            </button>
            <button style={btnCancelSm} onClick={onCancelDelete}>
              Отмена
            </button>
          </>
        ) : (
          <button style={btnDeleteLink} onClick={onAskDelete}>
            Убрать
          </button>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox images={idea.images} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  )
}
