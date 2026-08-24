import { useMemo, useState } from 'react'
import { MAX_SHOWS, SHOW_KINDS, SHOW_KIND_LABELS } from '../../constants'
import { copyText } from '../../logic/clipboard'
import { visibleShows } from '../../logic/library'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { useToast } from '../../state/ToastProvider'
import { A } from '../../state/actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import { C, chipBtn, input, pageStyle } from '../../theme'
import { FinishModal } from '../modals/FinishModal'
import { ShowModal } from '../modals/ShowModal'
import { DoneShelf, Empty, Shelf } from '../library/LibraryParts'
import { ShowCard } from '../library/ShowCard'
import type { ShowKind } from '../../types'

type Finishing = { id: string; title: string } | null

/** Ниже этого числа фильтры — лишний шум: пролистать список глазами быстрее */
const FILTERS_FROM = 5

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
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<ShowKind | null>(null)

  // цвета делятся со всей библиотекой, чтобы карточки не повторялись между вкладками
  const usedColors = [...lib.books, ...lib.courses, ...lib.videos, ...lib.shows].map((x) => x.color)
  const done = lib.done.filter((d) => d.kind === 'show')

  // чипы только под виды, которые реально есть в очереди — не «Аниме» на
  // список из одних фильмов
  const presentKinds = useMemo(
    () => SHOW_KINDS.filter((k) => lib.shows.some((s) => s.kind === k)),
    [lib.shows],
  )
  const shown = useMemo(() => visibleShows(lib.shows, query, kind), [lib.shows, query, kind])
  const showFilters = lib.shows.length >= FILTERS_FROM

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
        <>
          {showFilters && (
            <>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти по названию"
                aria-label="Поиск по названию"
                style={{ ...input, marginTop: 0 }}
              />
              {presentKinds.length > 1 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {presentKinds.map((k) => (
                    <button key={k} style={chipBtn(kind === k, '#fbbf24')} onClick={() => setKind(k)}>
                      {SHOW_KIND_LABELS[k]}
                    </button>
                  ))}
                  {/* «Все» — последним: сначала выбор конкретного вида, сброс — в конце ряда */}
                  <button style={chipBtn(kind === null, '#fbbf24')} onClick={() => setKind(null)}>
                    Все
                  </button>
                </div>
              )}
            </>
          )}

          {shown.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {shown.map((s) => (
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
            <Empty text="Ничего не нашлось — попробуй другой запрос или вид" />
          )}
        </>
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
