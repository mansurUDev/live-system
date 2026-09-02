import type { CourseSection } from '../types'

/**
 * Разделы курса из строк текстового поля.
 *
 * Правка не должна сбрасывать пройденное: строка, совпавшая с существующим
 * разделом, оставляет его id и галочку. Совпадение ищется по тексту и только
 * один раз на раздел — два одинаковых названия останутся двумя разными
 * разделами, а не поделят одну отметку. Id сохранять важно и для слияния:
 * разделы там сопоставляются по id, и новые id выглядели бы как «удалил все
 * и создал заново», стирая отметки со второго устройства.
 */
export function mergeSectionLines(
  existing: CourseSection[],
  lines: string[],
  newId: (index: number) => string,
): CourseSection[] {
  const used = new Set<string>()
  return lines.map((text, i) => {
    const found = existing.find((s) => s.text === text && !used.has(s.id))
    if (found) {
      used.add(found.id)
      return found
    }
    return { id: newId(i), text, done: false }
  })
}
