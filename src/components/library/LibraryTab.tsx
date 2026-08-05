import { useState } from 'react'
import { MAX_BOOKS, MAX_COURSES, MAX_SHOWS, MAX_VIDEOS } from '../../constants'
import { fmtD } from '../../logic/time'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { useToast } from '../../state/ToastProvider'
import { A } from '../../state/actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import { btnAccent, C, chipSquare, MONO, pageStyle, plainCard } from '../../theme'
import { LibraryModal } from '../modals/LibraryModal'
import { FinishModal } from '../modals/FinishModal'
import { VideoModal } from '../modals/VideoModal'
import { ShowModal } from '../modals/ShowModal'
import { BookCard } from './BookCard'
import { CourseCard } from './CourseCard'
import { VideoCard } from './VideoCard'
import { ShowCard } from './ShowCard'
import type { Video } from '../../types'

type Shelf = 'book' | 'course'
type Finishing = { kind: Shelf | 'video' | 'show'; id: string; title: string } | null
type VideoForm = { video: Video | null } | null

export function LibraryTab() {
  const { state, dispatch } = useData()
  const toast = useToast()
  const now = useNow()
  const isMobile = useIsMobile()
  const lib = state.doc.lib

  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState<Shelf | null>(null)
  const [videoForm, setVideoForm] = useState<VideoForm>(null)
  const [deleteVideoId, setDeleteVideoId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [finishing, setFinishing] = useState<Finishing>(null)

  const usedColors = [...lib.books, ...lib.courses, ...lib.videos, ...lib.shows].map((x) => x.color)

  const toggleOpen = (id: string) => setOpenId((cur) => (cur === id ? null : id))

  const openAdd = (kind: Shelf) => {
    const full = kind === 'book' ? lib.books.length >= MAX_BOOKS : lib.courses.length >= MAX_COURSES
    if (full) {
      toast('Слишком много активных — заверши или убери лишние')
      return
    }
    setAdding(kind)
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
        <Empty text="Нашёл видео для саморазвития, но занят — сохрани ссылку сюда" />
      )}

      {/* ── смотреть ── */}
      <Shelf title="Смотреть" subtitle="фильмы, сериалы, аниме и мультфильмы — с позицией" onAdd={openAddShow} />
      {lib.shows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lib.shows.map((s) => (
            <ShowCard
              key={s.id}
              show={s}
              open={openId === s.id}
              onToggle={() => toggleOpen(s.id)}
              onSave={(next) => dispatch(A.saveShow(next))}
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

      {/* ── полка завершённого ── */}
      {lib.done.length > 0 && (
        <>
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: C.textBright }}>Прочитано и изучено</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>{lib.done.length} на полке</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lib.done.map((d) => (
              <div key={d.id} style={plainCard({ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' })}>
                <span style={chipSquare(d.color)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.textBright, overflowWrap: 'anywhere' }}>
                    {d.title}
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
                    {d.byline}
                    {d.byline ? ' · ' : ''}
                    {d.kind === 'book'
                      ? 'книга'
                      : d.kind === 'course'
                        ? 'курс'
                        : d.kind === 'video'
                          ? 'видео'
                          : 'просмотрено'}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.faint, marginTop: 3 }}>
                    {fmtD(d.startedAt, now)} → {fmtD(d.finishedAt, now)}
                  </div>
                  {d.quote && (
                    <div
                      style={{
                        fontSize: 14.5,
                        fontStyle: 'italic',
                        color: C.textSoft,
                        marginTop: 8,
                        paddingLeft: 12,
                        borderLeft: `2px solid ${d.color}88`,
                        lineHeight: 1.5,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      «{d.quote}»
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

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
            toast('Готово — теперь на полке «Прочитано и изучено»')
          }}
        />
      )}
    </main>
  )
}

function Shelf({ title, subtitle, onAdd }: { title: string; subtitle: string; onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.textBright }}>{title}</div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ flex: 1 }} />
      <button className="h-accent" style={{ ...btnAccent, fontSize: 13.5, padding: '8px 14px' }} onClick={onAdd}>
        + Добавить
      </button>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={plainCard({ padding: 18, color: C.faint, fontSize: 14 })}>{text}</div>
}
