import { useEffect } from 'react'
import WebApp from '@twa-dev/sdk'

export function useTelegram() {
  useEffect(() => {
    WebApp.ready()
    WebApp.expand()
    // Lock orientation to portrait
    WebApp.lockOrientation?.()
  }, [])

  return {
    webApp: WebApp,
    user: WebApp.initDataUnsafe?.user,
    initData: WebApp.initData,
    colorScheme: WebApp.colorScheme,
    themeParams: WebApp.themeParams,
    haptic: WebApp.HapticFeedback,
    close: () => WebApp.close(),
  }
}
