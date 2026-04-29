import { useEffect } from 'react'
import WebApp from '@twa-dev/sdk'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tg = () => (window as any).Telegram?.WebApp

// Signal readiness immediately at module load — the sooner Telegram receives
// this, the sooner it sends back initData via postMessage.
WebApp.ready()

export function useTelegram() {
  useEffect(() => {
    WebApp.expand()
    WebApp.lockOrientation?.()
  }, [])

  return {
    webApp: WebApp,
    // Read directly from window.Telegram.WebApp at call time — the SDK's
    // module-level reference can be stale on some native Telegram versions.
    user: tg()?.initDataUnsafe?.user,
    initData: tg()?.initData as string | undefined,
    colorScheme: WebApp.colorScheme,
    themeParams: WebApp.themeParams,
    haptic: WebApp.HapticFeedback,
    close: () => WebApp.close(),
  }
}
