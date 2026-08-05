import { useState } from 'react'
import { MAX_IDEAS } from '../../constants'
import { useAuth } from '../../state/AuthProvider'
import { useData } from '../../state/DataProvider'
import { useToast } from '../../state/ToastProvider'
import { deleteImage } from '../../state/media'
import { A } from '../../state/actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import { btnAccent, C, chipBtn, pageStyle, plainCard } from '../../theme'
import { IdeaModal } from '../modals/IdeaModal'
import { IdeaCard } from './IdeaCard'
import type { Idea } from '../../types'

type Editing = { idea: Idea | null } | null

export function IdeasTab() {
  const { state, dispatch } = useData()
  const { code } = useAuth()
  const toast = useToast()
  const isMobile = useIsMobile()
  const ideas = state.doc.ideas

  const [filter, setFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const categories = [...new Set(ideas.map((i) => i.category))].sort((a, b) => a.localeCompare(b, 'ru'))
  const visible = filter ? ideas.filter((i) => i.category === filter) : ideas

  const openAdd = () => {
    if (ideas.length >= MAX_IDEAS) {
      toast('Слишком много идей — убери лишние')
      return
    }
    setEditing({ idea: null })
  }

  return (
    <main style={{ ...pageStyle(isMobile), display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: C.textBright }}>Идеи</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>заметки, фото и ссылки на будущее</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="h-accent" style={{ ...btnAccent, fontSize: 13.5, padding: '8px 14px' }} onClick={openAdd}>
          + Идея
        </button>
      </div>

      {categories.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={chipBtn(filter === null, '#fbbf24')} onClick={() => setFilter(null)}>
            все
          </button>
          {categories.map((c) => (
            <button key={c} style={chipBtn(filter === c, '#fbbf24')} onClick={() => setFilter(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {visible.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              confirmingDelete={deleteId === idea.id}
              onToggleDone={() => dispatch(A.saveIdea({ ...idea, done: !idea.done }))}
              onEdit={() => setEditing({ idea })}
              onAskDelete={() => setDeleteId(idea.id)}
              onCancelDelete={() => setDeleteId(null)}
              onDelete={() => {
                idea.images.forEach((url) => void deleteImage(code, url))
                dispatch(A.deleteIdea(idea.id))
                setDeleteId(null)
                toast('Идея убрана')
              }}
            />
          ))}
        </div>
      ) : (
        <div style={plainCard({ padding: 18, color: C.faint, fontSize: 14 })}>
          {filter ? 'В этой категории пока пусто' : 'Сохрани первую идею — с фото или ссылкой, если есть'}
        </div>
      )}

      {editing && (
        <IdeaModal
          idea={editing.idea}
          usedCategories={categories}
          onCancel={() => setEditing(null)}
          onCreate={(idea) => {
            dispatch(A.saveIdea(idea))
            setEditing(null)
          }}
        />
      )}
    </main>
  )
}
