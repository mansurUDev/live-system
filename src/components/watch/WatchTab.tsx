import { useState } from 'react'
import { MAX_SHOWS, MAX_VIDEOS } from '../../constants'
import { copyText } from '../../logic/clipboard'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { useToast } from '../../state/ToastProvider'
import { A } from '../../state/actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import { pageStyle } from '../../theme'
import { FinishModal } from '../modals/FinishModal'
import { VideoModal } from '../modals/VideoModal'
import { ShowModal } from '../modals/ShowModal'
import { DoneShelf, Empty, Shelf } from '../library/LibraryParts'
import { VideoCard } from '../library/VideoCard'
import { ShowCard } from '../library/ShowCard'
import type { Video } from '../../types'

type Finishing = { kind: 'video' | 'show'; id: string; title: string } | null
type VideoForm = { video: Video | null } | null

/**
 * Всё, что смотрят: очередь роликов и полка фильмов с позицией. Отделено от
 * «Библиотеки» — та про чтение и учёбу, здесь досуг с другим ритмом.
 */
export function WatchTab() {
  const { state, dispatch } = useData()
  const toast = useToast()
  const now = useNow()
  const isMobile = useIsMobile()
  const lib = state.doc.lib

  const [openId, setOpenId] = useState<string | null>(null)
  const [videoForm, setVideoForm] = useState<VideoForm>(null)
  const [deleteVideoId, setDeleteVideoId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [finishing, setFinishing] = useState<Finishing>(null)

  // цвета делятся со всей библиотекой, чтобы карточки не повторялись между вкладками
  const usedColors = [...lib.books, ...lib.courses, ...lib.videos, ...lib.shows].map((x) => x.color)
  const done = lib.done.filter((d) => d.kind === 'video' || d.kind === 'show')

  const toggleOpen = (id: string) => setOpenId((cur) => (cur === id ? null : id))

  const copyLink = async (link: string) => {
    if (!link) return
    toast((await copyText(link)) ? 'Ссылка скопирована' : 'Не получилось скопировать — скопируй вручную')
  }

  const openAddVideo = () => {
    if (lib.videos.length >= MAX_VIDEOS) {
      toast('Очередь видео переполнена — посмотри или убери лишние')
      return
    }
    setVideoForm({ video: null })
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
      {/* ── смотреть ── */}
      <Shelf
        title="Смотреть"
        subtitle="фильмы, сериалы, дорамы, аниме, мультфильмы и документальные — с позицией"
        onAdd={openAddShow}
      />
      {lib.shows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lib.shows.map((s) => (
            <ShowCard
              key={s.id}
              show={s}
              open={openId === s.id}
              onToggle={() => toggleOpen(s.id)}
              onSave={(next) => dispatch(A.saveShow(next))}
              onCopyLink={() => copyLink(s.link)}
              onFinish={() => setFinishing({ kind: 'show', id: s.id, title: s.title })}
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

      {/* ── видео ── */}
      <Shelf title="Видео" subtitle="вставь ссылку — посмотришь, когда будет время" onAdd={openAddVideo} />
      {lib.videos.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lib.videos.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              confirmingDelete={deleteVideoId === v.id}
              onFinish={() => setFinishing({ kind: 'video', id: v.id, title: v.title })}
              onEdit={() => setVideoForm({ video: v })}
              onCopyLink={() => copyLink(v.url)}
              onAskDelete={() => setDeleteVideoId(v.id)}
              onCancelDelete={() => setDeleteVideoId(null)}
              onDelete={() => {
                dispatch(A.deleteLibItem('video', v.id))
                setDeleteVideoId(null)
                toast('Убрано из очереди')
              }}
            />
          ))}
        </div>
      ) : (
        <Empty text="Нашёл ролик, но занят — сохрани ссылку сюда" />
      )}

      <DoneShelf items={done} title="Просмотрено" now={now} />

      {videoForm && (
        <VideoModal
          video={videoForm.video}
          usedColors={usedColors}
          onCancel={() => setVideoForm(null)}
          onCreate={(v) => {
            dispatch(A.saveVideo(v))
            setVideoForm(null)
          }}
        />
      )}

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
            dispatch(A.finishLibItem(finishing.kind, finishing.id, quote))
            setFinishing(null)
            setOpenId(null)
            toast('Готово — теперь на полке «Просмотрено»')
          }}
        />
      )}
    </main>
  )
}
