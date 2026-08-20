import { describe, expect, it } from 'vitest'
import {
  applyAction,
  classify,
  extractUrls,
  TG_MAX_IDEA_CATEGORY,
  TG_MAX_IDEA_TEXT,
  TG_MAX_IDEA_TITLE,
  TG_MAX_IDEAS,
  TG_MAX_VIDEO_NOTE,
  TG_MAX_VIDEOS,
  TG_PAL,
  type TgDoc,
} from '../../api/tgLogic'
import {
  MAX_IDEA_CATEGORY,
  MAX_IDEA_TEXT,
  MAX_IDEA_TITLE,
  MAX_IDEAS,
  MAX_VIDEO_NOTE,
  MAX_VIDEOS,
  PAL,
} from '../constants'

const NOW_ISO = '2026-03-15T12:00:00.000Z'
const YT = 'https://www.youtube.com/watch?v=p5B_FKjghOM'

function doc(patch: Partial<TgDoc> = {}): TgDoc {
  return {
    ideas: [],
    lib: { videos: [], books: [], courses: [], shows: [] },
    ...patch,
  }
}

const meta = (over: Partial<Parameters<typeof applyAction>[2]> = {}) => ({
  id: 'test1',
  nowIso: NOW_ISO,
  ...over,
})

describe('телеграм-бот — продублированные константы не разошлись', () => {
  it('пределы и палитра совпадают с src/constants', () => {
    expect(TG_MAX_VIDEOS).toBe(MAX_VIDEOS)
    expect(TG_MAX_IDEAS).toBe(MAX_IDEAS)
    expect(TG_MAX_IDEA_TITLE).toBe(MAX_IDEA_TITLE)
    expect(TG_MAX_IDEA_CATEGORY).toBe(MAX_IDEA_CATEGORY)
    expect(TG_MAX_IDEA_TEXT).toBe(MAX_IDEA_TEXT)
    expect(TG_MAX_VIDEO_NOTE).toBe(MAX_VIDEO_NOTE)
    expect(TG_PAL).toEqual([...PAL])
  })
})

describe('телеграм-бот — классификация сообщения', () => {
  it('youtube-ссылка уходит в видео, остальной текст — пометкой', () => {
    const a = classify(`посмотреть вечером ${YT}`, 'Видео')
    expect(a).toEqual({ kind: 'video', url: YT, note: 'посмотреть вечером' })
  })

  it('короткая youtu.be — тоже видео', () => {
    const a = classify('https://youtu.be/p5B_FKjghOM', 'Видео')
    expect(a.kind).toBe('video')
  })

  it('текст без ссылок — идея с категорией по названию группы', () => {
    const a = classify('Магнитный пульт\nМодули слипаются магнитами', 'Ардуино')
    expect(a).toEqual({
      kind: 'idea',
      title: 'Магнитный пульт',
      text: 'Модули слипаются магнитами',
      links: [],
      category: 'Ардуино',
    })
  })

  it('не-youtube ссылка остаётся в идее ссылкой', () => {
    const a = classify('Кресло-качалка https://example.com/chair', 'Покупки')
    expect(a.kind === 'idea' && a.links).toEqual(['https://example.com/chair'])
  })

  it('пустое сообщение — вежливый отказ', () => {
    expect(classify('', 'Видео').kind).toBe('skip')
    expect(classify('   ', 'Видео').kind).toBe('skip')
  })

  it('длинное название группы обрезается как категория', () => {
    const a = classify('идея', 'Очень длинное название группы больше предела')
    expect(a.kind === 'idea' && a.category.length).toBeLessThanOrEqual(TG_MAX_IDEA_CATEGORY)
  })

  it('хвостовая пунктуация не прилипает к адресу', () => {
    expect(extractUrls('смотри https://a.ru, потом')).toEqual(['https://a.ru'])
  })
})

describe('телеграм-бот — применение к документу', () => {
  it('видео добавляется с названием из oEmbed и свободным цветом', () => {
    const d = doc()
    const r = applyAction(d, { kind: 'video', url: YT, note: 'из группы' }, meta({ title: 'Курс', channel: 'Осин' }))
    expect(r.changed).toBe(true)
    expect(d.lib.videos).toHaveLength(1)
    expect(d.lib.videos[0]).toMatchObject({ url: YT, title: 'Курс', channel: 'Осин', note: 'из группы' })
    expect(TG_PAL).toContain(d.lib.videos[0]!.color)
  })

  it('повторная ссылка не дублируется', () => {
    const d = doc()
    applyAction(d, { kind: 'video', url: YT, note: '' }, meta())
    const r = applyAction(d, { kind: 'video', url: YT, note: '' }, meta({ id: 'test2' }))
    expect(r.changed).toBe(false)
    expect(d.lib.videos).toHaveLength(1)
  })

  it('переполненная очередь видео не растёт, а отвечает отказом', () => {
    const d = doc()
    for (let i = 0; i < TG_MAX_VIDEOS; i++) {
      applyAction(d, { kind: 'video', url: `https://youtu.be/x${i}`, note: '' }, meta({ id: 'v' + i }))
    }
    const r = applyAction(d, { kind: 'video', url: 'https://youtu.be/extra', note: '' }, meta())
    expect(r.changed).toBe(false)
    expect(d.lib.videos).toHaveLength(TG_MAX_VIDEOS)
  })

  it('идея получает ссылки с доменными подписями', () => {
    const d = doc()
    const r = applyAction(
      d,
      { kind: 'idea', title: 'Кресло', text: '', links: ['https://www.example.com/chair'], category: 'Покупки' },
      meta(),
    )
    expect(r.changed).toBe(true)
    expect(d.ideas[0]!.links[0]).toMatchObject({ url: 'https://www.example.com/chair', label: 'example.com' })
    expect(d.ideas[0]!.category).toBe('Покупки')
    // поле нового приложения — если бот его забудет, клиент увидит правку
    // из normalize там, где никто ничего не менял, и лишний раз отправит документ
    expect(d.ideas[0]!.checklist).toEqual([])
  })

  it('одинаковая идея не дублируется', () => {
    const d = doc()
    const idea: Parameters<typeof applyAction>[1] = {
      kind: 'idea',
      title: 'Кресло',
      text: 'то же',
      links: [],
      category: 'Покупки',
    }
    applyAction(d, idea, meta())
    const r = applyAction(d, idea, meta({ id: 'test2' }))
    expect(r.changed).toBe(false)
    expect(d.ideas).toHaveLength(1)
  })
})
