import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { MAX_VIDEO_NOTE, PAL } from '../../constants'
import { cleanShareUrl } from '../../logic/links'
import { fetchYoutubeMeta, type YoutubeMeta } from '../../state/youtube'
import { A } from '../../state/actions'
import { btnAccent, btnGhost, C, errText, fieldLabel, input } from '../../theme'
import type { Video } from '../../types'

interface Props {
  /** null — добавляем новое */
  video: Video | null
  usedColors: string[]
  /** адрес, пришедший из «Поделиться» — форма открывается уже заполненной */
  prefillUrl?: string
  onCancel: () => void
  onCreate: (video: Video) => void
}

/** Пауза после остановки набора, прежде чем спрашивать oEmbed — не долбим на каждый символ */
const PREVIEW_DELAY_MS = 500

export function VideoModal({ video, usedColors, prefillUrl, onCancel, onCreate }: Props) {
  const [url, setUrl] = useState(video?.url ?? prefillUrl ?? '')
  const [note, setNote] = useState(video?.note ?? '')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<YoutubeMeta | null>(
    video ? { title: video.title, channel: video.channel, thumbnail: video.thumbnail } : null,
  )
  const [loadingPreview, setLoadingPreview] = useState(false)
  const requestId = useRef(0)

  // живой предпросмотр: подтягиваем название/канал/картинку, пока пользователь ещё в модалке
  useEffect(() => {
    const trimmed = url.trim()
    if (!trimmed) {
      setPreview(null)
      setLoadingPreview(false)
      return
    }

    const id = ++requestId.current
    setLoadingPreview(true)
    const timer = setTimeout(() => {
      void fetchYoutubeMeta(trimmed).then((res) => {
        if (requestId.current !== id) return // ссылку успели поменять — этот ответ уже не актуален
        setPreview(res)
        setLoadingPreview(false)
      })
    }, PREVIEW_DELAY_MS)

    return () => clearTimeout(timer)
  }, [url])

  const submit = () => {
    const trimmed = url.trim()
    if (!trimmed) return setError('Вставь ссылку')
    try {
      new URL(trimmed)
    } catch {
      return setError('Это не похоже на ссылку')
    }
    const cleaned = cleanShareUrl(trimmed)

    const title = preview?.title || cleaned
    const channel = preview?.channel ?? ''
    const thumbnail = preview?.thumbnail ?? ''
    const trimmedNote = note.trim().slice(0, MAX_VIDEO_NOTE)

    if (video) {
      onCreate({ ...video, url: cleaned, title, channel, thumbnail, note: trimmedNote })
      return
    }
    const color = PAL.find((c) => !usedColors.includes(c)) ?? PAL[4]!
    onCreate(A.newVideo(cleaned, title, channel, thumbnail, color, trimmedNote))
  }

  return (
    <Modal
      title={video ? 'Видео' : 'Новое видео'}
      width={440}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnGhost} onClick={onCancel}>
            Отмена
          </button>
          <button className="h-accent" style={btnAccent} onClick={submit}>
            {video ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      }
    >
      <div style={{ marginTop: 12 }}>
        <div style={fieldLabel}>Ссылка</div>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError('')
          }}
          type="text"
          autoFocus
          placeholder="https://youtu.be/..."
          style={input}
        />
      </div>

      {(loadingPreview || preview) && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, minHeight: 46 }}>
          {loadingPreview ? (
            <div style={{ fontSize: 13, color: C.faint }}>Ищу превью…</div>
          ) : preview ? (
            <>
              {preview.thumbnail && (
                <img
                  src={preview.thumbnail}
                  alt=""
                  style={{ width: 82, height: 46, objectFit: 'cover', borderRadius: 8, flex: 'none' }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, color: C.textBright, overflowWrap: 'anywhere' }}>
                  {preview.title || 'Название не найдено'}
                </div>
                {preview.channel && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 1 }}>{preview.channel}</div>}
              </div>
            </>
          ) : null}
        </div>
      )}

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>
          Заметка <span style={{ color: C.faint }}>— зачем сохранил, необязательно</span>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          type="text"
          maxLength={MAX_VIDEO_NOTE}
          placeholder="для мотивации, разобрать приём и т.п."
          style={input}
        />
      </div>

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
