import { useState } from 'react'
import { Modal } from './Modal'
import { useChangeCode } from '../../hooks/useChangeCode'
import { useToast } from '../../state/ToastProvider'
import { btnAccent, btnGhost, C, errText, fieldLabel, input, MONO } from '../../theme'

export function ChangeCodeModal({ onClose }: { onClose: () => void }) {
  const changeCode = useChangeCode()
  const toast = useToast()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setError('')

    const res = await changeCode(value)
    if (!res.ok) {
      setError(res.error)
      setBusy(false)
      return
    }

    toast(res.cloud ? 'Код сменён — данные переехали' : 'Код сменён')
    onClose()
  }

  return (
    <Modal
      title="Сменить код"
      width={420}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnGhost} onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button
            className="h-accent"
            style={{ ...btnAccent, ...(busy ? { opacity: 0.6, cursor: 'default' } : null) }}
            onClick={submit}
            disabled={busy}
          >
            {busy ? 'Переношу…' : 'Сменить'}
          </button>
        </div>
      }
    >
      <div style={{ marginTop: 12, fontSize: 14, color: C.textSoft, lineHeight: 1.5 }}>
        Все записи переедут под новый код. Прежний перестанет открывать их — ни на этом
        устройстве, ни на других.
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={fieldLabel}>Новый код</div>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
          autoFocus
          maxLength={40}
          placeholder="что-нибудь, что помнишь только ты"
          style={{ ...input, fontFamily: MONO, letterSpacing: '1px' }}
        />
      </div>

      <div style={{ fontSize: 12.5, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
        Запомни его: восстановить нечем — кода нет ни у кого, кроме тебя. Перед сменой
        имеет смысл выгрузить копию через «Экспорт в JSON».
      </div>

      {error && <div style={errText}>{error}</div>}
    </Modal>
  )
}
