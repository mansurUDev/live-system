import { Modal } from './Modal'
import { MoneyField } from '../finance/MoneyField'
import { CURRENCIES, PREMIUM_STYLES } from '../../constants'
import { useData } from '../../state/DataProvider'
import { A } from '../../state/actions'
import { btnGhost, C, chipBtn, fieldLabel } from '../../theme'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useData()
  const { currency, rates, hideWatch, premiumStyle } = state.doc

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
        <div style={fieldLabel}>Вкладка «Смотреть»</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 6 }}>
          <button
            style={chipBtn(!hideWatch, '#22d3ee')}
            onClick={() => dispatch(A.patchDoc({ hideWatch: false }))}
          >
            показывать
          </button>
          <button
            style={chipBtn(hideWatch, '#22d3ee')}
            onClick={() => dispatch(A.patchDoc({ hideWatch: true }))}
          >
            прятать
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 7, lineHeight: 1.5 }}>
          Полка с фильмами спрятана по умолчанию: её не видно ни в панели, ни в меню. Открыть —
          нажатием на точку слева от заголовка «Система жизни», а на большом экране ещё и на слово
          «баланса» под ним. Книг и учёбы (курсы, видео) это не затрагивает: они видны всегда.
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={fieldLabel}>Обводка «В первую очередь»</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 6 }}>
          {PREMIUM_STYLES.map((p) => (
            <button
              key={p.id}
              style={chipBtn(premiumStyle === p.id, p.a)}
              onClick={() => dispatch(A.patchDoc({ premiumStyle: p.id }))}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 7, lineHeight: 1.5 }}>
          Рамка карточек «Смотреть», у которых «хочу: 10». Цвет чипа — сам стиль.
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={fieldLabel}>Курсы валют — сколько стоит одна единица</div>
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
        У валюты-основы курс 1, у остальных — её цена в этой основе. Скажем, при основе в сумах
        доллару ставится 12500. По этим курсам расходы в чужой валюте сводятся к валюте
        отображения в дневном лимите и итогах.
        <br />
        <br />
        Суммы «на руках», планка дохода и запас хранятся прямо в валюте отображения и при её
        смене не пересчитываются — поправь их вручную. Денежные цели на колесе тоже живут
        каждая в своей валюте и курсов не касаются.
      </div>
    </Modal>
  )
}
