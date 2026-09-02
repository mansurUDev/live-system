import { Modal } from './Modal'
import { guessShareKind, type ShareKind, type SharePayload } from '../../logic/share'
import { btnGhost, C, chipBtn, plainCard } from '../../theme'

interface Props {
  share: SharePayload
  onPick: (kind: ShareKind) => void
  onCancel: () => void
}

const LABELS: Record<ShareKind, string> = {
  video: 'В видео',
  show: 'В «Смотреть»',
  idea: 'В идеи',
}

const ORDER: ShareKind[] = ['video', 'show', 'idea']

/**
 * Куда положить ссылку, пришедшую из «Поделиться».
 *
 * Догадка по домену подсвечена, но выбор всегда за человеком: трейлером с
 * ютуба делятся и чтобы посмотреть фильм, и чтобы сохранить сам ролик.
 */
export function ShareModal({ share, onPick, onCancel }: Props) {
  const guess = guessShareKind(share.url)

  return (
    <Modal
      title="Куда сохранить?"
      width={420}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnGhost} onClick={onCancel}>
            Не сейчас
          </button>
        </div>
      }
    >
      <div style={plainCard({ padding: '12px 14px', marginTop: 12 })}>
        {share.title && (
          <div style={{ fontSize: 15, color: C.textBright, overflowWrap: 'anywhere' }}>{share.title}</div>
        )}
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: share.title ? 4 : 0, overflowWrap: 'anywhere' }}>
          {share.url}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        {ORDER.map((kind) => (
          <button key={kind} style={chipBtn(kind === guess, '#22d3ee')} onClick={() => onPick(kind)}>
            {LABELS[kind]}
          </button>
        ))}
      </div>
    </Modal>
  )
}
