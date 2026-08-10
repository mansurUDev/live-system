import { useState } from 'react'
import { approx, money } from '../../logic/currency'
import { financeCalc, goalHistory, goalProgress } from '../../logic/finance'
import { fmtD, plural } from '../../logic/time'
import { useData } from '../../state/DataProvider'
import { useNow } from '../../state/NowProvider'
import { A } from '../../state/actions'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  btnAccent,
  C,
  fieldLabel,
  input,
  MONO,
  pageStyle,
  plainCard,
  sectionLabel,
} from '../../theme'
import { ExpenseModal, type ExpenseDraft } from '../modals/ExpenseModal'
import { MoneyField } from './MoneyField'
import type { CurrencyCode, OneTimeExpense, Rates } from '../../types'

/** Что открыто в модалке: вид расхода и id — либо null у нового */
type ExpenseForm = { kind: 'mandatory' | 'oneTime'; id: string | null; draft: ExpenseDraft | null } | null

export function FinanceTab() {
  const { state, dispatch } = useData()
  const now = useNow()
  const isMobile = useIsMobile()
  const fin = state.doc.fin
  const currency = state.doc.currency
  const rates = state.doc.rates
  const calc = financeCalc(fin, { currency, rates }, now)
  const progress = goalProgress(fin)
  const months = goalHistory(fin, isMobile ? 8 : 12, now)

  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(null)

  const patch = (p: Parameters<typeof A.patchFinance>[0]) => dispatch(A.patchFinance(p))

  const saveExpense = (d: ExpenseDraft) => {
    if (!expenseForm) return
    const id = expenseForm.id ?? A.newExpenseId()
    if (expenseForm.kind === 'mandatory') {
      dispatch(A.saveMandatory({ id, name: d.name, amount: d.amount, currency: d.currency }))
    } else {
      dispatch(A.saveOneTime({ id, name: d.name, amount: d.amount, currency: d.currency, date: d.date }))
    }
    setExpenseForm(null)
  }

  const deleteExpense = () => {
    if (!expenseForm?.id) return
    if (expenseForm.kind === 'mandatory') dispatch(A.deleteMandatory(expenseForm.id))
    else dispatch(A.deleteOneTime(expenseForm.id))
    setExpenseForm(null)
  }

  return (
    <main style={{ ...pageStyle(isMobile), display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── планка дохода ── */}
      <div style={plainCard({ padding: '16px 18px' })}>
        <div style={sectionLabel}>Планка дохода в месяц</div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '10px 0 6px', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 600, lineHeight: 1, color: C.textBright }}>
            {money(fin.got, currency)}
          </div>
          <div style={{ fontSize: 14, color: C.muted }}>
            из {money(fin.goal, currency)} в этом месяце
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
            {money(calc.limit, currency)}
          </div>
          <div style={{ fontSize: 14, color: C.textSoft, marginTop: 4 }}>можно тратить в день</div>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
            (на руках {money(fin.onHand, currency)} − обязательные {money(calc.mandatory, currency)} − запланированные{' '}
            {money(calc.reservedTotal, currency)} − запас {money(fin.cushion, currency)}) ÷ {calc.days}
          </div>
          {calc.upcomingTotal > calc.reservedTotal && (
            <div style={{ fontSize: 12, color: C.faint, marginTop: 4, lineHeight: 1.5 }}>
              Ещё {money(calc.upcomingTotal - calc.reservedTotal, currency)} запланировано позже следующего
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
        <div style={sectionLabel}>Обязательные в месяц · {money(calc.mandatory, currency)}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {fin.mandatory.map((m) => (
            <button
              key={m.id}
              className="h-row-soft"
              onClick={() =>
                setExpenseForm({
                  kind: 'mandatory',
                  id: m.id,
                  draft: { name: m.name, amount: m.amount, currency: m.currency, date: '' },
                })
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 9px',
                borderRadius: 8,
                width: '100%',
                textAlign: 'left',
                fontFamily: 'inherit',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span style={{ flex: 1, fontSize: 14.5, color: C.text, overflowWrap: 'anywhere' }}>{m.name}</span>
              <Amount amount={m.amount} from={m.currency} to={currency} rates={rates} />
            </button>
          ))}
          {!fin.mandatory.length && (
            <div style={{ fontSize: 13.5, color: C.faint }}>
              Стрижка, еда, связь, аренда — то, что уходит каждый месяц
            </div>
          )}
        </div>

        <button
          className="h-accent"
          style={{ ...btnAccent, fontSize: 13.5, padding: '8px 14px', marginTop: 12 }}
          onClick={() => setExpenseForm({ kind: 'mandatory', id: null, draft: null })}
        >
          + Добавить
        </button>
      </div>

      {/* ── разовые запланированные ── */}
      <div style={plainCard({ padding: '16px 18px' })}>
        <div style={sectionLabel}>Запланированные · {money(calc.upcomingTotal, currency)}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {calc.upcoming.map((o, i) => (
            <ExpenseRow
              key={o.id}
              item={o}
              now={now}
              currency={currency}
              rates={rates}
              highlight={i === 0}
              reserved={new Date(o.date + 'T00:00:00').getTime() < calc.reserveCutoff}
              onEdit={() => setExpenseForm({ kind: 'oneTime', id: o.id, draft: toDraft(o) })}
            />
          ))}
          {calc.past.map((o) => (
            <ExpenseRow
              key={o.id}
              item={o}
              now={now}
              currency={currency}
              rates={rates}
              past
              onEdit={() => setExpenseForm({ kind: 'oneTime', id: o.id, draft: toDraft(o) })}
            />
          ))}
          {!fin.oneTime.length && (
            <div style={{ fontSize: 13.5, color: C.faint }}>
              День рождения, подписка, крупная покупка — то, что известно заранее
            </div>
          )}
        </div>

        <button
          className="h-accent"
          style={{ ...btnAccent, fontSize: 13.5, padding: '8px 14px', marginTop: 12 }}
          onClick={() => setExpenseForm({ kind: 'oneTime', id: null, draft: null })}
        >
          + Добавить
        </button>
      </div>

      {expenseForm && (
        <ExpenseModal
          draft={expenseForm.draft}
          withDate={expenseForm.kind === 'oneTime'}
          docCurrency={currency}
          rates={rates}
          onCancel={() => setExpenseForm(null)}
          onSave={saveExpense}
          onDelete={deleteExpense}
        />
      )}
    </main>
  )
}

function toDraft(o: OneTimeExpense): ExpenseDraft {
  return { name: o.name, amount: o.amount, currency: o.currency, date: o.date }
}

/** Сумма в своей валюте, а под ней — та же сумма в валюте отображения */
function Amount({
  amount,
  from,
  to,
  rates,
  big,
  color,
}: {
  amount: number
  from: CurrencyCode
  to: CurrencyCode
  rates: Rates
  big?: boolean
  color?: string
}) {
  return (
    <span style={{ textAlign: 'right', flex: 'none' }}>
      <span style={{ display: 'block', fontFamily: MONO, fontSize: big ? 15 : 14, color: color ?? C.textSoft }}>
        {money(amount, from)}
      </span>
      {from !== to && (
        <span style={{ display: 'block', fontFamily: MONO, fontSize: 11.5, color: C.faint, marginTop: 1 }}>
          {approx(amount, from, to, rates)}
        </span>
      )}
    </span>
  )
}

function ExpenseRow({
  item,
  now,
  currency,
  rates,
  highlight,
  past,
  reserved,
  onEdit,
}: {
  item: OneTimeExpense
  now: number
  currency: CurrencyCode
  rates: Rates
  highlight?: boolean
  past?: boolean
  /** попадает ли расход в резерв текущего дневного лимита */
  reserved?: boolean
  onEdit: () => void
}) {
  return (
    <button
      onClick={onEdit}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 11px',
        borderRadius: 10,
        width: '100%',
        textAlign: 'left',
        fontFamily: 'inherit',
        cursor: 'pointer',
        background: highlight ? 'rgba(251,191,36,.08)' : 'rgba(148,163,184,.05)',
        border: `1px solid ${highlight ? 'rgba(251,191,36,.35)' : 'rgba(148,163,184,.14)'}`,
        opacity: past ? 0.5 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, color: C.text, overflowWrap: 'anywhere' }}>{item.name}</div>
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 1 }}>
          {item.date ? fmtD(item.date + 'T00:00:00', now) : 'без даты'}
          {past ? ' · прошло' : !item.date ? ' · лимит не трогает' : !reserved ? ' · после зарплаты, лимит не трогает' : ''}
        </div>
      </div>
      <Amount
        amount={item.amount}
        from={item.currency}
        to={currency}
        rates={rates}
        big
        color={highlight ? '#fbbf24' : undefined}
      />
    </button>
  )
}
