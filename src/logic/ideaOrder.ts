import type { Idea } from '../types'

/**
 * Порядок идей — это приоритет, и задаёт его человек: перетаскиванием и
 * звездой. Никакой автоматической сортировки нет, порядок массива и есть
 * порядок на экране, поэтому карточка после перетаскивания остаётся ровно
 * там, куда её положили.
 */

/**
 * Перенос идеи на позицию `index` внутри видимого набора `scope`.
 *
 * Список бывает отфильтрован по категории, а хранится он одним массивом.
 * Скрытые идеи не должны переезжать из-за чужой перестановки, поэтому
 * переставляются только те позиции массива, которые заняты видимыми: их
 * места сохраняются, а по местам раскладывается новый порядок видимых.
 */
export function moveIdeaTo(ideas: Idea[], scope: readonly string[], id: string, index: number): Idea[] {
  const inScope = new Set(scope)
  // позиции в массиве, занятые видимыми идеями, в порядке самого массива
  const slots: number[] = []
  for (let i = 0; i < ideas.length; i++) if (inScope.has(ideas[i]!.id)) slots.push(i)

  const visible = slots.map((i) => ideas[i]!)
  const from = visible.findIndex((x) => x.id === id)
  if (from === -1) return ideas

  const to = Math.max(0, Math.min(index, visible.length - 1))
  if (to === from) return ideas

  const reordered = visible.toSpliced(from, 1).toSpliced(to, 0, visible[from]!)

  const out = [...ideas]
  slots.forEach((pos, k) => {
    out[pos] = reordered[k]!
  })
  return out
}

/**
 * Звезда: отмечает приоритет и поднимает идею наверх — ровно то, чего от неё
 * ждут. Снятие звезды карточку не двигает: она уже там, где человек привык её
 * видеть, и прыжок вниз был бы неожиданностью.
 */
export function toggleIdeaPin(ideas: Idea[], id: string): Idea[] {
  const from = ideas.findIndex((x) => x.id === id)
  if (from === -1) return ideas

  const idea = ideas[from]!
  if (idea.pinned) {
    const { pinned: _drop, ...rest } = idea
    return ideas.toSpliced(from, 1, rest)
  }
  return ideas.toSpliced(from, 1).toSpliced(0, 0, { ...idea, pinned: true })
}
