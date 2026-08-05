import { btnAccent, btnCancelSm, btnDeleteConfirm, btnDeleteLink, C, chipSquare, plainCard } from '../../theme'
import type { Video } from '../../types'

interface Props {
  video: Video
  confirmingDelete: boolean
  onFinish: () => void
  onEdit: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}

export function VideoCard({
  video,
  confirmingDelete,
  onFinish,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: Props) {
  return (
    <div style={plainCard({ padding: '13px 15px' })}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt=""
            style={{ width: 88, height: 50, objectFit: 'cover', borderRadius: 8, flex: 'none' }}
          />
        ) : (
          <span style={{ ...chipSquare(video.color), width: 50, height: 50, borderRadius: 8 }} />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 15.5, fontWeight: 600, color: C.textBright, overflowWrap: 'anywhere' }}
          >
            {video.title}
          </a>
          {video.channel && <div style={{ fontSize: 13, color: C.muted, marginTop: 1 }}>{video.channel}</div>}
          {video.note && (
            <div style={{ fontSize: 13, fontStyle: 'italic', color: C.textSoft, marginTop: 4, overflowWrap: 'anywhere' }}>
              {video.note}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 9, marginTop: 11, flexWrap: 'wrap', alignItems: 'center' }}>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="h-ghost-bright"
          style={{ ...btnCancelSm, textDecoration: 'none', display: 'inline-block' }}
        >
          Смотреть ↗
        </a>
        <button className="h-accent" style={{ ...btnAccent, fontSize: 13.5, padding: '8px 14px' }} onClick={onFinish}>
          Просмотрено
        </button>
        <button
          className="h-edit"
          onClick={onEdit}
          aria-label="Изменить видео"
          style={{
            fontFamily: 'inherit',
            fontSize: 13,
            color: C.muted,
            background: 'none',
            border: '1px solid rgba(148,163,184,.3)',
            borderRadius: 9,
            padding: '7px 10px',
            cursor: 'pointer',
          }}
        >
          ✎
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
    </div>
  )
}
