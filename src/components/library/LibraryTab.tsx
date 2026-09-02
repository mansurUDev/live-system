import { useState } from 'react'
import { MAX_COURSES, MAX_VIDEOS } from '../../constants'
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
import { CourseModal } from '../modals/CourseModal'
import { FinishModal } from '../modals/FinishModal'
import { VideoModal } from '../modals/VideoModal'
import { CourseCard } from './CourseCard'
import { VideoCard } from './VideoCard'
import { DoneShelf, Empty, Shelf } from './LibraryParts'
import type { Course, LibDone, Video } from '../../types'

type Finishing = { kind: 'course' | 'video'; id: string; title: string } | null
type VideoForm = { video: Video | null } | null
type CourseForm = { course: Course | null } | null
type MenuTarget = { kind: 'course'; course: Course } | { kind: 'video'; video: Video }

/** Учёба — курсы и очередь видео; книгам своя вкладка, фильмам — «Смотреть» */
export function LibraryTab() {
  const { state, dispatch } = useData()
  const toast = useToast()
  const now = useNow()
  const isMobile = useIsMobile()
  const lib = state.doc.lib

  const [openId, setOpenId] = useState<string | null>(null)
  const [courseForm, setCourseForm] = useState<CourseForm>(null)
  const [videoForm, setVideoForm] = useState<VideoForm>(null)
  const [deleteVideoId, setDeleteVideoId] = useState<string | null>(null)
  const [finishing, setFinishing] = useState<Finishing>(null)
  const menu = useContextMenu<MenuTarget>()

  // цвета делятся со всей библиотекой, чтобы карточки не повторялись между вкладками
  const usedColors = [...lib.books, ...lib.courses, ...lib.videos, ...lib.shows].map((x) => x.color)
  const done = lib.done.filter((d) => d.kind === 'course' || d.kind === 'video')

  const toggleOpen = (id: string) => setOpenId((cur) => (cur === id ? null : id))

  const copyLink = async (link: string) => {
    if (!link) return
    toast((await copyText(link)) ? 'Ссылка скопирована' : 'Не получилось скопировать — скопируй вручную')
  }

  const openAddCourse = () => {
    if (lib.courses.length >= MAX_COURSES) {
      toast('Слишком много активных — заверши или убери лишние')
      return
    }
    setCourseForm({ course: null })
  }

  const openAddVideo = () => {
    if (lib.videos.length >= MAX_VIDEOS) {
      toast('Очередь видео переполнена — посмотри или убери лишние')
      return
    }
    setVideoForm({ video: null })
  }

  const deleteCourse = (c: Course) => {
    const index = lib.courses.findIndex((x) => x.id === c.id)
    dispatch(A.deleteLibItem('course', c.id))
    setOpenId(null)
    toast('Убрано из учёбы', {
      action: { label: 'Отменить', onClick: () => dispatch(A.restore('courses', c, index)) },
    })
  }

  const deleteVideo = (v: Video) => {
    const index = lib.videos.findIndex((x) => x.id === v.id)
    dispatch(A.deleteLibItem('video', v.id))
    setDeleteVideoId(null)
    toast('Убрано из очереди', {
      action: { label: 'Отменить', onClick: () => dispatch(A.restore('videos', v, index)) },
    })
  }

  const menuItems = (t: MenuTarget): CtxEntry[] =>
    t.kind === 'course'
      ? [
          { icon: '✎', label: 'Редактировать', onClick: () => setCourseForm({ course: t.course }) },
          { icon: '✔', label: 'Прошёл', onClick: () => setFinishing({ kind: 'course', id: t.course.id, title: t.course.title }) },
          'sep',
          { icon: '🗑', label: 'Убрать', danger: true, onClick: () => deleteCourse(t.course) },
        ]
      : [
          { icon: '✎', label: 'Редактировать', onClick: () => setVideoForm({ video: t.video }) },
          { icon: '✔', label: 'Просмотрено', onClick: () => setFinishing({ kind: 'video', id: t.video.id, title: t.video.title }) },
          { icon: '⧉', label: 'Скопировать ссылку', onClick: () => copyLink(t.video.url) },
          'sep',
          { icon: '🗑', label: 'Убрать', danger: true, onClick: () => deleteVideo(t.video) },
        ]

  const returnDone = (d: LibDone) => {
    const act = A.returnDone(d)
    if (!act) return
    dispatch(act)
    toast('Снова в учёбе — заполни разделы и позицию')
  }

  const deleteDone = (d: LibDone) => {
    const index = lib.done.findIndex((x) => x.id === d.id)
    dispatch(A.deleteDone(d.id))
    toast('Убрано с полки', {
      action: { label: 'Отменить', onClick: () => dispatch(A.restore('done', d, index)) },
    })
  }

  return (
    <main style={{ ...pageStyle(isMobile), display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── курсы ── */}
      <Shelf title="Курсы" subtitle="раздел, минута и заметки" onAdd={openAddCourse} />
      {lib.courses.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lib.courses.map((c) => (
            <div key={c.id} className="ctx-target" {...menu.bind({ kind: 'course', course: c })}>
            <CourseCard
              course={c}
              open={openId === c.id}
              onToggle={() => toggleOpen(c.id)}
              onSave={(next) => dispatch(A.saveCourse(next))}
              onEdit={() => setCourseForm({ course: c })}
              onToggleSection={(sid) => dispatch(A.toggleSection(c.id, sid))}
              onNote={(text) => dispatch(A.addNote('course', c.id, text))}
              onFinish={() => setFinishing({ kind: 'course', id: c.id, title: c.title })}
              onDelete={() => deleteCourse(c)}
            />
            </div>
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
            <div key={v.id} className="ctx-target" {...menu.bind({ kind: 'video', video: v })}>
            <VideoCard
              video={v}
              confirmingDelete={deleteVideoId === v.id}
              onFinish={() => setFinishing({ kind: 'video', id: v.id, title: v.title })}
              onEdit={() => setVideoForm({ video: v })}
              onCopyLink={() => copyLink(v.url)}
              onAskDelete={() => setDeleteVideoId(v.id)}
              onCancelDelete={() => setDeleteVideoId(null)}
              onDelete={() => deleteVideo(v)}
            />
            </div>
          ))}
        </div>
      ) : (
        <Empty text="Нашёл видео для саморазвития, но занят — сохрани ссылку сюда" />
      )}

      <DoneShelf items={done} title="Изучено" now={now} onReturn={returnDone} onDelete={deleteDone} />

      {menu.state &&
        (() => {
          // см. WatchTab: пункты действуют по свежей записи, а не по снимку
          const t = menu.state.data
          const fresh: MenuTarget | null =
            t.kind === 'course'
              ? ((c) => (c ? { kind: 'course' as const, course: c } : null))(
                  lib.courses.find((x) => x.id === t.course.id),
                )
              : ((v) => (v ? { kind: 'video' as const, video: v } : null))(
                  lib.videos.find((x) => x.id === t.video.id),
                )
          return fresh ? (
            <ContextMenu x={menu.state.x} y={menu.state.y} items={menuItems(fresh)} onClose={menu.close} />
          ) : null
        })()}

      {courseForm && (
        <CourseModal
          course={courseForm.course}
          usedColors={usedColors}
          onCancel={() => setCourseForm(null)}
          onSave={(course) => {
            dispatch(A.saveCourse(course))
            setCourseForm(null)
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

      {finishing && (
        <FinishModal
          title={finishing.title}
          onCancel={() => setFinishing(null)}
          onConfirm={(quote) => {
            dispatch(A.finishLibItem(finishing.kind, finishing.id, quote))
            setFinishing(null)
            setOpenId(null)
            toast('Готово — теперь на полке «Изучено»')
          }}
        />
      )}
    </main>
  )
}
