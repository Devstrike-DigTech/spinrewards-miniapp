import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/globals.css'

// Capture Telegram context at the very earliest moment, before React renders
{
  const tg = (window as any).Telegram?.WebApp
  console.log('[Boot] early Telegram state:', JSON.stringify({
    hasTelegram: !!(window as any).Telegram,
    hasWebApp: !!tg,
    version: tg?.version,
    platform: tg?.platform,
    initDataLength: tg?.initData?.length,
    initData: tg?.initData?.slice(0, 100),
    hasProxy: !!(window as any).TelegramWebviewProxy,
    hash: window.location.hash?.slice(0, 200),
  }))
}

const root = document.getElementById('root')!

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)
