import { useMemo, useState } from 'react'
import { MAX_SHOWS, SHOW_KINDS, showKindLabel } from '../../constants'
import { copyText } from '../../logic/clipboard'
import { lastUpdatedKind, visibleShows } from '../../logic/library'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { useToast } from '../../state/ToastProvider'
import { A } from '../../state/actions'
import { useContextMenu } from '../../hooks/useContextMenu'
import { useIsMobile } from '../../hooks/useIsMobile'
import { C, chipBtn, input, pageStyle } from '../../theme'
import { ContextMenu } from '../ContextMenu'
import type { CtxEntry } from '../ContextMenu'
import { FinishModal } from '../modals/FinishModal'
import { ShowModal } from '../modals/ShowModal'
import { DoneShelf, Empty, Shelf } from '../library/LibraryParts'
import { ShowCard } from '../library/ShowCard'
import type { Show } from '../../types'

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
  const [editing, setEditing] = useState<Show | null>(null)
  const [finishing, setFinishing] = useState<Finishing>(null)
  const menu = useContextMenu<Show>()
  const [query, setQuery] = useState('')
  // вкладка открывается на категории последнего изменения — обычно возвращаешься
  // к тому, что смотрел вчера; при коротком списке фильтров нет и выбирать нечего
  const [kind, setKind] = useState<string | null>(() =>
    lib.shows.length >= FILTERS_FROM ? lastUpdatedKind(lib.shows) : null,
  )
  const [droppedOpen, setDroppedOpen] = useState(false)

  // цвета делятся со всей библиотекой, чтобы карточки не повторялись между вкладками
  const usedColors = [...lib.books, ...lib.courses, ...lib.videos, ...lib.shows].map((x) => x.color)
  const done = lib.done.filter((d) => d.kind === 'show')

  // чипы только под категории, которые реально есть в очереди: сперва встроенные
  // виды в привычном порядке, затем свои («Стендапы», «Лекции»…) по алфавиту
  const presentKinds = useMemo(() => {
    const inList = new Set(lib.shows.map((s) => s.kind))
    const builtin = SHOW_KINDS.filter((k) => inList.has(k))
    const custom = [...inList]
      .filter((k) => !(SHOW_KINDS as readonly string[]).includes(k))
      .sort((a, b) => a.localeCompare(b, 'ru'))
    return [...builtin, ...custom]
  }, [lib.shows])

  // выбранная категория могла исчезнуть (последнюю запись удалили) — тогда «Все»
  const activeKind = kind !== null && presentKinds.includes(kind) ? kind : null
  const shelves = useMemo(() => visibleShows(lib.shows, query, activeKind), [lib.shows, query, activeKind])
  const showFilters = lib.shows.length >= FILTERS_FROM
  const nothingFound = !shelves.top.length && !shelves.rest.length && !shelves.dropped.length

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

  const toggleDrop = (s: Show) => {
    const { dropped, ...rest } = s
    dispatch(A.saveShow(dropped ? rest : { ...rest, dropped: true }))
    toast(dropped ? 'Вернул в очередь' : 'Уехало на полку «Не буду смотреть»')
  }

  const deleteShow = (s: Show) => {
    dispatch(A.deleteLibItem('show', s.id))
    setOpenId(null)
    toast('Убрано из очереди')
  }

  const card = (s: Show) => (
    <div key={s.id} className="ctx-target" {...menu.bind(s)}>
      <ShowCard
        show={s}
        open={openId === s.id}
        onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
        onSave={(next) => dispatch(A.saveShow(next))}
        onCopyLink={() => copyLink(s.link)}
        onFinish={() => setFinishing({ id: s.id, title: s.title })}
        onDrop={() => toggleDrop(s)}
        onDelete={() => deleteShow(s)}
      />
    </div>
  )

  const menuItems = (s: Show): CtxEntry[] => [
    { icon: '✎', label: 'Редактировать', onClick: () => setEditing(s) },
    { icon: '✔', label: 'Досмотрел', onClick: () => setFinishing({ id: s.id, title: s.title }) },
    ...(s.link ? [{ icon: '⧉', label: 'Скопировать ссылку', onClick: () => copyLink(s.link) }] : []),
    {
      icon: s.dropped ? '↩' : '✕',
      label: s.dropped ? 'Вернуть в очередь' : 'Не хочу смотреть',
      onClick: () => toggleDrop(s),
    },
    'sep',
    { icon: '🗑', label: 'Убрать', danger: true, confirm: 'Точно убрать?', onClick: () => deleteShow(s) },
  ]

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
                    <button key={k} style={chipBtn(activeKind === k, '#fbbf24')} onClick={() => setKind(k)}>
                      {showKindLabel(k)}
                    </button>
                  ))}
                  {/* «Все» — последним: сначала выбор конкретного вида, сброс — в конце ряда */}
                  <button style={chipBtn(activeKind === null, '#fbbf24')} onClick={() => setKind(null)}>
                    Все
                  </button>
                </div>
              )}
            </>
          )}

          {nothingFound ? (
            <Empty text="Ничего не нашлось — попробуй другой запрос или вид" />
          ) : (
            <>
              {shelves.top.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 11.5,
                      letterSpacing: '2px',
                      color: '#fbbf24',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    ‼ В первую очередь
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {shelves.top.map(card)}
                  </div>
                </div>
              )}

              {shelves.rest.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {shelves.rest.map(card)}
                </div>
              )}

              {shelves.dropped.length > 0 && (
                <div>
                  <button
                    onClick={() => setDroppedOpen((v) => !v)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: C.faint,
                    }}
                  >
                    {droppedOpen ? '▾' : '▸'} Не буду смотреть ({shelves.dropped.length})
                  </button>
                  {droppedOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, opacity: 0.65 }}>
                      {shelves.dropped.map(card)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <Empty text="Сохрани название — посмотришь, когда будет время" />
      )}

      <DoneShelf items={done} title="Просмотрено" now={now} />

      {menu.state &&
        (() => {
          // меню держит снимок записи с момента открытия; действовать надо по
          // свежей — пока меню открыто, запись могла измениться или исчезнуть
          // при синхронизации, и старое тело затёрло бы чужие правки
          const fresh = lib.shows.find((x) => x.id === menu.state!.data.id)
          return fresh ? (
            <ContextMenu x={menu.state.x} y={menu.state.y} items={menuItems(fresh)} onClose={menu.close} />
          ) : null
        })()}

      {showForm && (
        <ShowModal
          usedColors={usedColors}
          onCancel={() => setShowForm(false)}
          onSave={(show) => {
            dispatch(A.saveShow(show))
            setShowForm(false)
          }}
        />
      )}

      {editing && (
        <ShowModal
          usedColors={usedColors}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(edited) => {
            // модалка могла провисеть долго: позиция и рейтинг берутся из
            // свежей записи, из формы приходят только название, вид, цвет и ссылка
            const cur = lib.shows.find((x) => x.id === edited.id)
            dispatch(
              A.saveShow(
                cur
                  ? { ...cur, title: edited.title, kind: edited.kind, color: edited.color, link: edited.link }
                  : edited,
              ),
            )
            setEditing(null)
            toast('Сохранено')
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
