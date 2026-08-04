import { Modal } from './Modal'
import { MoneyField } from '../finance/MoneyField'
import { CURRENCIES } from '../../constants'
import { useData } from '../../state/DataProvider'
import { A } from '../../state/actions'
import { btnGhost, C, chipBtn, fieldLabel } from '../../theme'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useData()
  const { currency, rates } = state.doc

  return (
    <Modal
      title="Настройки"
      width={420}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnGhost} onClick={onClose}>
            Готово
          </button>
        </div>
      }
    >
      <div style={{ marginTop: 12 }}>
        <div style={fieldLabel}>Валюта отображения</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 6 }}>
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              style={chipBtn(currency === c.code, '#fbbf24')}
              onClick={() => dispatch(A.patchDoc({ currency: c.code }))}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={fieldLabel}>Курсы валют — вводятся вручную</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {CURRENCIES.map((c) => (
            <MoneyField
              key={c.code}
              label={c.label + ' (' + c.symbol + ')'}
              value={rates[c.code]}
              onChange={(v) => dispatch(A.patchDoc({ rates: { ...rates, [c.code]: v || 1 } }))}
              placeholder="1"
            />
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: C.faint, marginTop: 14, lineHeight: 1.5 }}>
        Курсы — только справочная информация: числа во «Финансах» и на денежных целях не
        пересчитываются при смене валюты или курса. Уже введённые суммы просто начинают
        показываться с новым символом — поправь их вручную, если это важно.
      </div>
    </Modal>
  )
}
