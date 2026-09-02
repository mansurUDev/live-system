import { useState } from 'react'
import { courseProgress } from '../../logic/library'
import { fmtD } from '../../logic/time'
import { useNow } from '../../state/NowProvider'
import {
  btnAccent,
  btnCancelSm,
  btnDeleteConfirm,
  btnDeleteLink,
  btnEdit,
  C,
  chipSquare,
  fieldLabel,
  input,
  MONO,
  plainCard,
} from '../../theme'
import { NotesBlock } from './LibraryParts'
import type { Course } from '../../types'

interface Props {
  course: Course
  open: boolean
  onToggle: () => void
  onSave: (course: Course) => void
  onToggleSection: (sectionId: string) => void
  onNote: (text: string) => void
  onEdit: () => void
  onFinish: () => void
  onDelete: () => void
}

export function CourseCard({
  course,
  open,
  onToggle,
  onSave,
  onToggleSection,
  onNote,
  onEdit,
  onFinish,
  onDelete,
}: Props) {
  const now = useNow()
  const [pos, setPos] = useState(course.pos)
  const [minute, setMinute] = useState(String(course.minute || ''))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const pct = courseProgress(course)
  const doneCount = course.sections.filter((s) => s.done).length

  const savePosition = () => {
    const m = parseInt(minute.replace(/\s/g, ''), 10)
    onSave({ ...course, pos: pos.slice(0, 80), minute: Number.isFinite(m) ? Math.max(0, m) : course.minute })
  }

  return (
    <div style={plainCard({ padding: '13px 15px' })}>
      <div onClick={onToggle} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
        <span style={chipSquare(course.color)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.textBright, overflowWrap: 'anywhere' }}>
            {course.title}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 1 }}>
            {course.platform}
            {course.platform && course.pos ? ' · ' : ''}
            {course.pos}
            {course.minute > 0 ? ` · ${course.minute} мин` : ''}
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: course.color, flex: 'none' }}>
          {pct}%
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.textSoft }}>
          {doneCount} из {course.sections.length} разделов
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(148,163,184,.12)', overflow: 'hidden', marginTop: 4 }}>
          <div
            style={{
              height: '100%',
              width: pct + '%',
              background: `linear-gradient(90deg,${course.color}66,${course.color})`,
              boxShadow: `0 0 8px ${course.color}55`,
              borderRadius: 3,
              transition: 'width .45s cubic-bezier(.3,.8,.35,1)',
            }}
          />
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 14, borderTop: '1px dashed rgba(148,163,184,.25)', paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 160px' }}>
              <div style={fieldLabel}>Где остановился</div>
              <input
                value={pos}
                onChange={(e) => setPos(e.target.value)}
                placeholder="Лекция 24 · Хуки"
                style={input}
              />
            </div>
            <div style={{ flex: '1 1 90px' }}>
              <div style={fieldLabel}>Минута</div>
              <input
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                inputMode="numeric"
                placeholder="12"
                style={{ ...input, fontFamily: MONO }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
            {course.sections.map((s) => (
              <div
                key={s.id}
                className="h-row"
                onClick={() => onToggleSection(s.id)}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: 8,
                }}
              >
                <span
                  style={{
                    width: 19,
                    height: 19,
                    borderRadius: 5,
                    border: `1.5px solid ${s.done ? course.color : 'rgba(148,163,184,.4)'}`,
                    background: s.done ? course.color : 'transparent',
                    boxShadow: s.done ? `0 0 10px ${course.color}77` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none',
                    marginTop: 1,
                  }}
                >
                  <span style={{ color: '#061018', fontWeight: 700, fontSize: 13, lineHeight: 1 }}>
                    {s.done ? '✓' : ''}
                  </span>
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 14.5,
                    lineHeight: 1.35,
                    ...(s.done
                      ? { textDecoration: 'line-through', color: 'rgba(148,163,184,.55)' }
                      : { color: C.text }),
                  }}
                >
                  {s.text}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 9, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="h-accent" style={{ ...btnAccent, fontSize: 13.5, padding: '8px 14px' }} onClick={savePosition}>
              Сохранить позицию
            </button>
            <button className="h-ghost-bright" style={btnCancelSm} onClick={onFinish}>
              Прошёл
            </button>
            <button className="h-edit" onClick={onEdit} aria-label="Изменить курс" style={btnEdit}>
              ✎
            </button>
            <div style={{ flex: 1 }} />
            {confirmDelete ? (
              <>
                <button style={btnDeleteConfirm} onClick={onDelete}>
                  Точно убрать
                </button>
                <button style={btnCancelSm} onClick={() => setConfirmDelete(false)}>
                  Отмена
                </button>
              </>
            ) : (
              <button style={btnDeleteLink} onClick={() => setConfirmDelete(true)}>
                Убрать
              </button>
            )}
          </div>

          <NotesBlock notes={course.notes} onAdd={onNote} now={now} />

          <div style={{ fontSize: 12, color: C.faint, marginTop: 10 }}>начат {fmtD(course.startedAt, now)}</div>
        </div>
      )}
    </div>
  )
}
