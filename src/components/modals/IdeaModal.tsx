import { useState } from 'react'
import { Modal } from './Modal'
import {
  IDEA_CATEGORY_SUGGESTIONS,
  MAX_IDEA_CATEGORY,
  MAX_IDEA_CHECK_TEXT,
  MAX_IDEA_CHECKS,
  MAX_IDEA_IMAGES,
  MAX_IDEA_LINK_LABEL,
  MAX_IDEA_LINKS,
  MAX_IDEA_TEXT,
  MAX_IDEA_TITLE,
} from '../../constants'
import { cleanShareUrl } from '../../logic/links'
import { uid } from '../../logic/uid'
import { useAuth } from '../../state/AuthProvider'
import { useToast } from '../../state/ToastProvider'
import { deleteImage, uploadImage } from '../../state/media'
import { fetchYoutubeMeta } from '../../state/youtube'
import { A } from '../../state/actions'
import { btnAccent, btnCancelSm, btnGhost, C, chipBtn, errText, fieldLabel, input } from '../../theme'
import type { Idea, IdeaCheck, IdeaLink } from '../../types'

interface Props {
  idea: Idea | null
  usedCategories: string[]
  onCancel: () => void
  onCreate: (idea: Idea) => void
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function IdeaModal({ idea, usedCategories, onCancel, onCreate }: Props) {
  const { code } = useAuth()
  const toast = useToast()

  const [title, setTitle] = useState(idea?.title ?? '')
  const [category, setCategory] = useState(idea?.category ?? IDEA_CATEGORY_SUGGESTIONS[2]!)
  const [text, setText] = useState(idea?.text ?? '')
  const [links, setLinks] = useState<IdeaLink[]>(idea?.links ?? [])
  const [linkInput, setLinkInput] = useState('')
  const [checks, setChecks] = useState<IdeaCheck[]>(idea?.checklist ?? [])
  const [checkInput, setCheckInput] = useState('')
  const [images, setImages] = useState<string[]>(idea?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const suggestions = [...new Set([...IDEA_CATEGORY_SUGGESTIONS, ...usedCategories])]

  const addLink = async () => {
    const raw = linkInput.trim()
    if (!raw) return
    if (links.length >= MAX_IDEA_LINKS) return setError('Слишком много ссылок')

    let url: string
    try {
      url = cleanShareUrl(raw)
      new URL(url)
    } catch {
      setError('Это не похоже на ссылку')
      return
    }
    setLinkInput('')
    setError('')

    // название канала — по возможности, но ссылка сохраняется в любом случае
    const meta = await fetchYoutubeMeta(url)
    const label = (meta?.title || hostname(url)).slice(0, MAX_IDEA_LINK_LABEL)
    setLinks((prev) => [...prev, { id: uid('il'), url, label }])
  }

  const removeLink = (id: string) => setLinks((prev) => prev.filter((l) => l.id !== id))

  const addCheck = () => {
    const text = checkInput.trim()
    if (!text) return
    if (checks.length >= MAX_IDEA_CHECKS) return setError('Слишком много пунктов')
    setChecks((prev) => [...prev, A.newIdeaCheck(text.slice(0, MAX_IDEA_CHECK_TEXT))])
    setCheckInput('')
    setError('')
  }

  const removeCheck = (id: string) => setChecks((prev) => prev.filter((c) => c.id !== id))
  // переименование не трогает отметку — правка текста и правка done независимы
  const renameCheck = (id: string, text: string) =>
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)))

  const addPhotos = async (files: FileList | null) => {
    if (!files || !files.length) return
    const room = MAX_IDEA_IMAGES - images.length
    if (room <= 0) {
      toast('Уже 6 фото — больше нельзя')
      return
    }

    setUploading(true)
    for (const file of Array.from(files).slice(0, room)) {
      const res = await uploadImage(code, file)
      if (res.ok) {
        setImages((prev) => [...prev, res.url])
      } else if (res.notConfigured) {
        toast('Хранилище фото не настроено')
        break
      } else {
        toast(res.error)
      }
    }
    setUploading(false)
  }

  const removePhoto = (url: string) => {
    setImages((prev) => prev.filter((u) => u !== url))
    void deleteImage(code, url)
  }

  const submit = () => {
    const t = title.trim()
    if (!t) return setError('Напиши название')
    const cat = category.trim().slice(0, MAX_IDEA_CATEGORY) || IDEA_CATEGORY_SUGGESTIONS[2]!
    // пустые после обрезки строки не сохраняем — «только пробелы» не пункт
    const checklist = checks.map((c) => ({ ...c, text: c.text.trim().slice(0, MAX_IDEA_CHECK_TEXT) })).filter((c) => c.text)

    if (idea) {
      onCreate({ ...idea, title: t, category: cat, text: text.trim().slice(0, MAX_IDEA_TEXT), links, images, checklist })
      return
    }
    onCreate({ ...A.newIdea(t, cat, text.trim().slice(0, MAX_IDEA_TEXT), links, images), checklist })
  }

  return (
    <Modal
      title={idea ? 'Идея' : 'Новая идея'}
      width={480}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnGhost} onClick={onCancel}>
            Отмена
          </button>
          <button className="h-accent" style={btnAccent} onClick={submit}>
            {idea ? 'Сохранить' : 'Добавить'}
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
          maxLength={MAX_IDEA_TITLE}
          autoFocus
          placeholder="Робот на Ардуино"
          style={input}
        />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Категория</div>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          maxLength={MAX_IDEA_CATEGORY}
          placeholder="Ардуино"
          style={input}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {suggestions.map((c) => (
            <button key={c} style={chipBtn(category === c, '#fbbf24')} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Заметка</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={MAX_IDEA_TEXT}
          placeholder="что за идея, из чего собрать, что нужно докупить…"
          style={{ ...input, resize: 'vertical' }}
        />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Ссылки — Instagram, YouTube и другие</div>
        {links.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {links.map((l) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.textSoft, overflowWrap: 'anywhere' }}>
                  {l.label}
                </span>
                <button style={btnCancelSm} onClick={() => removeLink(l.id)} aria-label="Убрать ссылку">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addLink()
              }
            }}
            placeholder="https://…"
            style={{ ...input, flex: 1 }}
          />
          <button className="h-ghost-bright" style={btnCancelSm} onClick={() => void addLink()}>
            Добавить
          </button>
        </div>
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Чек-лист — что купить и сделать</div>
        {checks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {checks.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  value={c.text}
                  onChange={(e) => renameCheck(c.id, e.target.value)}
                  maxLength={MAX_IDEA_CHECK_TEXT}
                  style={{ ...input, flex: 1, fontSize: 13.5, padding: '6px 10px' }}
                />
                <button style={btnCancelSm} onClick={() => removeCheck(c.id)} aria-label="Убрать пункт">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={checkInput}
            onChange={(e) => setCheckInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCheck()
              }
            }}
            maxLength={MAX_IDEA_CHECK_TEXT}
            placeholder="ESP32 DevKit — 60 тыс сум, OLX"
            style={{ ...input, flex: 1 }}
          />
          <button className="h-ghost-bright" style={btnCancelSm} onClick={addCheck}>
            Добавить
          </button>
        </div>
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Фото — до 6 штук</div>
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {images.map((url) => (
              <div key={url} style={{ position: 'relative' }}>
                <img src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />
                <button
                  onClick={() => removePhoto(url)}
                  aria-label="Убрать фото"
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(8,13,26,.9)',
                    color: C.textBright,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {images.length < MAX_IDEA_IMAGES && (
          <div style={{ marginTop: 8 }}>
            <label style={{ ...btnCancelSm, display: 'inline-block', cursor: 'pointer' }}>
              {uploading ? 'Загружаю…' : '+ Фото'}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploading}
                onChange={(e) => {
                  void addPhotos(e.target.files)
                  e.target.value = ''
                }}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}
      </div>

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
