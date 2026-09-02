import { describe, expect, it } from 'vitest'
import {
  applyShare,
  classifyShare,
  cleanLink,
  SHARE_MAX_SHOWS,
  SHARE_MAX_TITLE,
  type ShareDoc,
} from '../../api/shareLogic'
import { MAX_SHOWS, MAX_TITLE, MAX_VIDEO_URL } from '../constants'
import { cleanShareUrl } from './links'
import { normalize } from './normalize'
import { defaultDoc } from './defaults'
import type { Doc } from '../types'

const NOW_ISO = '2026-09-02T10:00:00.000Z'
const META = { id: 'x1', nowIso: NOW_ISO }

function emptyDoc(): ShareDoc {
  return { ideas: [], lib: { videos: [], shows: [], books: [], courses: [] } }
}

describe('константы api и приложения не разошлись', () => {
  it('лимиты совпадают', () => {
    expect(SHARE_MAX_SHOWS).toBe(MAX_SHOWS)
    expect(SHARE_MAX_TITLE).toBe(MAX_TITLE)
    expect(500).toBe(MAX_VIDEO_URL)
  })
})

describe('classifyShare — куда попадёт ссылка', () => {
  const cases: [string, string][] = [
    ['https://youtu.be/dQw4w9WgXcQ', 'video'],
    ['https://www.youtube.com/watch?v=abc', 'video'],
    ['https://www.kinopoisk.ru/film/435/', 'show'],
    ['https://www.kinopoisk.ru/series/1234/', 'show'],
    ['https://myanimelist.net/anime/52299/', 'show'],
    ['https://shikimori.one/animes/z20-naruto', 'show'],
    ['https://doramy.club/30756-serial.html', 'show'],
    ['https://www.imdb.com/title/tt0111161/', 'show'],
    ['https://habr.com/ru/post/1/', 'idea'],
    ['не ссылка вовсе', 'idea'],
  ]

  for (const [url, kind] of cases) {
    it(`${url} → ${kind}`, () => {
      expect(classifyShare(url).kind).toBe(kind)
    })
  }

  it('категория «Смотреть» угадывается по домену', () => {
    expect(classifyShare('https://myanimelist.net/anime/1').showKind).toBe('anime')
    expect(classifyShare('https://doramy.club/x').showKind).toBe('dorama')
    expect(classifyShare('https://www.kinopoisk.ru/series/1/').showKind).toBe('series')
    expect(classifyShare('https://www.kinopoisk.ru/film/1/').showKind).toBe('film')
  })

  it('явный выбор человека сильнее догадки', () => {
    expect(classifyShare('https://youtu.be/abc', 'show').kind).toBe('show')
    expect(classifyShare('https://www.kinopoisk.ru/film/1/', 'idea').kind).toBe('idea')
  })
})

describe('cleanLink — тот же результат, что и в приложении', () => {
  const urls = [
    'https://youtu.be/abc?si=track&t=42',
    'https://www.youtube.com/watch?v=abc&si=x&list=PL1',
    'https://www.instagram.com/p/xyz/?igsh=track',
    'https://shop.uz/item?utm_source=tg&utm_medium=post&id=7',
    'https://example.com/a?fbclid=1&keep=2',
    'https://example.com/a#anchor',
    'https://www.kinopoisk.ru/film/435/?ref=x',
    'не ссылка',
  ]
  for (const url of urls) {
    it(url, () => {
      expect(cleanLink(url)).toBe(cleanShareUrl(url))
    })
  }
})

describe('applyShare — запись в документ', () => {
  it('видео уходит в очередь и не дублируется', () => {
    const doc = emptyDoc()
    const first = applyShare(doc, { kind: 'video' }, { url: 'https://youtu.be/abc?si=x', title: 'Ролик', note: '' }, META)
    expect(first.changed).toBe(true)
    expect(doc.lib.videos[0]!.url).toBe('https://youtu.be/abc')
    const again = applyShare(doc, { kind: 'video' }, { url: 'https://youtu.be/abc', title: 'Ролик', note: '' }, META)
    expect(again.changed).toBe(false)
    expect(doc.lib.videos).toHaveLength(1)
  })

  it('запись «Смотреть» создаётся с категорией домена и без позиции', () => {
    const doc = emptyDoc()
    applyShare(
      doc,
      { kind: 'show', showKind: 'anime' },
      { url: 'https://myanimelist.net/anime/1', title: 'Наруто', note: '' },
      META,
    )
    expect(doc.lib.shows[0]).toMatchObject({ kind: 'anime', title: 'Наруто', season: 0, episode: 0, priority: 0 })
    expect('dropped' in doc.lib.shows[0]!).toBe(false)
  })

  it('дубль «Смотреть» ловится даже с другим следящим хвостом', () => {
    const doc = emptyDoc()
    applyShare(doc, { kind: 'show' }, { url: 'https://www.kinopoisk.ru/film/1/', title: 'Фильм', note: '' }, META)
    const again = applyShare(
      doc,
      { kind: 'show' },
      { url: 'https://www.kinopoisk.ru/film/1/?utm_source=tg', title: 'Фильм', note: '' },
      META,
    )
    expect(again.changed).toBe(false)
  })

  it('без названия берётся хост, а не адрес целиком', () => {
    const doc = emptyDoc()
    applyShare(doc, { kind: 'idea' }, { url: 'https://habr.com/ru/post/1/', title: '', note: '' }, META)
    expect(doc.ideas[0]!.title).toBe('habr.com')
  })

  it('результат остаётся правильным документом для normalize', () => {
    const base: Doc = normalize(defaultDoc(Date.parse(NOW_ISO)), Date.parse(NOW_ISO))
    const shareView = base as unknown as ShareDoc
    applyShare(shareView, { kind: 'show', showKind: 'dorama' }, { url: 'https://doramy.club/x', title: 'Дорама', note: '' }, META)
    applyShare(shareView, { kind: 'video' }, { url: 'https://youtu.be/abc', title: 'Ролик', note: 'заметка' }, META)
    applyShare(shareView, { kind: 'idea' }, { url: 'https://habr.com/p/1', title: 'Идея', note: 'текст' }, META)
    const after = normalize(base, Date.parse(NOW_ISO))
    expect(after).toEqual(base)
    expect(after.lib.shows).toHaveLength(1)
    expect(after.lib.videos).toHaveLength(1)
    expect(after.ideas).toHaveLength(1)
  })
})
