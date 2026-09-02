import { describe, expect, it } from 'vitest'
import { mergeSectionLines } from './course'
import type { CourseSection } from '../types'

const newId = (i: number) => 'new' + i

describe('mergeSectionLines — правка курса не сбрасывает пройденное', () => {
  const existing: CourseSection[] = [
    { id: 'a', text: 'Основы', done: true },
    { id: 'b', text: 'Хуки', done: false },
  ]

  it('совпавшая строка сохраняет id и галочку', () => {
    const res = mergeSectionLines(existing, ['Основы', 'Хуки'], newId)
    expect(res).toEqual(existing)
  })

  it('новая строка получает новый id и не считается пройденной', () => {
    const res = mergeSectionLines(existing, ['Основы', 'Хуки', 'Роутинг'], newId)
    expect(res[2]).toEqual({ id: 'new2', text: 'Роутинг', done: false })
    expect(res[0]!.done).toBe(true)
  })

  it('удалённая строка исчезает, остальные сохраняют отметки', () => {
    const res = mergeSectionLines(existing, ['Хуки'], newId)
    expect(res).toEqual([{ id: 'b', text: 'Хуки', done: false }])
  })

  it('переставленные разделы остаются собой — важно для слияния по id', () => {
    const res = mergeSectionLines(existing, ['Хуки', 'Основы'], newId)
    expect(res.map((s) => s.id)).toEqual(['b', 'a'])
    expect(res[1]!.done).toBe(true)
  })

  it('два одинаковых названия — два разных раздела, а не одна отметка на двоих', () => {
    const res = mergeSectionLines(existing, ['Основы', 'Основы'], newId)
    expect(res[0]!.id).toBe('a')
    expect(res[1]).toEqual({ id: 'new1', text: 'Основы', done: false })
  })

  it('пустой список допустим — на правке разделы можно убрать все', () => {
    expect(mergeSectionLines(existing, [], newId)).toEqual([])
  })
})
