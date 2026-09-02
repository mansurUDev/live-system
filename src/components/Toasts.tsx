import { useToastMessage } from '../state/ToastProvider'

const style: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  // --toast-bottom ставит HotDock трекера: тост встаёт над доком, иначе 22px
  bottom: 'calc(var(--toast-bottom, 22px) + env(safe-area-inset-bottom))',
  transform: 'translateX(-50%)',
  zIndex: 97,
  background: 'rgba(14,22,40,.94)',
  border: '1px solid rgba(94,234,255,.4)',
  boxShadow: '0 0 18px rgba(34,211,238,.25)',
  borderRadius: 12,
  padding: '10px 18px',
  fontSize: 14,
  color: '#dbeafe',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  maxWidth: 'calc(100vw - 40px)',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
}

const actionStyle: React.CSSProperties = {
  flex: 'none',
  minHeight: 40,
  padding: '0 12px',
  margin: '-8px -8px -8px 0',
  border: 'none',
  background: 'none',
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: 600,
  color: '#8ff4ff',
  cursor: 'pointer',
}

export function Toasts() {
  const value = useToastMessage()
  if (!value) return null

  return (
    <div style={style} role="status">
      <span style={{ minWidth: 0 }}>{value.message}</span>
      {value.action && (
        <button style={actionStyle} onClick={value.action.onClick}>
          {value.action.label}
        </button>
      )}
    </div>
  )
}
