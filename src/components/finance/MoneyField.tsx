import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { CURRENCIES } from '../../constants'
import { convert, currencySymbol, humanMoney, money, roundMoney } from '../../logic/currency'
import { num } from '../../logic/time'
import { C, input } from '../../theme'
import type { CurrencyCode, Rates } from '../../types'

interface Props {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  hint?: string
  label?: string
  big?: boolean
  /** валюта хранения — в ней лежит value и в неё пересчитывается введённое */
  currency?: CurrencyCode
  rates?: Rates
}

/**
 * Поле для суммы.
 *
 * Держит собственный черновик, пока идёт набор: иначе «1000» на середине ввода
 * превращалось бы в «1» и правило хранилища тут же возвращало бы его в поле.
 * В хранилище уходит только разобранное число.
 *
 * Если передать `currency` и `rates`, под полем появляется выбор валюты ввода.
 * Хранится сумма всё равно в валюте отображения — иначе планка, остаток и запас
 * перестали бы складываться между собой, — но вводить можно в той, в которой
 * деньги пришли: зарплата в долларах, аренда в сумах.
 *
 * Переключение валюты — только смена взгляда: показанное число берётся из
 * сохранённой суммы, а не пересчитывается из того, что видно в поле. Иначе круг
 * «сум → доллары → сум» возвращал бы другое число (показ округляется), и поле
 * начинало бы расходиться с документом, ничего об этом не сообщая.
 */
export function MoneyField({ value, onChange, placeholder, hint, label, big, currency, rates }: Props) {
  const withPicker = !!currency && !!rates
  const [pick, setPick] = useState<CurrencyCode>(currency ?? 'UZS')

  // валюту документа можно сменить в настройках, не уходя со вкладки: поле
  // остаётся смонтированным, и без этой сверки ввод продолжал бы считаться в
  // прежней валюте, молча деля сумму на курс
  useEffect(() => {
    if (currency) setPick(currency)
  }, [currency])

  /** сохранённая сумма, показанная в валюте ввода */
  const toPick = (v: number) =>
    !currency || !rates || pick === currency ? v : roundMoney(convert(v, currency, pick, rates))

  /** введённое — обратно в валюту хранения; пересчитанное округляем, чтобы подпись не врала */
  const toStore = (v: number) =>
    !currency || !rates || pick === currency ? v : roundMoney(convert(v, pick, currency, rates))

  const [draft, setDraft] = useState(() => (value ? String(toPick(value)) : ''))

  // Значение могло измениться снаружи — приехать из облака, из соседней вкладки
  // или от «Оплачено». Переписываем черновик, только если он больше не
  // соответствует сохранённому: иначе набор затирался бы на полуслове.
  //
  // Допуск нужен лишь когда валюта ввода чужая: показ округляется, и обратный
  // пересчёт не обязан совпасть до последней доли. В своей валюте сравнение
  // точное — поле используется и для курсов, где 0,00008 меньше любого допуска.
  useEffect(() => {
    const tolerance = !currency || !rates || pick === currency ? 0 : Math.abs(toStore(0.005))
    setDraft((d) => {
      const n = parse(d)
      if (n !== null && Math.abs(toStore(n) - value) <= tolerance) return d
      return value ? String(toPick(value)) : ''
    })
    // toPick/toStore выводятся из currency, rates и pick — они в списке
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, pick, currency, rates])

  const style: CSSProperties = big
    ? { ...input, fontSize: 22, fontWeight: 600, padding: '12px 13px' }
    : input

  const parsed = parse(draft)
  const foreign = withPicker && !!currency && pick !== currency
  // «2300000» не читается с ходу — сколько там нулей, приходится считать по
  // три с конца; вслух это «2,3 млн», и ровно так подписываем, пока набирают
  const human = parsed !== null ? humanMoney(parsed) : ''

  return (
    <div>
      {label && <div style={{ fontSize: 13, color: C.muted }}>{label}</div>}
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = parse(e.target.value)
          if (n !== null) onChange(toStore(n))
        }}
        onBlur={() => {
          // разряды видно только когда не редактируешь — во время набора
          // пробелы прыгали бы за курсором и мешали печатать
          const n = parse(draft)
          if (n !== null && Math.abs(n) >= 1000) setDraft(num(n))
        }}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        style={style}
      />

      {withPicker && human && (
        <div style={{ fontSize: 12.5, color: '#fbbf24', marginTop: 4 }}>
          = {human} {currencySymbol(pick)}
        </div>
      )}

      {withPicker && (
        <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setPick(c.code)}
              aria-label={'Вводить в ' + c.code}
              style={{
                fontFamily: 'inherit',
                fontSize: 12,
                lineHeight: 1,
                padding: '4px 8px',
                borderRadius: 7,
                cursor: 'pointer',
                color: pick === c.code ? '#eaf6ff' : C.faint,
                border: `1px solid ${pick === c.code ? 'rgba(251,191,36,.55)' : 'rgba(148,163,184,.22)'}`,
                background: pick === c.code ? 'rgba(251,191,36,.14)' : 'rgba(148,163,184,.05)',
              }}
            >
              {c.symbol}
            </button>
          ))}
        </div>
      )}

      {foreign && currency && (
        <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>
          запишется {money(parsed === null ? value : toStore(parsed), currency)}
          {(() => {
            const stored = humanMoney(parsed === null ? value : toStore(parsed))
            return stored ? ` (${stored})` : ''
          })()}
        </div>
      )}
      {hint && <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function parse(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.')
  if (!t) return 0
  const v = parseFloat(t)
  return Number.isFinite(v) && v >= 0 ? v : null
}
