import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { financeCalc } from '../../logic/finance'
import { bestStreak, isDoneToday, streak } from '../../logic/habits'
import { nextSteps, pickPriority, todayHabits, type Urgency } from '../../logic/briefing'
import { actBy } from '../../logic/analytics'
import { runningEntry } from '../../logic/segs'
import { fmtClock, minuteOf, num, plural } from '../../logic/time'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { A } from '../../state/actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import { C, MONO, plainCard } from '../../theme'
import { SleepCard } from './SleepCard'
import type { Tab } from '../../types'

const URGENCY_COLOR: Record<Urgency, string> = {
  hot: '#f87171',
  warn: '#fbbf24',
  calm: '#22d3ee',
}

export function BriefTab({ onGo }: { onGo: (tab: Tab) => void }) {
  const { state, dispatch } = useData()
  const now = useNow()
  const isMobile = useIsMobile()
  const [flashId, setFlashId] = useState<string | null>(null)

  const doc = state.doc
  const minute = minuteOf(now)

  // приоритет и подсказки меняются медленно — пересчитываем раз в минуту
  const { priority, steps, calc } = useMemo(
    () => ({
      priority: pickPriority(doc, minute * 60000),
      steps: nextSteps(doc, minute * 60000),
      calc: financeCalc(doc.fin, { currency: doc.currency, rates: doc.rates }, minute * 60000),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, minute],
  )

  const run = runningEntry(doc.entries)
  const runAct = run ? actBy(doc.acts, run.actId) : null
  const dos = doc.habits.filter((h) => h.type === 'do')
  const doneN = dos.filter((h) => isDoneToday(h, now)).length

  const accent = URGENCY_COLOR[priority.urgency]

  const toggle = (id: string, wasDone: boolean) => {
    dispatch(A.toggleHabit(id))
    if (!wasDone) {
      setFlashId(id)
      setTimeout(() => setFlashId(null), 780)
    }
  }

  const indicators = [
    {
      key: 'money',
      value: calc.limit > 0 ? num(calc.limit) : '—',
      label: 'на сегодня',
      color: '#22d3ee',
      frac: doc.fin.onHand > 0 ? Math.max(0, Math.min(1, calc.free / doc.fin.onHand)) : 0,
      tab: 'fin' as Tab,
    },
    {
      key: 'track',
      value: run ? fmtClock(now - new Date(run.start).getTime()) : '—',
      label: runAct ? runAct.name : 'не трекается',
      color: runAct?.color ?? '#64748b',
      frac: run ? 1 : 0,
      tab: 'track' as Tab,
    },
    {
      key: 'habits',
      value: dos.length ? `${doneN}/${dos.length}` : '—',
      label: 'привычки',
      color: '#34d399',
      frac: dos.length ? doneN / dos.length : 0,
      tab: 'habits' as Tab,
    },
    {
      key: 'soon',
      value: calc.nearestDays !== null ? calc.nearestDays + ' дн' : '—',
      label: 'до расхода',
      color: '#fbbf24',
      frac: calc.nearestDays !== null ? Math.max(0.06, 1 - Math.min(1, calc.nearestDays / 30)) : 0,
      tab: 'fin' as Tab,
    },
  ]

  return (
    <main
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: isMobile ? '0 10px 20px' : '0 18px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* ── приоритет: одно, что важнее остального ── */}
      <button
        onClick={() => onGo(priority.tab)}
        style={{
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          padding: '16px 18px',
          borderRadius: 16,
          background: `linear-gradient(165deg, ${accent}14, rgba(10,16,32,.88))`,
          border: `1px solid ${accent}55`,
          boxShadow: `0 0 22px ${accent}1f`,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '2.5px', color: accent, textTransform: 'uppercase' }}>
          {priority.tag}
        </div>
        <div style={{ fontSize: 19, fontWeight: 600, color: C.textBright, marginTop: 6, lineHeight: 1.25 }}>
          {priority.title}
        </div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>{priority.sub}</div>
      </button>

      {/* ── лента показателей ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
        {indicators.map((i) => (
          <button key={i.key} onClick={() => onGo(i.tab)} style={cellStyle}>
            <span
              style={{
                fontFamily: MONO,
                fontSize: isMobile ? 14 : 16,
                fontWeight: 600,
                color: i.color === '#64748b' ? C.muted : i.color,
                textShadow: `0 0 10px ${i.color}44`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
              }}
            >
              {i.value}
            </span>
            <span
              style={{
                fontSize: 10.5,
                color: C.dim,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
              }}
            >
              {i.label}
            </span>
            <span style={{ display: 'block', height: 3, borderRadius: 2, background: 'rgba(148,163,184,.14)', marginTop: 5 }}>
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: Math.round(Math.max(0, Math.min(1, i.frac)) * 100) + '%',
                  background: i.color,
                  boxShadow: `0 0 8px ${i.color}88`,
                  borderRadius: 2,
                  transition: 'width .5s',
                }}
              />
            </span>
          </button>
        ))}
      </div>

      {/* ── привычки прямо здесь ── */}
      {dos.length > 0 && (
        <div style={plainCard({ padding: '14px 16px' })}>
          <div style={{ fontSize: 11, letterSpacing: '2.5px', color: C.dim, textTransform: 'uppercase' }}>Сегодня</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 11 }}>
            {todayHabits(doc).map((h) => {
              const done = isDoneToday(h, now)
              const s = streak(h, now)
              const best = bestStreak(h, now)
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => toggle(h.id, done)}
                    aria-label={done ? 'Снять отметку' : 'Отметить'}
                    style={{
                      width: 48,
                      height: 48,
                      flex: 'none',
                      borderRadius: 13,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      fontWeight: 700,
                      color: '#051018',
                      border: `1.5px solid ${done ? h.color : h.color + '55'}`,
                      background: done ? `linear-gradient(180deg,${h.color},${h.color}cc)` : h.color + '12',
                      boxShadow: done ? `0 0 16px ${h.color}66` : 'none',
                      transition: 'background .2s, box-shadow .2s',
                      padding: 0,
                      ...(flashId === h.id ? { animation: 'checkFlash .7s ease' } : null),
                    }}
                  >
                    {done ? '✓' : ''}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14.5,
                        fontWeight: 600,
                        overflowWrap: 'anywhere',
                        color: done ? C.muted : '#e9f1ff',
                        ...(done ? { textDecoration: 'line-through' } : null),
                      }}
                    >
                      {h.name}
                    </div>
                    <div style={{ fontSize: 12, color: C.faint }}>
                      рекорд {best} {plural(best, 'день', 'дня', 'дней')}
                    </div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 15, color: h.color, flex: 'none' }}>
                    {s > 0 ? '🔥 ' + s : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── сон: сколько на ногах и когда вставать ── */}
      <SleepCard entries={doc.entries} acts={doc.acts} now={now} />

      {/* ── куда дальше ── */}
      {steps.length > 0 && (
        <div style={plainCard({ padding: '13px 16px' })}>
          <div style={{ fontSize: 11, letterSpacing: '2.5px', color: C.dim, textTransform: 'uppercase' }}>
            Куда дальше
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.45 }}>
                · {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {!dos.length && !doc.fin.onHand && (
        <div style={plainCard({ padding: '16px 18px', fontSize: 13.5, color: C.faint, lineHeight: 1.55 })}>
          Экран заполнится, когда появятся данные: заведи пару привычек и укажи в «Финансах», сколько
          денег на руках — брифинг начнёт подсказывать сам.
        </div>
      )}
    </main>
  )
}

const cellStyle: CSSProperties = {
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  padding: '9px 10px 8px',
  borderRadius: 13,
  background: 'linear-gradient(165deg, rgba(22,32,58,.72), rgba(10,16,32,.88))',
  border: '1px solid rgba(110,160,255,.14)',
  minWidth: 0,
}
