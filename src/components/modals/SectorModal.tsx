import { useState } from 'react'
import { Modal } from './Modal'
import { CAT_KEYS, CATS, MAX_STEPS, MAX_STEP_TEXT, MAX_NAME, MAX_UNIT, PAL } from '../../constants'
import { makeSector } from '../../logic/defaults'
import { uid } from '../../logic/uid'
import { btnAccent, btnGhost, C, chipBtn, errText, fieldLabel, input, swatch } from '../../theme'
import type { Category, Sector, SectorKind } from '../../types'

const TYPES: { key: SectorKind; label: string; hint: string }[] = [
  { key: 'sphere', label: 'Сфера · оценка 1–10', hint: 'Здоровье, отношения, отдых…' },
  { key: 'number', label: 'Цель · числовая', hint: 'Накопить 1000 $, пробежать 200 км' },
  { key: 'steps', label: 'Цель · по этапам', hint: 'Чек-лист шагов: «Собрать машину»' },
]

const CAT_OPTIONS: { key: Category | null; label: string }[] = [
  { key: null, label: 'нет' },
  ...CAT_KEYS.map((k) => ({ key: k, label: CATS[k].label.toLowerCase() })),
]

interface Props {
  usedColors: string[]
  onCancel: () => void
  onCreate: (sector: Sector) => void
}

export function SectorModal({ usedColors, onCancel, onCreate }: Props) {
  const [kind, setKind] = useState<SectorKind>('sphere')
  const [name, setName] = useState('')
  const [color, setColor] = useState(
    () => PAL.find((c) => !usedColors.includes(c)) ?? PAL[0],
  )
  const [target, setTarget] = useState('')
  const [unit, setUnit] = useState('')
  const [stepsText, setStepsText] = useState('')
  const [cat, setCat] = useState<Category | null>(null)
  const [error, setError] = useState('')

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return setError('Напиши название')

    const seed = {
      id: uid('s'),
      name: trimmed.slice(0, MAX_NAME),
      color,
      kind,
      cat,
    }

    if (kind === 'number') {
      const value = parseFloat(target.replace(',', '.'))
      if (!(value > 0)) return setError('Укажи целевое значение — число больше нуля')
      onCreate(
        makeSector({ ...seed, target: value, current: 0, unit: unit.trim().slice(0, MAX_UNIT) }, Date.now()),
      )
      return
    }

    if (kind === 'steps') {
      const lines = stepsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      if (!lines.length) return setError('Добавь хотя бы один этап')
      onCreate(
        makeSector(
          {
            ...seed,
            steps: lines.slice(0, MAX_STEPS).map((text, i) => ({
              id: uid('t' + i + '-'),
              text: text.slice(0, MAX_STEP_TEXT),
              done: false,
            })),
          },
          Date.now(),
        ),
      )
      return
    }

    onCreate(makeSector({ ...seed, value: 5 }, Date.now()))
  }

  return (
    <Modal
      title="Что добавить на колесо"
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnGhost} onClick={onCancel}>
            Отмена
          </button>
          <button className="h-accent" style={btnAccent} onClick={submit}>
            Добавить
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setKind(t.key)
              setError('')
            }}
            style={{
              textAlign: 'left',
              width: '100%',
              fontFamily: 'inherit',
              color: '#dbe4f5',
              cursor: 'pointer',
              padding: '9px 13px',
              borderRadius: 11,
              border: `1px solid ${kind === t.key ? 'rgba(94,234,255,.55)' : 'rgba(148,163,184,.2)'}`,
              background: kind === t.key ? 'rgba(34,211,238,.1)' : 'rgba(148,163,184,.04)',
              ...(kind === t.key ? { boxShadow: '0 0 14px rgba(34,211,238,.2)' } : null),
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 15 }}>{t.label}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: C.muted, marginTop: 1 }}>{t.hint}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Название</div>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          type="text"
          maxLength={MAX_NAME}
          placeholder="например, Прочитать 20 книг"
          style={input}
        />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Цвет</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {PAL.map((c) => (
            <button key={c} style={swatch(color === c, c)} onClick={() => setColor(c)} aria-label={'Цвет ' + c} />
          ))}
        </div>
      </div>

      {kind === 'number' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 13 }}>
          <div style={{ flex: 1 }}>
            <div style={fieldLabel}>Целевое значение</div>
            <input
              value={target}
              onChange={(e) => {
                setTarget(e.target.value)
                setError('')
              }}
              type="text"
              inputMode="decimal"
              placeholder="1000"
              style={input}
            />
          </div>
          <div style={{ width: 130 }}>
            <div style={fieldLabel}>Единица</div>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              type="text"
              maxLength={MAX_UNIT}
              placeholder="$, км, книг"
              style={input}
            />
          </div>
        </div>
      )}

      {kind === 'steps' && (
        <div style={{ marginTop: 13 }}>
          <div style={fieldLabel}>Этапы — один на строку</div>
          <textarea
            value={stepsText}
            onChange={(e) => {
              setStepsText(e.target.value)
              setError('')
            }}
            rows={6}
            placeholder="Найти кузов, купить двигатель… — каждый этап с новой строки"
            style={{ ...input, resize: 'vertical' }}
          />
        </div>
      )}

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>
          Связанная категория времени <span style={{ color: C.faint }}>— для подсказок в аналитике</span>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 6 }}>
          {CAT_OPTIONS.map((o) => (
            <button
              key={o.key ?? 'none'}
              style={chipBtn(cat === o.key, o.key ? CATS[o.key].color : '#94a3b8')}
              onClick={() => setCat(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
