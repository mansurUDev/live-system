import { AGENDA_DAYS, agenda } from '../../logic/agenda'
import { fmtDayMonth, localDateKey, plural } from '../../logic/time'
import { C, MONO, plainCard } from '../../theme'
import type { Doc, Tab } from '../../types'

/** Подпись срока: «сегодня» и «завтра» читаются быстрее, чем «через 0 дней» */
function whenLabel(days: number): string {
  if (days < 0) return `просрочено на ${-days} ${plural(-days, 'день', 'дня', 'дней')}`
  if (days === 0) return 'сегодня'
  if (days === 1) return 'завтра'
  return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`
}

/**
 * Что ждёт в ближайший месяц — одним списком по датам.
 *
 * Без такой сводки сроки живут по своим вкладкам и вспоминаются в день
 * платежа: беспроцентный период по займу видно только в «Финансах», книгу —
 * только в «Книгах».
 */
export function AgendaCard({ doc, now, onGo }: { doc: Doc; now: number; onGo: (tab: Tab) => void }) {
  const items = agenda(doc, now)
  if (!items.length) return null

  return (
    <div style={plainCard({ padding: '14px 16px' })}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, letterSpacing: '2.5px', color: C.dim, textTransform: 'uppercase' }}>
          Ближайшие {AGENDA_DAYS} дней
        </div>
        <div style={{ fontSize: 12, color: C.faint }}>
          {items.length} {plural(items.length, 'срок', 'срока', 'сроков')}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {items.map((it) => {
          const late = it.days < 0
          const soon = it.days >= 0 && it.days <= 3
          return (
            <button
              key={it.id}
              onClick={() => onGo(it.tab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                width: '100%',
                textAlign: 'left',
                fontFamily: 'inherit',
                cursor: 'pointer',
                padding: '9px 11px',
                borderRadius: 10,
                background: late ? 'rgba(248,113,113,.09)' : soon ? 'rgba(251,191,36,.07)' : 'rgba(148,163,184,.05)',
                border: `1px solid ${late ? 'rgba(248,113,113,.35)' : soon ? 'rgba(251,191,36,.28)' : 'rgba(148,163,184,.14)'}`,
              }}
            >
              <span
                style={{
                  width: 4,
                  alignSelf: 'stretch',
                  borderRadius: 2,
                  background: it.color,
                  boxShadow: `0 0 8px ${it.color}66`,
                  flex: 'none',
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 14,
                    color: C.text,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {it.title}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: C.faint, marginTop: 1 }}>{it.sub}</span>
              </span>
              <span style={{ textAlign: 'right', flex: 'none' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    color: late ? C.dangerText : soon ? '#fbbf24' : C.muted,
                  }}
                >
                  {whenLabel(it.days)}
                </span>
                <span style={{ display: 'block', fontFamily: MONO, fontSize: 11.5, color: C.faint, marginTop: 1 }}>
                  {fmtDayMonth(localDateKey(it.at))}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
