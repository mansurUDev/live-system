import { CURRENCY_CODES, DEFAULT_CURRENCY, DEFAULT_QUICK_AMOUNTS } from '../constants'
import { emptyFinance, emptyLibrary } from './normalizeModules'
import { pct } from './pct'
import { uid } from './uid'
import { DOC_VERSION } from '../types'
import type { CurrencyCode, Doc, Sector } from '../types'

type SectorSeed = Pick<Sector, 'id' | 'name' | 'color' | 'kind'> & Partial<Sector>

/**
 * Собирает сектор с нулевой историей. Значение `v` в истории заводится только
 * для числовых целей — по нему потом считается темп.
 */
export function makeSector(seed: SectorSeed, now: number): Sector {
  const createdAt = seed.createdAt ?? new Date(now).toISOString()
  const s: Sector = {
    value: 5,
    current: 0,
    target: 0,
    unit: '',
    isMoney: false,
    quickAmounts: DEFAULT_QUICK_AMOUNTS,
    steps: [],
    history: [],
    celebrated: false,
    cat: null,
    ...seed,
    createdAt,
  }
  s.history = [
    {
      id: uid('hr'),
      d: createdAt,
      p: pct(s),
      label: 'начало',
      ...(s.kind === 'number' ? { v: s.current } : null),
    },
  ]
  return s
}

/** Курс 1 по каждой валюте — нейтральная заглушка до первого визита в настройки */
function neutralRates(): Record<CurrencyCode, number> {
  const out = {} as Record<CurrencyCode, number>
  for (const code of CURRENCY_CODES) out[code] = 1
  return out
}

/**
 * Стартовое наполнение первого запуска.
 *
 * Намеренно всего два пункта, зато разного вида: измеримая цель и сфера с
 * оценкой. Так сразу видно оба способа вести колесо, и при этом чистый экран
 * не приходится разгребать от чужих примеров.
 */
export function defaultDoc(now: number = Date.now()): Doc {
  return {
    v: DOC_VERSION,
    currency: DEFAULT_CURRENCY,
    rates: neutralRates(),
    hideWatch: true,
    sectors: [
      makeSector(
        { id: 's1', name: 'Накопить 1000 $', color: '#fbbf24', kind: 'number', target: 1000, unit: '$', current: 0 },
        now,
      ),
      makeSector({ id: 's2', name: 'Саморазвитие', color: '#a78bfa', kind: 'sphere', value: 5 }, now),
    ],
    acts: [
      { id: 'a1', name: 'Проснулся', color: '#fbbf24', cat: 'byt' },
      { id: 'a2', name: 'Гигиена', color: '#2dd4bf', cat: 'byt' },
      // Направление вместо безликой «Дороги»: приехав, понятно, что нажать.
      { id: 'a3', name: 'На работу', color: '#94a3b8', cat: 'byt' },
      { id: 'a4', name: 'Работа', color: '#22d3ee', cat: 'work' },
      { id: 'a5', name: 'Еда', color: '#fb923c', cat: 'byt' },
      { id: 'a6', name: 'Спорт', color: '#34d399', cat: 'health' },
      { id: 'a7', name: 'Домой', color: '#60a5fa', cat: 'byt' },
      { id: 'a8', name: 'Дома', color: '#a78bfa', cat: 'rest' },
      { id: 'a9', name: 'Учёба', color: '#f472b6', cat: 'work' },
      { id: 'a10', name: 'Сон', color: '#818cf8', cat: 'sleep' },
    ],
    entries: [],
    archive: [],
    snapshots: {},
    habits: [],
    reminders: [],
    ideas: [],
    fin: emptyFinance(now),
    lib: emptyLibrary(),
  }
}
