import { pct } from './pct'
import type { Doc, Sector } from '../types'

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
    steps: [],
    history: [],
    celebrated: false,
    cat: null,
    ...seed,
    createdAt,
  }
  s.history = [
    {
      d: createdAt,
      p: pct(s),
      label: 'начало',
      ...(s.kind === 'number' ? { v: s.current } : null),
    },
  ]
  return s
}

const CAR_STEPS = [
  'Найти кузов',
  'Купить двигатель',
  'Перебрать двигатель',
  'Коробка передач',
  'Подвеска',
  'Тормоза',
  'Электрика',
  'Салон',
  'Покраска',
  'Техосмотр',
]

/** Стартовое наполнение — то же, что показывает дизайн-мок */
export function defaultDoc(now: number = Date.now()): Doc {
  return {
    v: 1,
    sectors: [
      makeSector({ id: 's1', name: 'Здоровье', color: '#34d399', kind: 'sphere', value: 7, cat: 'health' }, now),
      makeSector({ id: 's2', name: 'Карьера', color: '#22d3ee', kind: 'sphere', value: 8, cat: 'work' }, now),
      makeSector({ id: 's3', name: 'Отношения', color: '#f472b6', kind: 'sphere', value: 6 }, now),
      makeSector({ id: 's4', name: 'Семья', color: '#f87171', kind: 'sphere', value: 8 }, now),
      makeSector({ id: 's5', name: 'Саморазвитие', color: '#a78bfa', kind: 'sphere', value: 5 }, now),
      makeSector({ id: 's6', name: 'Отдых', color: '#2dd4bf', kind: 'sphere', value: 4, cat: 'rest' }, now),
      makeSector(
        { id: 's7', name: 'Накопить 1000 $', color: '#fbbf24', kind: 'number', target: 1000, unit: '$', current: 350 },
        now,
      ),
      makeSector(
        {
          id: 's8',
          name: 'Собрать машину',
          color: '#fb923c',
          kind: 'steps',
          steps: CAR_STEPS.map((text, i) => ({ id: 't' + (i + 1), text, done: i < 3 })),
        },
        now,
      ),
    ],
    acts: [
      { id: 'a1', name: 'Проснулся', color: '#fbbf24', cat: 'byt' },
      { id: 'a2', name: 'Умылся', color: '#2dd4bf', cat: 'byt' },
      { id: 'a3', name: 'Дорога', color: '#94a3b8', cat: 'byt' },
      { id: 'a4', name: 'Работа', color: '#22d3ee', cat: 'work' },
      { id: 'a5', name: 'Еда', color: '#fb923c', cat: 'byt' },
      { id: 'a6', name: 'Спорт', color: '#34d399', cat: 'health' },
      { id: 'a7', name: 'Отдых', color: '#a78bfa', cat: 'rest' },
      { id: 'a8', name: 'Учёба', color: '#f472b6', cat: 'work' },
      { id: 'a9', name: 'Сон', color: '#818cf8', cat: 'sleep' },
    ],
    entries: [],
    archive: [],
    snapshots: {},
  }
}
