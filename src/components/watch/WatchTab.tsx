import { useState } from 'react'
import { MAX_SHOWS } from '../../constants'
import { copyText } from '../../logic/clipboard'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { useToast } from '../../state/ToastProvider'
import { A } from '../../state/actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import { C, pageStyle } from '../../theme'
import { FinishModal } from '../modals/FinishModal'
import { ShowModal } from '../modals/ShowModal'
import { DoneShelf, Empty, Shelf } from '../library/LibraryParts'
import { ShowCard } from '../library/ShowCard'

type Finishing = { id: string; title: string } | null

/**
 * Полка «на посмотреть» — фильмы, сериалы, дорамы и прочее ради удовольствия.
 * Отдельно от книг и учёбы, и по умолчанию спрятана из навигации: это раздел
 * для себя, а не для чужих глаз через плечо. Вход — из настроек или потайным
 * нажатием в шапке.
 */
export function WatchTab() {
  const { state, dispatch } = useData()
  const toast = useToast()
  const now = useNow()
  const isMobile = useIsMobile()
  const lib = state.doc.lib

  const [openId, setOpenId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [finishing, setFinishing] = useState<Finishing>(null)

  // цвета делятся со всей библиотекой, чтобы карточки не повторялись между вкладками
  const usedColors = [...lib.books, ...lib.courses, ...lib.videos, ...lib.shows].map((x) => x.color)
  const done = lib.done.filter((d) => d.kind === 'show')

  const copyLink = async (link: string) => {
    if (!link) return
    toast((await copyText(link)) ? 'Ссылка скопирована' : 'Не получилось скопировать — скопируй вручную')
  }

  const openAddShow = () => {
    if (lib.shows.length >= MAX_SHOWS) {
      toast('Слишком много в очереди — досмотри или убери лишние')
      return
    }
    setShowForm(true)
  }

  return (
    <main style={{ ...pageStyle(isMobile), display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Shelf
        title="Смотреть"
        subtitle="фильмы, сериалы, дорамы, аниме, мультфильмы и документальные — с позицией"
        onAdd={openAddShow}
      />
      {state.doc.hideWatch && (
        <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.5 }}>
          Раздел спрятан из навигации — сюда ведёт только точка слева от заголовка. Показать его
          в общем списке можно в настройках.
        </div>
      )}
      {lib.shows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lib.shows.map((s) => (
            <ShowCard
              key={s.id}
              show={s}
              open={openId === s.id}
              onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
              onSave={(next) => dispatch(A.saveShow(next))}
              onCopyLink={() => copyLink(s.link)}
              onFinish={() => setFinishing({ id: s.id, title: s.title })}
              onDelete={() => {
                dispatch(A.deleteLibItem('show', s.id))
                setOpenId(null)
                toast('Убрано из очереди')
              }}
            />
          ))}
        </div>
      ) : (
        <Empty text="Сохрани название — посмотришь, когда будет время" />
      )}

      <DoneShelf items={done} title="Просмотрено" now={now} />

      {showForm && (
        <ShowModal
          usedColors={usedColors}
          onCancel={() => setShowForm(false)}
          onCreate={(show) => {
            dispatch(A.saveShow(show))
            setShowForm(false)
          }}
        />
      )}

      {finishing && (
        <FinishModal
          title={finishing.title}
          onCancel={() => setFinishing(null)}
          onConfirm={(quote) => {
            dispatch(A.finishLibItem('show', finishing.id, quote))
            setFinishing(null)
            setOpenId(null)
            toast('Готово — теперь на полке «Просмотрено»')
          }}
        />
      )}
    </main>
  )
}
