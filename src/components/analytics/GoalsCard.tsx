import { numberForecast, stepsForecast } from '../../logic/forecast'
import { pct } from '../../logic/pct'
import { fmtD, num, plural } from '../../logic/time'
import { C, chipDot, MONO, plainCard, sectionLabel } from '../../theme'
import type { Sector } from '../../types'

interface Props {
  sectors: Sector[]
  now: number
}

function forecastText(s: Sector, now: number): string {
  if (s.kind === 'number') {
    const f = numberForecast(s, now)
    switch (f.kind) {
      case 'done':
        return 'цель выполнена'
      case 'no-data':
      case 'negative':
        return 'пока нет темпа — добавляй прогресс'
      case 'ok':
        return (
          'при +' +
          num(f.perDay) +
          (s.unit ? ' ' + s.unit : '') +
          ' в день — через ' +
          f.days +
          ' ' +
          plural(f.days, 'день', 'дня', 'дней') +
          ', к ' +
          fmtD(f.targetAt, now)
        )
    }
  }

  const f = stepsForecast(s, now)
  switch (f.kind) {
    case 'done':
      return 'цель выполнена'
    case 'pace':
      return (
        'темп: ' +
        f.per14 +
        ' ' +
        plural(f.per14, 'этап', 'этапа', 'этапов') +
        ' за 2 недели · осталось ' +
        f.remaining
      )
    case 'plain':
      return 'осталось ' + f.remaining + ' ' + plural(f.remaining, 'этап', 'этапа', 'этапов')
  }
}

function progressText(s: Sector): string {
  const p = pct(s)
  if (s.kind === 'number') {
    return `${num(s.current)} / ${num(s.target)}${s.unit ? ' ' + s.unit : ''} · ${p}%`
  }
  const done = s.steps.filter((t) => t.done).length
  return `${done} / ${s.steps.length} · ${p}%`
}

export function GoalsCard({ sectors, now }: Props) {
  const goals = sectors.filter((s) => s.kind !== 'sphere')

  return (
    <div style={plainCard({ padding: '16px 18px' })}>
      <div style={sectionLabel}>Прогресс целей</div>
      {goals.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 13 }}>
          {goals.map((s) => (
            <div key={s.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={chipDot(s.color)} />
                <span style={{ fontSize: 14.5, fontWeight: 600, color: '#e9f1ff', flex: 1, overflowWrap: 'anywhere' }}>
                  {s.name}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.muted }}>{progressText(s)}</span>
              </div>
              <div style={{ fontSize: 13, color: C.muted, margin: '4px 0 0 17px' }}>{forecastText(s, now)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13.5, color: C.faint, marginTop: 10 }}>
          Активных целей нет — добавь цель на вкладке «Колесо».
        </div>
      )}
    </div>
  )
}
