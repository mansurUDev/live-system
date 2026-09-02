import { useMemo, useRef, useState } from 'react'
import { MAX_BOOKS, MAX_EXPENSE_NAME, MAX_IDEAS, MAX_NOTE_TEXT, MAX_ONETIME, PAL } from '../../constants'
import { useAuth } from '../../state/AuthProvider'
import { useData } from '../../state/DataProvider'
import { useToast } from '../../state/ToastProvider'
import { deleteImage } from '../../state/media'
import { A } from '../../state/actions'
import { useContextMenu } from '../../hooks/useContextMenu'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useListDrag } from '../../hooks/useListDrag'
import { moveIdeaTo } from '../../logic/ideaOrder'
import { btnAccent, C, chipBtn, pageStyle, plainCard } from '../../theme'
import { ContextMenu } from '../ContextMenu'
import type { CtxEntry } from '../ContextMenu'
import { ExpenseModal } from '../modals/ExpenseModal'
import { IdeaModal } from '../modals/IdeaModal'
import { IdeaCard } from './IdeaCard'
import type { Idea } from '../../types'

type Editing = { idea: Idea | null } | null
type ToExpense = { idea: Idea } | null

export function IdeasTab() {
  const { state, dispatch } = useData()
  const { code } = useAuth()
  const toast = useToast()
  const isMobile = useIsMobile()
  const ideas = state.doc.ideas

  const [filter, setFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [toExpense, setToExpense] = useState<ToExpense>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const menu = useContextMenu<Idea>()

  const categories = [...new Set(ideas.map((i) => i.category))].sort((a, b) => a.localeCompare(b, 'ru'))
  const visible = filter ? ideas.filter((i) => i.category === filter) : ideas
  const scope = useMemo(() => visible.map((i) => i.id), [visible])

  const listRef = useRef<HTMLDivElement | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)

  const drag = useListDrag({
    ids: scope,
    scopeRef: listRef,
    ghostRef,
    onDrop: (id, index) => dispatch(A.moveIdea(id, index, scope)),
  })

  // Пока карточку тянут, список показывает итог заранее — той же функцией,
  // которой потом сработает редьюсер, поэтому превью и результат не разойдутся.
  const shown = useMemo(() => {
    if (!drag) return visible
    const moved = moveIdeaTo(visible, scope, drag.id, drag.index)
    return filter ? moved.filter((i) => i.category === filter) : moved
  }, [visible, scope, drag, filter])

  const dragged = drag ? ideas.find((i) => i.id === drag.id) : null

  const openAdd = () => {
    if (ideas.length >= MAX_IDEAS) {
      toast('Слишком много идей — убери лишние')
      return
    }
    setEditing({ idea: null })
  }

  /**
   * Идея, записанная про книгу, переезжает во вкладку «Книги»: там позиция,
   * план по прочтению и заметки. Текст идеи и ссылки не теряются — становятся
   * первой заметкой книги, а число страниц проставляется потом в самой карточке.
   */
  const toBook = (idea: Idea) => {
    if (state.doc.lib.books.length >= MAX_BOOKS) {
      toast('Слишком много книг — заверши или убери лишние')
      return
    }
    const { books, courses, videos, shows } = state.doc.lib
    const usedColors = [...books, ...courses, ...videos, ...shows].map((x) => x.color)
    const color = PAL.find((c) => !usedColors.includes(c)) ?? PAL[2]!
    const book = A.newBook(idea.title, '', color, 0, 0)
    dispatch(A.saveBook(book))
    const lines = [idea.text.trim(), ...idea.links.map((l) => `${l.label}: ${l.url}`)].filter(Boolean)
    if (lines.length) dispatch(A.addNote('book', book.id, lines.join('\n').slice(0, MAX_NOTE_TEXT)))
    idea.images.forEach((url) => void deleteImage(code, url))
    dispatch(A.deleteIdea(idea.id))
    toast(`«${idea.title}» — теперь в «Книгах», укажи страницы`)
  }

  /**
   * Покупка вроде подарка брату — не идея, ей место в «Финансах» запланированным
   * расходом. Сумму приложение не выдумывает, её спрашивает та же форма, что и
   * в самих «Финансах». Идея не удаляется — у расхода нет места под текст,
   * ссылки и фото, поэтому карточка остаётся, только помечается воплощённой;
   * отменяется снятием галочки.
   */
  const openToExpense = (idea: Idea) => {
    if (state.doc.fin.oneTime.length >= MAX_ONETIME) {
      toast('Слишком много запланированных расходов — убери лишние')
      return
    }
    setToExpense({ idea })
  }

  const deleteIdea = (idea: Idea) => {
    const index = ideas.findIndex((x) => x.id === idea.id)
    dispatch(A.deleteIdea(idea.id))
    setDeleteId(null)
    // фото удаляем не сразу: пока висит «Отменить», картинки должны быть живы,
    // иначе вернувшаяся идея показывала бы битые ссылки
    const wipe = window.setTimeout(() => idea.images.forEach((url) => void deleteImage(code, url)), 6500)
    toast('Идея убрана', {
      action: {
        label: 'Отменить',
        onClick: () => {
          window.clearTimeout(wipe)
          dispatch(A.restore('ideas', idea, index))
        },
      },
    })
  }

  const menuItems = (idea: Idea): CtxEntry[] => [
    { icon: idea.pinned ? '☆' : '★', label: idea.pinned ? 'Открепить' : 'Закрепить наверху', onClick: () => dispatch(A.toggleIdeaPin(idea.id)) },
    { icon: '✎', label: 'Редактировать', onClick: () => setEditing({ idea }) },
    { icon: '✔', label: idea.done ? 'Вернуть в работу' : 'Воплощена', onClick: () => dispatch(A.saveIdea({ ...idea, done: !idea.done })) },
    'sep',
    { icon: '⇥', label: 'В «Книги»', onClick: () => toBook(idea) },
    { icon: '⇥', label: 'В расходы', onClick: () => openToExpense(idea) },
    'sep',
    { icon: '🗑', label: 'Удалить', danger: true, onClick: () => deleteIdea(idea) },
  ]

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
        <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map((idea) => (
            <div
              key={idea.id}
              data-drag-id={idea.id}
              className="ctx-target"
              {...menu.bind(idea)}
              style={{
                // сама карточка остаётся в потоке и держит высоту, но пока её
                // тянут — она бледная, а «настоящая» едет за пальцем призраком
                opacity: drag?.id === idea.id ? 0.25 : 1,
                transition: 'opacity .12s ease',
              }}
            >
            <IdeaCard
              idea={idea}
              confirmingDelete={deleteId === idea.id}
              onToggleDone={() => dispatch(A.saveIdea({ ...idea, done: !idea.done }))}
              onTogglePin={() => dispatch(A.toggleIdeaPin(idea.id))}
              onToggleCheck={(checkId) =>
                dispatch(
                  A.saveIdea({
                    ...idea,
                    checklist: idea.checklist.map((c) => (c.id === checkId ? { ...c, done: !c.done } : c)),
                  }),
                )
              }
              onEdit={() => setEditing({ idea })}
              onToBook={() => toBook(idea)}
              onToExpense={() => openToExpense(idea)}
              onAskDelete={() => setDeleteId(idea.id)}
              onCancelDelete={() => setDeleteId(null)}
              onDelete={() => deleteIdea(idea)}
            />
            </div>
          ))}
        </div>
      ) : (
        <div style={plainCard({ padding: 18, color: C.faint, fontSize: 14 })}>
          {filter ? 'В этой категории пока пусто' : 'Сохрани первую идею — с фото или ссылкой, если есть'}
        </div>
      )}

      {dragged && drag && (
        <div
          ref={ghostRef}
          style={{
            position: 'fixed',
            left: drag.grabRect.left,
            top: drag.grabRect.top,
            width: drag.grabRect.width,
            pointerEvents: 'none',
            zIndex: 60,
            opacity: 0.95,
            filter: 'drop-shadow(0 10px 24px rgba(0,0,0,.55))',
          }}
        >
          <IdeaCard
            idea={dragged}
            confirmingDelete={false}
            onToggleDone={() => {}}
            onTogglePin={() => {}}
            onToggleCheck={() => {}}
            onEdit={() => {}}
            onToBook={() => {}}
            onToExpense={() => {}}
            onAskDelete={() => {}}
            onCancelDelete={() => {}}
            onDelete={() => {}}
          />
        </div>
      )}

      {menu.state &&
        (() => {
          // см. WatchTab: пункты действуют по свежей записи, а не по снимку
          const fresh = ideas.find((x) => x.id === menu.state!.data.id)
          return fresh ? (
            <ContextMenu x={menu.state.x} y={menu.state.y} items={menuItems(fresh)} onClose={menu.close} />
          ) : null
        })()}

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

      {toExpense && (
        <ExpenseModal
          draft={null}
          prefill={{ name: toExpense.idea.title.slice(0, MAX_EXPENSE_NAME) }}
          withDate
          docCurrency={state.doc.currency}
          rates={state.doc.rates}
          onCancel={() => setToExpense(null)}
          onSave={(d) => {
            dispatch(A.saveOneTime({ id: A.newExpenseId(), name: d.name, amount: d.amount, currency: d.currency, date: d.date }))
            dispatch(A.saveIdea({ ...toExpense.idea, done: true }))
            setToExpense(null)
            toast(`«${toExpense.idea.title}» — расход запланирован`)
          }}
        />
      )}
    </main>
  )
}
