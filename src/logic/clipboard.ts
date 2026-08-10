/**
 * Копирование текста в буфер.
 *
 * Основной путь — асинхронный Clipboard API, но он требует https и разрешения,
 * а на встроенных браузерах внутри приложений его может не быть вовсе. Поэтому
 * при отказе пробуем старый execCommand через невидимое поле: оно работает
 * почти везде, пока вызов идёт из обработчика нажатия.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* нет разрешения или не защищённый контекст — пробуем запасной путь */
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    // readOnly вместо disabled: iOS не даёт выделить текст в отключённом поле
    area.readOnly = true
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    area.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}
