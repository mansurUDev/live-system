import { useState } from 'react'
import { btnAccent, C, input, MONO } from '../theme'
import { useAuth } from '../state/AuthProvider'

export function LoginScreen() {
  const { login } = useAuth()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    if (!value.trim()) {
      setError('Введи код — любое слово или число')
      return
    }
    login(value)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(5,9,18,.9)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        animation: 'fadeSwap .18s ease',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(165deg, rgba(24,34,60,.95), rgba(11,17,33,.98))',
          border: '1px solid rgba(110,160,255,.25)',
          borderRadius: 18,
          boxShadow: '0 24px 70px rgba(0,0,0,.6), 0 0 30px rgba(34,211,238,.08)',
          padding: '28px 24px',
          width: 'min(380px, 100%)',
          boxSizing: 'border-box',
          textAlign: 'center',
          animation: 'popIn .25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: C.cyan,
              boxShadow: '0 0 12px #22d3ee',
              animation: 'blink 2.4s ease-in-out infinite',
            }}
          />
          <h1
            style={{
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: C.textHead,
              textShadow: '0 0 20px rgba(34,211,238,.5)',
              margin: 0,
            }}
          >
            Система жизни
          </h1>
        </div>

        <div style={{ marginTop: 22, textAlign: 'left' }}>
          <div style={{ fontSize: 13, color: C.muted }}>Код доступа</div>
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            autoFocus
            maxLength={40}
            // Без примера: подсказка в поле работала бы готовым ключом к чужим данным
            placeholder="слово или число"
            style={{ ...input, fontFamily: MONO, letterSpacing: '1px' }}
          />
        </div>

        {error && <div style={{ color: C.dangerText, fontSize: 13.5, marginTop: 10, textAlign: 'left' }}>{error}</div>}

        <button className="h-accent" style={{ ...btnAccent, width: '100%', marginTop: 16, padding: '11px 17px' }} onClick={submit}>
          Войти
        </button>

        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 14, lineHeight: 1.5 }}>
          Личный код — чтобы данные не смешивались, если приложением пользуется кто-то ещё.
          Придумай любой и запомни: под ним лежат твои записи.
        </div>
      </div>
    </div>
  )
}
