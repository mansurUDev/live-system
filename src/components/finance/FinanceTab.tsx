import { useState } from 'react'
import { financeCalc, goalHistory, goalProgress } from '../../logic/finance'
import { fmtD, num, plural } from '../../logic/time'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { A } from '../../state/actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  btnAccent,
  btnGhostSm,
  C,
  fieldLabel,
  input,
  MONO,
  pageStyle,
  plainCard,
  sectionLabel,
} from '../../theme'
import { MoneyField } from './MoneyField'
import type { MandatoryExpense, OneTimeExpense } from '../../types'

export function FinanceTab() {
  const { state, dispatch } = useData()
  const now = useNow()
  const isMobile = useIsMobile()
  const fin = state.doc.fin
  const calc = financeCalc(fin, now)
  const progress = goalProgress(fin)
  const months = goalHistory(fin, isMobile ? 8 : 12, now)

  const [newMand, setNewMand] = useState({ name: '', amount: '' })
  const [newOne, setNewOne] = useState({ name: '', amount: '', date: '' })

  const patch = (p: Parameters<typeof A.patchFinance>[0]) => dispatch(A.patchFinance(p))

  const addMandatory = () => {
    const amount = parseFloat(newMand.amount.replace(',', '.'))
    if (!newMand.name.trim() || !Number.isFinite(amount) || amount <= 0) return
    const item: MandatoryExpense = { id: A.newExpenseId(), name: newMand.name.trim(), amount }
    dispatch(A.saveMandatory(item))
    setNewMand({ name: '', amount: '' })
  }

  const addOneTime = () => {
    const amount = parseFloat(newOne.amount.replace(',', '.'))
    if (!newOne.name.trim() || !Number.isFinite(amount) || amount <= 0) return
    const item: OneTimeExpense = {
      id: A.newExpenseId(),
      name: newOne.name.trim(),
      amount,
      date: newOne.date,
    }
    dispatch(A.saveOneTime(item))
    setNewOne({ name: '', amount: '', date: '' })
  }

  return (
    <main style={{ ...pageStyle(isMobile), display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── планка дохода ── */}
      <div style={plainCard({ padding: '16px 18px' })}>
        <div style={sectionLabel}>Планка дохода в месяц</div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '10px 0 6px', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 600, lineHeight: 1, color: C.textBright }}>
            {num(fin.got)}
          </div>
          <div style={{ fontSize: 14, color: C.muted }}>
            из {num(fin.goal)} в этом месяце
            {fin.goal > 0 && fin.got >= fin.goal ? ' · планка взята' : ''}
          </div>
        </div>

        <div
          style={{
            height: 10,
            borderRadius: 5,
            background: 'rgba(148,163,184,.12)',
            border: '1px solid rgba(148,163,184,.15)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: progress * 100 + '%',
              transition: 'width .55s cubic-bezier(.3,.8,.35,1)',
              background: 'linear-gradient(90deg,#34d39966,#34d399)',
              boxShadow: '0 0 12px #34d39966',
              borderRadius: 4,
            }}
          />
        </div>

        {/* история месяцев: выполнил — не выполнил */}
        <div style={{ display: 'flex', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
          {months.map((m) => (
            <span
              key={m.key}
              title={m.key + (m.ok === null ? ' — идёт' : m.ok ? ' — взято' : ' — не дотянул')}
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                flex: 'none',
                background:
                  m.ok === true ? '#34d399' : m.ok === false ? 'rgba(248,113,113,.35)' : 'rgba(148,163,184,.14)',
                boxShadow: m.ok === true ? '0 0 9px #34d39966' : 'none',
                border: m.ok === null ? '1px dashed rgba(148,163,184,.5)' : 'none',
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 130 }}>
            <MoneyField label="Планка" value={fin.goal} onChange={(v) => patch({ goal: v })} placeholder="2000" />
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <MoneyField label="Получено" value={fin.got} onChange={(v) => patch({ got: v })} placeholder="0" />
          </div>
        </div>
      </div>

      {/* ── дневной лимит ── */}
      <div style={plainCard({ padding: '16px 18px' })}>
        <div style={sectionLabel}>Сколько можно тратить</div>

        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <MoneyField
              label="На руках сейчас"
              value={fin.onHand}
              onChange={(v) => patch({ onHand: v })}
              placeholder="0"
              hint="обнови, когда проверяешь баланс"
              big
            />
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={fieldLabel}>Следующее поступление</div>
            <input
              value={fin.nextIncome}
              onChange={(e) => patch({ nextIncome: e.target.value })}
              type="date"
              style={{ ...input, padding: '8px 11px' }}
            />
            <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>
              {calc.dateOk
                ? `через ${calc.days} ${plural(calc.days, 'день', 'дня', 'дней')}`
                : 'не задано — считаю на 30 дней'}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: '14px 16px',
            borderRadius: 14,
            background: 'linear-gradient(165deg, rgba(34,211,238,.08), rgba(10,16,32,.5))',
            border: '1px solid rgba(94,234,255,.28)',
            boxShadow: '0 0 20px rgba(34,211,238,.1)',
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 38,
              fontWeight: 600,
              lineHeight: 1,
              color: C.cyanBright,
              textShadow: '0 0 20px rgba(34,211,238,.5)',
            }}
          >
            {num(calc.limit)}
          </div>
          <div style={{ fontSize: 14, color: C.textSoft, marginTop: 4 }}>можно тратить в день</div>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
            (на руках {num(fin.onHand)} − обязательные {num(calc.mandatory)} − запланированные{' '}
            {num(calc.reservedTotal)} − запас {num(fin.cushion)}) ÷ {calc.days}
          </div>
          {calc.upcomingTotal > calc.reservedTotal && (
            <div style={{ fontSize: 12, color: C.faint, marginTop: 4, lineHeight: 1.5 }}>
              Ещё {num(calc.upcomingTotal - calc.reservedTotal)} запланировано позже следующего
              поступления — их пока не вычитаю, они лягут на будущую зарплату.
            </div>
          )}
          {calc.limit > 0 && (
            <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>
              при этом темпе хватит до {fmtD(calc.lastDay, now)}
            </div>
          )}
          {calc.free < 0 && (
            <div style={{ fontSize: 13, color: C.dangerText, marginTop: 8 }}>
              Обязательства уже больше, чем есть на руках — на свободные траты не остаётся.
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, maxWidth: 220 }}>
          <MoneyField
            label="Неприкосновенный запас"
            value={fin.cushion}
            onChange={(v) => patch({ cushion: v })}
            placeholder="0"
            hint="на непредвиденное — в лимит не попадёт"
          />
        </div>
      </div>

      {/* ── обязательные расходы ── */}
      <div style={plainCard({ padding: '16px 18px' })}>
        <div style={sectionLabel}>Обязательные в месяц · {num(calc.mandatory)}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {fin.mandatory.map((m) => (
            <div
              key={m.id}
              className="h-row-soft"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8 }}
            >
              <span style={{ flex: 1, fontSize: 14.5, color: C.text, overflowWrap: 'anywhere' }}>{m.name}</span>
              <span style={{ fontFamily: MONO, fontSize: 14, color: C.textSoft }}>{num(m.amount)}</span>
              <button
                onClick={() => dispatch(A.deleteMandatory(m.id))}
                aria-label="Убрать"
                style={{
                  fontFamily: 'inherit',
                  fontSize: 13,
                  color: C.danger,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  opacity: 0.7,
                }}
              >
                ✕
              </button>
            </div>
          ))}
          {!fin.mandatory.length && (
            <div style={{ fontSize: 13.5, color: C.faint }}>
              Стрижка, еда, связь, аренда — то, что уходит каждый месяц
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input
            value={newMand.name}
            onChange={(e) => setNewMand({ ...newMand, name: e.target.value })}
            placeholder="Название"
            style={{ ...input, marginTop: 0, flex: '1 1 140px', width: 'auto' }}
          />
          <input
            value={newMand.amount}
            onChange={(e) => setNewMand({ ...newMand, amount: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addMandatory()
            }}
            inputMode="decimal"
            placeholder="Сумма"
            style={{ ...input, marginTop: 0, width: 100, flex: 'none' }}
          />
          <button className="h-ghost-bright" style={btnGhostSm} onClick={addMandatory}>
            Добавить
          </button>
        </div>
      </div>

      {/* ── разовые запланированные ── */}
      <div style={plainCard({ padding: '16px 18px' })}>
        <div style={sectionLabel}>Запланированные · {num(calc.upcomingTotal)}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {calc.upcoming.map((o, i) => (
            <ExpenseRow
              key={o.id}
              item={o}
              now={now}
              highlight={i === 0}
              reserved={new Date(o.date + 'T00:00:00').getTime() < calc.reserveCutoff}
              onDelete={() => dispatch(A.deleteOneTime(o.id))}
            />
          ))}
          {calc.past.map((o) => (
            <ExpenseRow key={o.id} item={o} now={now} past onDelete={() => dispatch(A.deleteOneTime(o.id))} />
          ))}
          {!fin.oneTime.length && (
            <div style={{ fontSize: 13.5, color: C.faint }}>
              День рождения, подписка, крупная покупка — то, что известно заранее
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input
            value={newOne.name}
            onChange={(e) => setNewOne({ ...newOne, name: e.target.value })}
            placeholder="Название"
            style={{ ...input, marginTop: 0, flex: '1 1 130px', width: 'auto' }}
          />
          <input
            value={newOne.amount}
            onChange={(e) => setNewOne({ ...newOne, amount: e.target.value })}
            inputMode="decimal"
            placeholder="Сумма"
            style={{ ...input, marginTop: 0, width: 90, flex: 'none' }}
          />
          <input
            value={newOne.date}
            onChange={(e) => setNewOne({ ...newOne, date: e.target.value })}
            type="date"
            style={{ ...input, marginTop: 0, width: 150, flex: 'none', padding: '8px 11px' }}
          />
          <button className="h-accent" style={{ ...btnAccent, fontSize: 13.5, padding: '8px 14px' }} onClick={addOneTime}>
            Добавить
          </button>
        </div>
      </div>
    </main>
  )
}

function ExpenseRow({
  item,
  now,
  highlight,
  past,
  reserved,
  onDelete,
}: {
  item: OneTimeExpense
  now: number
  highlight?: boolean
  past?: boolean
  /** попадает ли расход в резерв текущего дневного лимита */
  reserved?: boolean
  onDelete: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 11px',
        borderRadius: 10,
        background: highlight ? 'rgba(251,191,36,.08)' : 'rgba(148,163,184,.05)',
        border: `1px solid ${highlight ? 'rgba(251,191,36,.35)' : 'rgba(148,163,184,.14)'}`,
        opacity: past ? 0.5 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, color: C.text, overflowWrap: 'anywhere' }}>{item.name}</div>
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 1 }}>
          {item.date ? fmtD(item.date + 'T00:00:00', now) : 'без даты'}
          {past ? ' · прошло' : !reserved ? ' · после зарплаты, лимит не трогает' : ''}
        </div>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 15, color: highlight ? '#fbbf24' : C.textSoft }}>
        {num(item.amount)}
      </span>
      <button
        onClick={onDelete}
        aria-label="Убрать"
        style={{
          fontFamily: 'inherit',
          fontSize: 13,
          color: C.danger,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          opacity: 0.7,
        }}
      >
        ✕
      </button>
    </div>
  )
}
