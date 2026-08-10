import { useState } from 'react'
import { MAX_BOOKS, MAX_COURSES } from '../../constants'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { useToast } from '../../state/ToastProvider'
import { A } from '../../state/actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import { pageStyle } from '../../theme'
import { LibraryModal } from '../modals/LibraryModal'
import { FinishModal } from '../modals/FinishModal'
import { BookCard } from './BookCard'
import { CourseCard } from './CourseCard'
import { DoneShelf, Empty, Shelf } from './LibraryParts'

type ShelfKind = 'book' | 'course'
type Finishing = { kind: ShelfKind; id: string; title: string } | null

export function LibraryTab() {
  const { state, dispatch } = useData()
  const toast = useToast()
  const now = useNow()
  const isMobile = useIsMobile()
  const lib = state.doc.lib

  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState<ShelfKind | null>(null)
  const [finishing, setFinishing] = useState<Finishing>(null)

  // цвета делятся со «Смотреть», чтобы карточки не повторялись между вкладками
  const usedColors = [...lib.books, ...lib.courses, ...lib.videos, ...lib.shows].map((x) => x.color)
  const done = lib.done.filter((d) => d.kind === 'book' || d.kind === 'course')

  const toggleOpen = (id: string) => setOpenId((cur) => (cur === id ? null : id))

  const openAdd = (kind: ShelfKind) => {
    const full = kind === 'book' ? lib.books.length >= MAX_BOOKS : lib.courses.length >= MAX_COURSES
    if (full) {
      toast('Слишком много активных — заверши или убери лишние')
      return
    }
    setAdding(kind)
  }

  return (
    <main style={{ ...pageStyle(isMobile), display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── книги ── */}
      <Shelf
        title="Книги"
        subtitle="страница и минута аудио — обе позиции одной книги"
        onAdd={() => openAdd('book')}
      />
      {lib.books.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lib.books.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              open={openId === b.id}
              onToggle={() => toggleOpen(b.id)}
              onSave={(next) => dispatch(A.saveBook(next))}
              onNote={(text) => dispatch(A.addNote('book', b.id, text))}
              onFinish={() => setFinishing({ kind: 'book', id: b.id, title: b.title })}
              onDelete={() => {
                dispatch(A.deleteLibItem('book', b.id))
                setOpenId(null)
                toast('Убрано из библиотеки')
              }}
            />
          ))}
        </div>
      ) : (
        <Empty text="Добавь книгу — и позиция всегда будет под рукой" />
      )}

      {/* ── курсы ── */}
      <Shelf title="Курсы" subtitle="раздел, минута и заметки" onAdd={() => openAdd('course')} />
      {lib.courses.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lib.courses.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              open={openId === c.id}
              onToggle={() => toggleOpen(c.id)}
              onSave={(next) => dispatch(A.saveCourse(next))}
              onToggleSection={(sid) => dispatch(A.toggleSection(c.id, sid))}
              onNote={(text) => dispatch(A.addNote('course', c.id, text))}
              onFinish={() => setFinishing({ kind: 'course', id: c.id, title: c.title })}
              onDelete={() => {
                dispatch(A.deleteLibItem('course', c.id))
                setOpenId(null)
                toast('Убрано из библиотеки')
              }}
            />
          ))}
        </div>
      ) : (
        <Empty text="Добавь курс — разделы станут чек-листом" />
      )}

      <DoneShelf items={done} title="Прочитано и изучено" now={now} />

      {adding && (
        <LibraryModal
          kind={adding}
          usedColors={usedColors}
          onCancel={() => setAdding(null)}
          onCreate={(item) => {
            if (adding === 'book') dispatch(A.saveBook(item as never))
            else dispatch(A.saveCourse(item as never))
            setAdding(null)
          }}
        />
      )}

      {finishing && (
        <FinishModal
          title={finishing.title}
          onCancel={() => setFinishing(null)}
          onConfirm={(quote) => {
            dispatch(A.finishLibItem(finishing.kind, finishing.id, quote))
            setFinishing(null)
            setOpenId(null)
            toast('Готово — теперь на полке «Прочитано и изучено»')
          }}
        />
      )}
    </main>
  )
}
