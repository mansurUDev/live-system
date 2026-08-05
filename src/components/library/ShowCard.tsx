import { useState } from 'react'
import { SHOW_KIND_LABELS } from '../../constants'
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
import type { Show } from '../../types'

interface Props {
  show: Show
  open: boolean
  onToggle: () => void
  onSave: (show: Show) => void
  onFinish: () => void
  onDelete: () => void
}

export function ShowCard({ show, open, onToggle, onSave, onFinish, onDelete }: Props) {
  const now = useNow()
  const [season, setSeason] = useState(String(show.season || ''))
  const [episode, setEpisode] = useState(String(show.episode || ''))
  const [minute, setMinute] = useState(String(show.minute || ''))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isFilm = show.kind === 'film'

  const savePosition = () => {
    const s = parseInt(season.replace(/\s/g, ''), 10)
    const e = parseInt(episode.replace(/\s/g, ''), 10)
    const m = parseInt(minute.replace(/\s/g, ''), 10)
    onSave({
      ...show,
      season: isFilm ? 0 : Number.isFinite(s) ? Math.max(0, s) : show.season,
      episode: isFilm ? 0 : Number.isFinite(e) ? Math.max(0, e) : show.episode,
      minute: Number.isFinite(m) ? Math.max(0, m) : show.minute,
    })
  }

  const positionText = isFilm
    ? show.minute > 0
      ? `на ${show.minute} мин`
      : 'ещё не начал'
    : show.season > 0 || show.episode > 0
      ? `s${show.season}e${show.episode}` + (show.minute > 0 ? `, ${show.minute} мин` : '')
      : 'ещё не начал'

  return (
    <div style={plainCard({ padding: '13px 15px' })}>
      <div onClick={onToggle} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
        <span style={chipSquare(show.color)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.textBright, overflowWrap: 'anywhere' }}>
            {show.title}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 1 }}>
            {SHOW_KIND_LABELS[show.kind]} · {positionText}
          </div>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 14, borderTop: '1px dashed rgba(148,163,184,.25)', paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {!isFilm && (
              <>
                <div style={{ flex: '1 1 90px' }}>
                  <div style={fieldLabel}>Сезон</div>
                  <input
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    inputMode="numeric"
                    placeholder="1"
                    style={input}
                  />
                </div>
                <div style={{ flex: '1 1 90px' }}>
                  <div style={fieldLabel}>Серия</div>
                  <input
                    value={episode}
                    onChange={(e) => setEpisode(e.target.value)}
                    inputMode="numeric"
                    placeholder="3"
                    style={input}
                  />
                </div>
              </>
            )}
            <div style={{ flex: '1 1 90px' }}>
              <div style={fieldLabel}>Минута</div>
              <input
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                inputMode="numeric"
                placeholder="12"
                style={{ ...input, fontFamily: MONO }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 9, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="h-accent" style={{ ...btnAccent, fontSize: 13.5, padding: '8px 14px' }} onClick={savePosition}>
              Сохранить позицию
            </button>
            <button className="h-ghost-bright" style={btnCancelSm} onClick={onFinish}>
              Досмотрел
            </button>
            {show.link && (
              <a
                href={show.link}
                target="_blank"
                rel="noopener noreferrer"
                className="h-ghost-bright"
                style={{ ...btnCancelSm, textDecoration: 'none', display: 'inline-block' }}
              >
                Смотреть ↗
              </a>
            )}
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

          <div style={{ fontSize: 12, color: C.faint, marginTop: 10 }}>добавлено {fmtD(show.startedAt, now)}</div>
        </div>
      )}
    </div>
  )
}
