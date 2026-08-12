import { copyText } from '../logic/clipboard'
import { parseRichText } from '../logic/richText'
import { useToast } from '../state/ToastProvider'
import { C } from '../theme'

/**
 * Текст со ссылками: `[Ссылка](адрес)` показывает только подпись, сам адрес
 * остаётся спрятанным.
 *
 * Нажатие копирует адрес, а не открывает его. Переход отсюда запускает внешний
 * браузер, где нет входа в нужный аккаунт, — скопированную ссылку человек
 * вставляет туда, где ему удобно. Голый адрес в тексте тоже кликается, но
 * показывается сокращённо: длинный URL посреди заметки только мешает читать.
 */
export function RichText({ text, color }: { text: string; color?: string }) {
  const toast = useToast()

  const copy = async (url: string) => {
    toast((await copyText(url)) ? 'Ссылка скопирована' : 'Не получилось скопировать — скопируй вручную')
  }

  return (
    <>
      {parseRichText(text).map((p, i) =>
        p.kind === 'text' ? (
          <span key={i}>{p.text}</span>
        ) : (
          <button
            key={i}
            onClick={() => void copy(p.url)}
            title={p.url}
            style={{
              fontFamily: 'inherit',
              fontSize: 'inherit',
              padding: 0,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: color ?? C.cyanBright,
              textDecoration: 'underline',
              textUnderlineOffset: 2,
              overflowWrap: 'anywhere',
              textAlign: 'left',
            }}
          >
            {p.label}
          </button>
        ),
      )}
    </>
  )
}
