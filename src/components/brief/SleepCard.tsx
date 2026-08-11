import { useState } from 'react'
import { fmtClockMin, parseClock } from '../../logic/habits'
import {
  AWAKE_STALE_MS,
  awakeState,
  bedOptions,
  CYCLE_MIN,
  FALL_ASLEEP_MIN,
  nextClockTime,
  wakeOptions,
  type SleepOption,
} from '../../logic/sleep'
import { fmtDur, hhmm, minuteOf, plural } from '../../logic/time'
import { btnGhostSm, C, chipBtn, input, MONO, plainCard } from '../../theme'
import type { Activity, TimeEntry } from '../../types'

interface Props {
  entries: TimeEntry[]
  acts: Activity[]
  now: number
}

/**
 * Калькулятор циклов сна плюс время на ногах.
 *
 * Считает от текущей минуты, а не от секунды: иначе список подъёмов дёргался бы
 * каждую секунду. Цикл 90 минут — усреднение, поэтому в подписи честно сказано,
 * что это ориентир.
 */
export function SleepCard({ entries, acts, now }: Props) {
  const [mode, setMode] = useState<'now' | 'wake'>('now')
  const [wakeText, setWakeText] = useState('')

  const base = minuteOf(now) * 60_000
  const awake = awakeState(entries, acts, base)

  const wakeMin = parseClock(wakeText)
  const options: SleepOption[] =
    mode === 'now' ? wakeOptions(base) : wakeMin === null ? [] : bedOptions(nextClockTime(wakeMin, base))

  const asleepAt = base + FALL_ASLEEP_MIN * 60_000

  return (
    <div style={plainCard({ padding: '14px 16px' })}>
      <div style={{ fontSize: 11, letterSpacing: '2.5px', color: C.dim, textTransform: 'uppercase' }}>Сон</div>

      {/* ── сколько на ногах ── */}
      <div style={{ marginTop: 9, fontSize: 14, color: C.textSoft, lineHeight: 1.45 }}>
        {awake.kind === 'sleeping' ? (
          <>
            Сейчас идёт сон — с{' '}
            <span style={{ fontFamily: MONO, color: '#818cf8' }}>{hhmm(awake.since)}</span>
          </>
        ) : awake.kind === 'none' ? (
          <span style={{ color: C.faint }}>
            Отметь сон в трекере — и здесь появится, сколько ты на ногах с подъёма.
          </span>
        ) : awake.ms > AWAKE_STALE_MS ? (
          <span style={{ color: C.faint }}>
            Последний сон записан {fmtDur(awake.ms)} назад — похоже, ночь не отмечена, считать бодрствование
            не от чего.
          </span>
        ) : (
          <>
            На ногах{' '}
            <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, color: '#818cf8' }}>
              {fmtDur(awake.ms)}
            </span>{' '}
            <span style={{ color: C.faint }}>· встал в {hhmm(awake.since)}</span>
          </>
        )}
      </div>

      {/* ── переключатель режима ── */}
      <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
        <button style={chipBtn(mode === 'now', '#818cf8')} onClick={() => setMode('now')}>
          лечь сейчас
        </button>
        <button style={chipBtn(mode === 'wake', '#818cf8')} onClick={() => setMode('wake')}>
          встать в…
        </button>
        {mode === 'wake' && (
          <input
            value={wakeText}
            onChange={(e) => setWakeText(e.target.value)}
            inputMode="numeric"
            placeholder="6:20"
            aria-label="Во сколько встать"
            style={{ ...input, marginTop: 0, width: 86, flex: 'none', fontFamily: MONO }}
          />
        )}
      </div>

      <div style={{ fontSize: 12.5, color: C.faint, marginTop: 8, lineHeight: 1.45 }}>
        {mode === 'now'
          ? `Если лечь сейчас — уснёшь примерно в ${hhmm(asleepAt)}`
          : wakeMin === null
            ? 'Впиши время подъёма в формате чч:мм'
            : `Чтобы встать в ${fmtClockMin(wakeMin)}, ложись за ${FALL_ASLEEP_MIN} минут до засыпания`}
      </div>

      {/* ── варианты по циклам ── */}
      {options.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 }}>
          {options.map((o) => {
            // шесть циклов — единственный вариант, который закрывает норму взрослого
            const good = o.cycles >= 5
            return (
              <div
                key={o.cycles}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 9,
                  background: good ? 'rgba(129,140,248,.09)' : 'rgba(148,163,184,.05)',
                  border: `1px solid ${good ? 'rgba(129,140,248,.3)' : 'rgba(148,163,184,.14)'}`,
                }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 17,
                    fontWeight: 600,
                    color: good ? '#a5b4fc' : C.muted,
                    minWidth: 54,
                  }}
                >
                  {hhmm(o.at)}
                </span>
                <span style={{ fontSize: 13, color: C.textSoft }}>
                  {o.cycles} {plural(o.cycles, 'цикл', 'цикла', 'циклов')}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.faint }}>
                  {fmtDur(o.sleepMin * 60_000)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: 11.5, color: C.faint, marginTop: 9, lineHeight: 1.45 }}>
        Цикл считается по {CYCLE_MIN} минут — это среднее. У живого человека он плавает от 70 до 120 минут,
        так что времена ориентировочные: важно не попасть будильником в глубокую фазу, а не угадать минуту.
      </div>

      {mode === 'wake' && wakeMin !== null && (
        <button
          className="h-ghost-bright"
          style={{ ...btnGhostSm, marginTop: 10 }}
          onClick={() => {
            setMode('now')
            setWakeText('')
          }}
        >
          Назад к «лечь сейчас»
        </button>
      )}
    </div>
  )
}
