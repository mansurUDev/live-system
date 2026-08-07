import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './global.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker: без него браузер не предложит установить приложение на
// телефон, а страница не откроется без сети. Регистрируем после загрузки,
// чтобы не отнимать сеть у первого рендера. В dev-режиме не нужен — там он
// только мешал бы горячей перезагрузке.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* не зарегистрировался — приложение работает как обычный сайт */
    })
  })
}
