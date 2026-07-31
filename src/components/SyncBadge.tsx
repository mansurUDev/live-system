import type { CSSProperties } from 'react'
import { C } from '../theme'
import type { SyncState } from '../state/useCloudSync'

const VIEW: Record<SyncState, { color: string; label: string; hint: string }> = {
  off: {
    color: '#64748b',
    label: 'Только здесь',
    hint: 'Облако не подключено — данные живут только на этом устройстве',
  },
  idle: {
    color: '#34d399',
    label: 'В облаке',
    hint: 'Данные синхронизированы — доступны с любого устройства по этому коду',
  },
  saving: {
    color: '#22d3ee',
    label: 'Сохраняю…',
    hint: 'Отправляю изменения в облако',
  },
  error: {
    color: '#f87171',
    label: 'Не сохранилось',
    hint: 'Облако ответило ошибкой — данные пока только на этом устройстве',
  },
}

/**
 * Состояние синхронизации.
 *
 * Без него невозможно понять, почему на втором устройстве пусто: приложение
 * работает одинаково и с облаком, и без него, а разница видна только тут.
 */
export function SyncBadge({ state, compact }: { state: SyncState; compact?: boolean }) {
  const v = VIEW[state]

  return (
    <span title={v.hint} style={wrap(compact)}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: v.color,
          boxShadow: `0 0 8px ${v.color}`,
          flex: 'none',
          ...(state === 'saving' ? { animation: 'blink 1.2s ease-in-out infinite' } : null),
        }}
      />
      {v.label}
    </span>
  )
}

function wrap(compact?: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: compact ? 12.5 : 13,
    color: C.muted,
    background: 'rgba(148,163,184,.07)',
    border: '1px solid rgba(148,163,184,.2)',
    borderRadius: 9,
    padding: compact ? '5px 9px' : '7px 11px',
    whiteSpace: 'nowrap',
    cursor: 'default',
  }
}
