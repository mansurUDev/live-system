import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { makeSector } from '../logic/defaults'
import { useIsMobile } from '../hooks/useIsMobile'
import { btnAccent, C, MONO } from '../theme'
import { askInstallHelp } from './InstallPrompt'
import { WheelSvg } from './wheel/WheelSvg'

const MODULES: { name: string; color: string; text: string }[] = [
  { name: 'Брифинг', color: '#22d3ee', text: 'Одна карточка на день: что сейчас важнее всего' },
  { name: 'Колесо', color: '#a78bfa', text: 'Сферы жизни с оценкой и измеримые цели с прогрессом' },
  { name: 'Трекер времени', color: '#60a5fa', text: 'Кнопки-активности — куда на самом деле уходит день' },
  { name: 'Привычки', color: '#34d399', text: '«Делаю каждый день» и «держусь без» — с сериями и рекордами' },
  { name: 'Финансы', color: '#fbbf24', text: 'Доход, обязательные и разовые расходы, дневной лимит трат' },
  { name: 'Книги', color: '#f472b6', text: 'Страница и минута аудио, срок «дочитать к» и заметки по ходу' },
  { name: 'Учёба', color: '#f87171', text: 'Курсы разделами-чек-листом и очередь видео на посмотреть' },
  { name: 'Идеи', color: '#fbbf24', text: 'Заметки, фото и ссылки для будущих проектов — в одном месте' },
  { name: 'Аналитика', color: '#2dd4bf', text: 'Графики и подсказки на основе твоих же данных' },
  { name: 'Архив', color: '#fb923c', text: 'Завершённые цели остаются с историей, а не исчезают' },
]

const DEMO_SEED = [
  { id: 'd1', name: 'Здоровье', color: '#34d399', kind: 'sphere' as const, value: 7 },
  { id: 'd2', name: 'Работа', color: '#22d3ee', kind: 'sphere' as const, value: 6 },
  { id: 'd3', name: 'Накопить 1000 $', color: '#fbbf24', kind: 'number' as const, current: 350, target: 1000, unit: 'USD', isMoney: true },
  { id: 'd4', name: 'Отдых', color: '#a78bfa', kind: 'sphere' as const, value: 5 },
]

function heroStyle(mobile: boolean): CSSProperties {
  return {
    maxWidth: 1220,
    margin: '0 auto',
    padding: mobile ? '28px 18px 10px' : '54px 24px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }
}

export function LandingScreen({ onEnter }: { onEnter: () => void }) {
  const isMobile = useIsMobile()
  const demoSectors = useMemo(() => DEMO_SEED.map((seed) => makeSector(seed, Date.now())), [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        zIndex: 100,
        background: C.bg,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        animation: 'fadeSwap .18s ease',
      }}
    >
      <div style={gridLayer} />
      <div style={glowLayer} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={heroStyle(isMobile)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                fontSize: isMobile ? 20 : 30,
                fontWeight: 700,
                letterSpacing: isMobile ? '2px' : '5px',
                textTransform: 'uppercase',
                color: C.textHead,
                textShadow: '0 0 20px rgba(34,211,238,.5)',
                margin: 0,
              }}
            >
              Система жизни
            </h1>
          </div>

          <div style={{ fontSize: isMobile ? 14.5 : 17, color: C.textSoft, marginTop: 14, maxWidth: 560, lineHeight: 1.5 }}>
            Личный командный центр баланса и целей — сферы жизни, время, привычки, финансы и
            прогресс в одном месте. Без чужих аккаунтов и облачных сервисов, если они тебе не
            нужны.
          </div>

          <div
            style={{
              marginTop: isMobile ? 22 : 32,
              width: '100%',
              maxWidth: 420,
              animation: 'heroBreathe 6s ease-in-out infinite',
            }}
          >
            <WheelSvg sectors={demoSectors} selectedId={null} onSelect={() => {}} />
          </div>

          <button
            className="h-accent"
            style={{ ...btnAccent, marginTop: isMobile ? 22 : 30, padding: '13px 34px', fontSize: 15.5 }}
            onClick={onEnter}
          >
            Войти
          </button>

          {/* Установка приложения: панель всплывает и сама, но её могли закрыть
              или браузер мог не подать сигнала — здесь она доступна всегда */}
          <button
            onClick={askInstallHelp}
            style={{
              marginTop: 12,
              background: 'none',
              border: 'none',
              padding: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13.5,
              color: C.cyanBright,
              textDecoration: 'underline dotted',
            }}
          >
            Установить на телефон
          </button>
        </div>

        <div
          style={{
            maxWidth: 1220,
            margin: '0 auto',
            padding: isMobile ? '18px 18px 10px' : '30px 24px 10px',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {MODULES.map((m, i) => (
            <div
              key={m.name}
              style={{
                background: 'linear-gradient(165deg, rgba(22,32,58,.72), rgba(10,16,32,.88))',
                border: '1px solid rgba(110,160,255,.14)',
                borderRadius: 16,
                padding: '16px 18px',
                animation: `cardRise .5s ease both`,
                animationDelay: `${i * 60}ms`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: m.color,
                    boxShadow: `0 0 8px ${m.color}88`,
                    flex: 'none',
                  }}
                />
                <span style={{ fontSize: 15.5, fontWeight: 600, color: C.textBright }}>{m.name}</span>
              </div>
              <div style={{ fontSize: 13.5, color: C.muted, marginTop: 7, lineHeight: 1.5 }}>{m.text}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            maxWidth: 700,
            margin: '0 auto',
            padding: isMobile ? '24px 18px 40px' : '34px 24px 56px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 13, color: C.faint, lineHeight: 1.6 }}>
            Заходишь по личному коду — просто слово или число, которое запоминаешь сам. Он не
            для защиты, а чтобы данные разных людей на одном устройстве не смешивались.
          </div>
          <button
            className="h-accent"
            style={{ ...btnAccent, marginTop: 18, padding: '12px 30px', fontSize: 15, fontFamily: MONO }}
            onClick={onEnter}
          >
            Войти
          </button>
        </div>
      </div>
    </div>
  )
}

const gridLayer: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  backgroundImage:
    'linear-gradient(rgba(80,140,255,.05) 1px, transparent 1px),linear-gradient(90deg, rgba(80,140,255,.05) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
}

const glowLayer: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  background:
    'radial-gradient(90% 55% at 50% -5%, rgba(34,211,238,.10), transparent 60%),radial-gradient(120% 90% at 50% 115%, rgba(96,70,190,.13), transparent 60%)',
}
