/*
 * Service worker — минимум, нужный ради двух вещей: установка приложения на
 * телефон (Chrome предлагает установку только сайту с обработчиком fetch) и
 * запуск без сети.
 *
 * Стратегия намеренно «сначала сеть»: свежий деплой должен доезжать сразу, а
 * кэш нужен только как подстраховка в офлайне. Обратная стратегия («сначала
 * кэш») быстрее, но у неё известная плата — пользователь может неделями
 * сидеть на старой версии, не понимая почему.
 *
 * Запросы к /api не кэшируются вовсе: там документ с версией, и отданный из
 * кэша устаревший ответ породил бы конфликт синхронизации на ровном месте.
 */

const CACHE = 'sistema-zhizni-v1'

/** Оболочка приложения: с ней страница открывается офлайн */
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  // новая версия не ждёт закрытия старых вкладок
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {}))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // чужие домены (шрифты, превью с ютуба, фото из Storage) и API — мимо кэша
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // в кэш кладём только удачные ответы своего происхождения
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        // переход по адресу без сети — отдаём оболочку, дальше приложение
        // поднимется из localStorage
        if (request.mode === 'navigate') {
          const shell = await caches.match('/index.html')
          if (shell) return shell
        }
        throw new Error('офлайн и в кэше пусто')
      }),
  )
})
