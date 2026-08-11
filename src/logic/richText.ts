import { isHttpUrl } from './links'

export type TextPart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; label: string; url: string }

/**
 * `[подпись](адрес)` — как в телеграме — либо просто адрес в тексте.
 *
 * Обе части без вложенных повторов, поэтому разбор линейный: на длинной
 * заметке движок не уйдёт в перебор.
 */
const PART_SOURCE = String.raw`\[([^\]\n]*)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>]+)`

/** Знаки, прилипшие к концу голого адреса: «смотри https://x.ru, потом» */
const TRAILING = /[.,;:!?)\]»"'’]+$/

/**
 * Разбор текста на куски для отрисовки.
 *
 * Адрес, который не является http(s), ссылкой не становится и остаётся
 * обычным текстом: иначе `javascript:` из чужого импорта попал бы в href.
 * Пользователь при этом видит свою запись как есть и понимает, что ошибся.
 */
export function parseRichText(text: string): TextPart[] {
  const out: TextPart[] = []
  if (!text) return out

  const re = new RegExp(PART_SOURCE, 'g')
  let last = 0
  let m: RegExpExecArray | null

  const pushText = (s: string) => {
    if (!s) return
    const prev = out[out.length - 1]
    if (prev && prev.kind === 'text') prev.text += s
    else out.push({ kind: 'text', text: s })
  }

  while ((m = re.exec(text)) !== null) {
    const mdLabel = m[1]
    const mdUrl = m[2]
    const bare = m[3]

    if (mdUrl !== undefined) {
      if (!isHttpUrl(mdUrl)) continue
      pushText(text.slice(last, m.index))
      // пустая подпись — показываем сам адрес, невидимая ссылка бесполезна
      out.push({ kind: 'link', label: (mdLabel ?? '').trim() || mdUrl, url: mdUrl })
      last = m.index + m[0].length
    } else if (bare !== undefined) {
      const trail = TRAILING.exec(bare)
      const url = trail ? bare.slice(0, bare.length - trail[0].length) : bare
      if (!url || !isHttpUrl(url)) continue
      pushText(text.slice(last, m.index))
      out.push({ kind: 'link', label: url, url })
      // хвостовая пунктуация остаётся текстом — её подберёт следующий кусок
      last = m.index + url.length
    }
  }

  pushText(text.slice(last))
  return out
}

/** Есть ли в тексте хоть одна настоящая ссылка — для подсказки в форме */
export function hasLink(text: string): boolean {
  return parseRichText(text).some((p) => p.kind === 'link')
}
