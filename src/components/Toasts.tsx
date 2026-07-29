import { useToastMessage } from '../state/ToastProvider'

const style: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 22,
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
}

export function Toasts() {
  const message = useToastMessage()
  if (!message) return null
  return (
    <div style={style} role="status">
      {message}
    </div>
  )
}
