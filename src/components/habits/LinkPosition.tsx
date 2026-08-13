import { useState } from 'react'
import {
  firstYoutubeLink,
  fmtSeconds,
  getVideoPosition,
  hasPlaylist,
  setVideoPosition,
  updateNoteLink,
} from '../../logic/videoPosition'
import { C, MONO } from '../../theme'
import type { Habit } from '../../types'

/**
 * Позиция в видео у первой youtube-ссылки заметки: на какой минуте остановился
 * и какой номер в плейлисте. Правка переписывает параметры прямо в URL, поэтому
 * копия ссылки где угодно — в карточке, в брифинге — сама ведёт на нужное место.
 */
export function LinkPosition({ habit, onUpdateNote }: { habit: Habit; onUpdateNote: (note: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [minText, setMinText] = useState('')
  const [idxText, setIdxText] = useState('')

  const url = firstYoutubeLink(habit.note)
  if (!url) return null

  const pos = getVideoPosition(url)
  const withPlaylist = hasPlaylist(url)

  const openEdit = () => {
    setMinText(pos.seconds ? String(Math.floor(pos.seconds / 60)) : '')
    setIdxText(pos.index ? String(pos.index) : '')
    setEditing(true)
  }

  const save = () => {
    const minutes = parseInt(minText, 10)
    const index = parseInt(idxText, 10)
    const next = setVideoPosition(url, {
      seconds: Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : null,
      index: Number.isFinite(index) && index > 0 ? index : null,
    })
    onUpdateNote(updateNoteLink(habit.note, url, next))
    setEditing(false)
  }

  const chip = (text: string) => (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 11.5,
        color: C.textSoft,
        background: `${habit.color}12`,
        border: `1px solid ${habit.color}30`,
        borderRadius: 6,
        padding: '2px 7px',
      }}
    >
      {text}
    </span>
  )

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        {pos.index !== null && chip(`урок ${pos.index}`)}
        {pos.seconds !== null && chip(`с ${fmtSeconds(pos.seconds)}`)}
        <button
          onClick={openEdit}
          style={{
            fontFamily: 'inherit',
            fontSize: 11.5,
            color: C.faint,
            background: 'none',
            border: '1px dashed rgba(148,163,184,.3)',
            borderRadius: 6,
            padding: '2px 8px',
            cursor: 'pointer',
          }}
        >
          {pos.seconds !== null || pos.index !== null ? '✎ позиция' : '⏱ где остановился'}
        </button>
      </div>
    )
  }

  const smallInput = {
    fontFamily: MONO,
    fontSize: 12.5,
    color: C.text,
    background: 'rgba(8,13,26,.6)',
    border: '1px solid rgba(148,163,184,.3)',
    borderRadius: 7,
    padding: '4px 8px',
    width: 64,
  } as const

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
      {withPlaylist && (
        <>
          <span style={{ fontSize: 11.5, color: C.faint }}>урок №</span>
          <input
            value={idxText}
            onChange={(e) => setIdxText(e.target.value)}
            inputMode="numeric"
            placeholder="7"
            aria-label="Номер видео в плейлисте"
            style={smallInput}
          />
        </>
      )}
      <span style={{ fontSize: 11.5, color: C.faint }}>минута</span>
      <input
        value={minText}
        onChange={(e) => setMinText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
        }}
        inputMode="numeric"
        placeholder="35"
        aria-label="Минута, на которой остановился"
        style={smallInput}
      />
      <button
        onClick={save}
        style={{
          fontFamily: 'inherit',
          fontSize: 11.5,
          color: '#8ff4ff',
          background: 'rgba(34,211,238,.1)',
          border: '1px solid rgba(94,234,255,.4)',
          borderRadius: 6,
          padding: '3px 10px',
          cursor: 'pointer',
        }}
      >
        Сохранить
      </button>
      <button
        onClick={() => setEditing(false)}
        style={{
          fontFamily: 'inherit',
          fontSize: 11.5,
          color: C.muted,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '3px 4px',
        }}
      >
        отмена
      </button>
    </div>
  )
}
