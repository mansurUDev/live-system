import { describe, expect, it } from 'vitest'
import { moveIdeaTo, toggleIdeaPin } from './ideaOrder'
import type { Idea } from '../types'

function idea(id: string, category = 'Разное', pinned?: true): Idea {
  return {
    id,
    title: id,
    category,
    text: '',
    links: [],
    images: [],
    checklist: [],
    done: false,
    ...(pinned ? { pinned } : null),
    createdAt: '2026-08-20T10:00:00.000Z',
  }
}

const ids = (list: Idea[]) => list.map((x) => x.id)
const ALL = ['a', 'b', 'c', 'd']

describe('moveIdeaTo — без фильтра', () => {
  const list = [idea('a'), idea('b'), idea('c'), idea('d')]

  it('вверх', () => {
    expect(ids(moveIdeaTo(list, ALL, 'c', 0))).toEqual(['c', 'a', 'b', 'd'])
  })

  it('вниз', () => {
    expect(ids(moveIdeaTo(list, ALL, 'a', 2))).toEqual(['b', 'c', 'a', 'd'])
  })

  it('в самый низ', () => {
    expect(ids(moveIdeaTo(list, ALL, 'a', 99))).toEqual(['b', 'c', 'd', 'a'])
  })

  it('на своё же место — массив не пересобирается', () => {
    expect(moveIdeaTo(list, ALL, 'b', 1)).toBe(list)
  })

  it('неизвестный id ничего не меняет', () => {
    expect(moveIdeaTo(list, ALL, 'zzz', 0)).toBe(list)
  })
})

describe('moveIdeaTo — список отфильтрован по категории', () => {
  // порядок массива: a(A) x(B) b(A) y(B) c(A)
  const list = [idea('a', 'A'), idea('x', 'B'), idea('b', 'A'), idea('y', 'B'), idea('c', 'A')]
  const scopeA = ['a', 'b', 'c']

  it('перестановка внутри категории не двигает чужие идеи с их мест', () => {
    // видимые A занимают позиции 0, 2, 4 — они и должны остаться позициями A
    const out = moveIdeaTo(list, scopeA, 'c', 0)
    expect(ids(out)).toEqual(['c', 'x', 'a', 'y', 'b'])
    // скрытые B остались ровно на своих местах
    expect(out[1]!.id).toBe('x')
    expect(out[3]!.id).toBe('y')
  })

  it('индекс считается среди видимых, а не всего массива', () => {
    const out = moveIdeaTo(list, scopeA, 'a', 2)
    expect(ids(out)).toEqual(['b', 'x', 'c', 'y', 'a'])
  })
})

describe('toggleIdeaPin', () => {
  const list = [idea('a'), idea('b'), idea('c')]

  it('звезда поднимает идею наверх и ставит флаг', () => {
    const out = toggleIdeaPin(list, 'c')
    expect(ids(out)).toEqual(['c', 'a', 'b'])
    expect(out[0]!.pinned).toBe(true)
  })

  it('снятие звезды не двигает карточку и убирает поле совсем', () => {
    const pinned = toggleIdeaPin(list, 'c')
    const out = toggleIdeaPin(pinned, 'c')
    expect(ids(out)).toEqual(['c', 'a', 'b'])
    expect('pinned' in out[0]!).toBe(false)
  })

  it('неизвестный id ничего не меняет', () => {
    expect(toggleIdeaPin(list, 'zzz')).toBe(list)
  })
})
