import { parseRichText } from '../logic/richText'
import { C } from '../theme'

/**
 * Текст со ссылками в разметке телеграма: `[подпись](адрес)`.
 *
 * Ссылки открываются в новой вкладке с `noopener` — открытая страница не должна
 * получить доступ к окну приложения.
 */
export function RichText({ text, color }: { text: string; color?: string }) {
  return (
    <>
      {parseRichText(text).map((p, i) =>
        p.kind === 'text' ? (
          <span key={i}>{p.text}</span>
        ) : (
          <a
            key={i}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: color ?? C.cyanBright, overflowWrap: 'anywhere' }}
          >
            {p.label}
          </a>
        ),
      )}
    </>
  )
}
