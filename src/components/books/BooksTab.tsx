import { useState } from 'react'
import { MAX_BOOKS } from '../../constants'
import { copyText } from '../../logic/clipboard'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { useToast } from '../../state/ToastProvider'
import { A } from '../../state/actions'
import { useContextMenu } from '../../hooks/useContextMenu'
import { useIsMobile } from '../../hooks/useIsMobile'
import { pageStyle } from '../../theme'
import { ContextMenu } from '../ContextMenu'
import type { CtxEntry } from '../ContextMenu'
import { BookModal } from '../modals/BookModal'
import { FinishModal } from '../modals/FinishModal'
import { DoneShelf, Empty, Shelf } from '../library/LibraryParts'
import { FocusFlash } from '../FocusFlash'
import { BookCard } from './BookCard'
import type { Book } from '../../types'

type BookForm = { book: Book | null } | null
type Finishing = { id: string; title: string } | null

/**
 * Книги — своя вкладка, а не полка внутри общего раздела: у неё есть позиция,
 * срок и заметки, ей нужен собственный экран, а не соседство с курсами.
 */
export function BooksTab({ focus }: { focus?: string | null }) {
  const { state, dispatch } = useData()
  const toast = useToast()
  const now = useNow()
  const isMobile = useIsMobile()
  const lib = state.doc.lib

  const [openId, setOpenId] = useState<string | null>(null)
  const [form, setForm] = useState<BookForm>(null)
  const [finishing, setFinishing] = useState<Finishing>(null)
  const menu = useContextMenu<Book>()

  // цвета делятся со всей библиотекой, чтобы карточки не повторялись между вкладками
  const usedColors = [...lib.books, ...lib.courses, ...lib.videos, ...lib.shows].map((x) => x.color)
  const done = lib.done.filter((d) => d.kind === 'book')

  const toggleOpen = (id: string) => setOpenId((cur) => (cur === id ? null : id))

  const copyLink = async (link: string) => {
    if (!link) return
    toast((await copyText(link)) ? 'Ссылка скопирована' : 'Не получилось скопировать — скопируй вручную')
  }

  const openAdd = () => {
    if (lib.books.length >= MAX_BOOKS) {
      toast('Слишком много книг — заверши или убери лишние')
      return
    }
    setForm({ book: null })
  }

  const deleteBook = (b: Book) => {
    const index = lib.books.findIndex((x) => x.id === b.id)
    dispatch(A.deleteLibItem('book', b.id))
    setOpenId(null)
    toast('Убрано из книг', {
      action: { label: 'Отменить', onClick: () => dispatch(A.restore('books', b, index)) },
    })
  }

  const menuItems = (b: Book): CtxEntry[] => [
    { icon: '✎', label: 'Редактировать', onClick: () => setForm({ book: b }) },
    { icon: '✔', label: 'Дочитал', onClick: () => setFinishing({ id: b.id, title: b.title }) },
    ...(b.audioLink ? [{ icon: '⧉', label: 'Скопировать ссылку', onClick: () => copyLink(b.audioLink) }] : []),
    'sep',
    { icon: '🗑', label: 'Убрать', danger: true, onClick: () => deleteBook(b) },
  ]

  return (
    <main style={{ ...pageStyle(isMobile), display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Shelf title="Книги" subtitle="страница и минута аудио — обе позиции одной книги" onAdd={openAdd} />
      {lib.books.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lib.books.map((b) => (
            <FocusFlash key={b.id} active={focus === b.id}>
            <div className="ctx-target" {...menu.bind(b)}>
            <BookCard
              book={b}
              open={openId === b.id}
              onToggle={() => toggleOpen(b.id)}
              onSave={(next) => dispatch(A.saveBook(next))}
              onNote={(text) => dispatch(A.addNote('book', b.id, text))}
              onEdit={() => setForm({ book: b })}
              onCopyLink={() => copyLink(b.audioLink)}
              onFinish={() => setFinishing({ id: b.id, title: b.title })}
              onDelete={() => deleteBook(b)}
            />
            </div>
            </FocusFlash>
          ))}
        </div>
      ) : (
        <Empty text="Добавь книгу — и позиция всегда будет под рукой" />
      )}

      <DoneShelf items={done} title="Прочитано" now={now} />

      {menu.state &&
        (() => {
          // см. WatchTab: пункты действуют по свежей записи, а не по снимку
          const fresh = lib.books.find((x) => x.id === menu.state!.data.id)
          return fresh ? (
            <ContextMenu x={menu.state.x} y={menu.state.y} items={menuItems(fresh)} onClose={menu.close} />
          ) : null
        })()}

      {form && (
        <BookModal
          book={form.book}
          usedColors={usedColors}
          onCancel={() => setForm(null)}
          onSave={(book) => {
            dispatch(A.saveBook(book))
            setForm(null)
          }}
        />
      )}

      {finishing && (
        <FinishModal
          title={finishing.title}
          onCancel={() => setFinishing(null)}
          onConfirm={(quote) => {
            dispatch(A.finishLibItem('book', finishing.id, quote))
            setFinishing(null)
            setOpenId(null)
            toast('Готово — теперь на полке «Прочитано»')
          }}
        />
      )}
    </main>
  )
}
