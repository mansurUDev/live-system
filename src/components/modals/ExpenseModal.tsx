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

/** Общая форма обоих видов расхода: у запланированного дата, у обязательного день месяца */
export interface ExpenseDraft {
  name: string
  amount: number
  currency: CurrencyCode
  /** YYYY-MM-DD; у обязательных всегда пустая */
  date: string
  /** число месяца списания у обязательного: 1–31, 0 — не задано; у разовых всегда 0 */
  day: number
}

interface Props {
  /** null — создаём новый */
  draft: ExpenseDraft | null
  /** заготовка для нового: например название приходит из перенесённой идеи */
  prefill?: Partial<ExpenseDraft>
  /** у запланированных спрашиваем дату, у обязательных её нет */
  withDate: boolean
  docCurrency: CurrencyCode
  rates: Rates
  onCancel: () => void
  onSave: (draft: ExpenseDraft) => void
  /** только у существующего расхода — новый удалять нечего */
  onDelete?: () => void
}

export function ExpenseModal({ draft, prefill, withDate, docCurrency, rates, onCancel, onSave, onDelete }: Props) {
  const [name, setName] = useState(draft?.name ?? prefill?.name ?? '')
  const [amountText, setAmountText] = useState(draft ? String(draft.amount) : '')
  const [currency, setCurrency] = useState<CurrencyCode>(draft?.currency ?? prefill?.currency ?? docCurrency)
  const [date, setDate] = useState(draft?.date ?? prefill?.date ?? '')
  const [dayText, setDayText] = useState(draft?.day ? String(draft.day) : '')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const amount = parseFloat(amountText.replace(/\s/g, '').replace(',', '.'))
  const amountOk = Number.isFinite(amount) && amount > 0

  // строго цифры: parseInt проглатывал бы «14 числа» и «3.9», молча сохраняя не то
  const dayRaw = dayText.trim()
  const day = /^\d{1,2}$/.test(dayRaw) ? Number(dayRaw) : NaN
  const dayOk = !dayRaw || (day >= 1 && day <= 31)

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return setError('Напиши название')
    if (!amountOk) return setError('Сумма должна быть больше нуля')
    if (!dayOk) return setError('День месяца — число от 1 до 31')
    onSave({
      name: trimmed.slice(0, MAX_EXPENSE_NAME),
      amount,
      currency,
      date: withDate ? date : '',
      day: !withDate && day >= 1 && day <= 31 ? day : 0,
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
            onDelete &&
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

      {!withDate && (
        <div style={{ marginTop: 13 }}>
          <div style={fieldLabel}>
            Списывается <span style={{ color: C.faint }}>— число месяца, необязательно</span>
          </div>
          <input
            value={dayText}
            onChange={(e) => {
              setDayText(e.target.value)
              setError('')
            }}
            inputMode="numeric"
            placeholder="14"
            aria-label="Число месяца, когда списывается"
            style={{ ...input, width: 90 }}
          />
          <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>
            попадёт в сводку на 30 дней — увидишь заранее, а не по факту списания
          </div>
        </div>
      )}

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
