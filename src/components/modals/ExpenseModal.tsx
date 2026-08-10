import { useState } from 'react'
import { Modal } from './Modal'
import { CURRENCIES, MAX_EXPENSE_NAME } from '../../constants'
import { inOtherCurrencies } from '../../logic/currency'
import {
  btnAccent,
  btnCancelSm,
  btnDeleteConfirm,
  btnDeleteLink,
  btnGhost,
  C,
  chipBtn,
  errText,
  fieldLabel,
  input,
} from '../../theme'
import type { CurrencyCode, Rates } from '../../types'

/** Общая форма обоих видов расхода: у запланированного есть ещё дата */
export interface ExpenseDraft {
  name: string
  amount: number
  currency: CurrencyCode
  /** YYYY-MM-DD; у обязательных всегда пустая */
  date: string
}

interface Props {
  /** null — создаём новый */
  draft: ExpenseDraft | null
  /** у запланированных спрашиваем дату, у обязательных её нет */
  withDate: boolean
  docCurrency: CurrencyCode
  rates: Rates
  onCancel: () => void
  onSave: (draft: ExpenseDraft) => void
  onDelete: () => void
}

export function ExpenseModal({ draft, withDate, docCurrency, rates, onCancel, onSave, onDelete }: Props) {
  const [name, setName] = useState(draft?.name ?? '')
  const [amountText, setAmountText] = useState(draft ? String(draft.amount) : '')
  const [currency, setCurrency] = useState<CurrencyCode>(draft?.currency ?? docCurrency)
  const [date, setDate] = useState(draft?.date ?? '')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const amount = parseFloat(amountText.replace(',', '.'))
  const amountOk = Number.isFinite(amount) && amount > 0

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return setError('Напиши название')
    if (!amountOk) return setError('Сумма должна быть больше нуля')
    onSave({
      name: trimmed.slice(0, MAX_EXPENSE_NAME),
      amount,
      currency,
      date: withDate ? date : '',
    })
  }

  return (
    <Modal
      title={draft ? 'Расход' : withDate ? 'Запланированный расход' : 'Обязательный расход'}
      width={440}
      onClose={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          {draft &&
            (confirmDelete ? (
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
            ))}
          <div style={{ flex: 1 }} />
          <button style={btnGhost} onClick={onCancel}>
            Отмена
          </button>
          <button className="h-accent" style={btnAccent} onClick={submit}>
            Сохранить
          </button>
        </div>
      }
    >
      <div style={{ marginTop: 12 }}>
        <div style={fieldLabel}>Название</div>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          autoFocus
          maxLength={MAX_EXPENSE_NAME}
          placeholder={withDate ? 'Подписка Claude' : 'Аренда'}
          style={input}
        />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Сумма</div>
        <input
          value={amountText}
          onChange={(e) => {
            setAmountText(e.target.value)
            setError('')
          }}
          inputMode="decimal"
          placeholder="120"
          style={input}
        />
      </div>

      <div style={{ marginTop: 13 }}>
        <div style={fieldLabel}>Валюта этого расхода</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 6 }}>
          {CURRENCIES.map((c) => (
            <button key={c.code} style={chipBtn(currency === c.code, '#fbbf24')} onClick={() => setCurrency(c.code)}>
              {c.symbol}
            </button>
          ))}
        </div>
        {amountOk && (
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 7, lineHeight: 1.5 }}>
            ≈ {inOtherCurrencies(amount, currency, rates).join(' · ')}
          </div>
        )}
      </div>

      {withDate && (
        <div style={{ marginTop: 13 }}>
          <div style={fieldLabel}>
            Дата <span style={{ color: C.faint }}>— необязательно</span>
          </div>
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            type="date"
            style={{ ...input, padding: '8px 11px' }}
          />
          <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>
            без даты расход не попадёт в дневной лимит
          </div>
        </div>
      )}

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
