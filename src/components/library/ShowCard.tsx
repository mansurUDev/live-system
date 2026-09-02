import { useState } from 'react'
import { showKindLabel } from '../../constants'
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
  premiumCard,
} from '../../theme'
import type { Show } from '../../types'

interface Props {
  show: Show
  open: boolean
  onToggle: () => void
  onSave: (show: Show) => void
  onCopyLink: () => void
  onFinish: () => void
  onDelete: () => void
  /** «не хочу смотреть» — запись уезжает на нижнюю полку, не удаляясь */
  onDrop: () => void
  /** id стиля обводки, если запись «в первую очередь»; null — обычная карточка */
  premium?: string | null
}

export function ShowCard({ show, open, onToggle, onSave, onCopyLink, onFinish, onDelete, onDrop, premium }: Props) {
  const now = useNow()
  const [season, setSeason] = useState(String(show.season || ''))
  const [episode, setEpisode] = useState(String(show.episode || ''))
  const [minute, setMinute] = useState(String(show.minute || ''))
  const [ratingText, setRatingText] = useState(show.rating ? String(show.rating) : '')
  const [priorityText, setPriorityText] = useState(show.priority ? String(show.priority) : '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isFilm = show.kind === 'film'

  const savePosition = () => {
    const s = parseInt(season.replace(/\s/g, ''), 10)
    const e = parseInt(episode.replace(/\s/g, ''), 10)
    const m = parseInt(minute.replace(/\s/g, ''), 10)
    const r = parseFloat(ratingText.replace(',', '.'))
    const p = parseInt(priorityText, 10)
    onSave({
      ...show,
      season: isFilm ? 0 : Number.isFinite(s) ? Math.max(0, s) : show.season,
      episode: isFilm ? 0 : Number.isFinite(e) ? Math.max(0, e) : show.episode,
      minute: Number.isFinite(m) ? Math.max(0, m) : show.minute,
      rating: Number.isFinite(r) && r > 0 ? Math.min(10, Math.round(r * 10) / 10) : 0,
      priority: Number.isInteger(p) && p >= 1 && p <= 10 ? p : 0,
    })
  }

  const positionText = isFilm
    ? show.minute > 0
      ? `на ${show.minute} мин`
      : 'ещё не начал'
    : show.season > 0 || show.episode > 0
      ? `s${show.season}e${show.episode}` + (show.minute > 0 ? `, ${show.minute} мин` : '')
      : // одна минута без серии — тоже начало: иначе запись висит в «Смотрю»
        // с подписью «ещё не начал»
        show.minute > 0
        ? `на ${show.minute} мин`
        : 'ещё не начал'

  return (
    <div style={{ ...plainCard({ padding: '13px 15px' }), ...(premium ? premiumCard(premium) : null) }}>
      <div
        className="show-row"
        onClick={onToggle}
        style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}
      >
        <span style={chipSquare(show.color)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.textBright, overflowWrap: 'anywhere' }}>
            {show.title}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 1 }}>
            {showKindLabel(show.kind)} · {positionText}
            {show.rating > 0 && (
              <span style={{ color: '#fbbf24', marginLeft: 7 }}>★ {show.rating}</span>
            )}
            {show.priority > 0 && (
              <span style={{ fontFamily: MONO, color: C.faint, marginLeft: 7 }}>хочу: {show.priority}</span>
            )}
          </div>
        </div>
        <button
          className="show-row-x"
          aria-label={show.dropped ? 'Вернуть в очередь' : 'Не хочу смотреть'}
          title={show.dropped ? 'Вернуть в очередь' : 'Не хочу смотреть — уедет на нижнюю полку'}
          onClick={(e) => {
            e.stopPropagation()
            onDrop()
          }}
          style={{
            flex: 'none',
            width: 26,
            height: 26,
            border: '1px solid rgba(148,163,184,.3)',
            borderRadius: 7,
            background: 'none',
            color: C.faint,
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {show.dropped ? '↩' : '✕'}
        </button>
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
            <div style={{ flex: '1 1 90px' }}>
              <div style={fieldLabel}>Рейтинг</div>
              <input
                value={ratingText}
                onChange={(e) => setRatingText(e.target.value)}
                inputMode="decimal"
                placeholder="8.4"
                aria-label="Внешний рейтинг, 0–10"
                style={{ ...input, fontFamily: MONO }}
              />
            </div>
            <div style={{ flex: '1 1 90px' }}>
              <div style={fieldLabel}>Хочу (1–10)</div>
              <input
                value={priorityText}
                onChange={(e) => setPriorityText(e.target.value)}
                inputMode="numeric"
                placeholder="7"
                aria-label="Приоритет просмотра, 1–10; 10 — в первую очередь"
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
              <>
                {/* копия ссылки нужнее перехода: внешний браузер открывает её без входа в аккаунт */}
                <button className="h-ghost-bright" style={btnCancelSm} onClick={onCopyLink}>
                  ⧉ Ссылка
                </button>
                <a
                  href={show.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-ghost-bright"
                  style={{ ...btnCancelSm, textDecoration: 'none', display: 'inline-block' }}
                >
                  Смотреть ↗
                </a>
              </>
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
