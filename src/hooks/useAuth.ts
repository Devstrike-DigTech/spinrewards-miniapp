import { useEffect, useState } from 'react'
import { auth, users } from '@/api/endpoints'
import { useAuthStore } from '@/store/authStore'
import { useTelegram } from './useTelegram'

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useTelegram() // still call it so WebApp.ready() / WebApp.expand() fires
  const { setAuth, setTokens, clearAuth, isAuthenticated, tokens, user } =
    useAuthStore()

  useEffect(() => {
    // cancelled flag prevents the first StrictMode effect invocation from
    // setting state after React has already re-fired the effect a second time
    let cancelled = false

    async function authenticate() {
      // Diagnostic: dump full WebApp state before any polling
      const tgDebug = (window as any).Telegram?.WebApp
      console.log('[Auth] WebApp diagnostic:', JSON.stringify({
        hasTelegram: !!(window as any).Telegram,
        hasWebApp: !!tgDebug,
        version: tgDebug?.version,
        platform: tgDebug?.platform,
        initData: tgDebug?.initData,
        initDataLength: tgDebug?.initData?.length,
        initDataUnsafe: tgDebug?.initDataUnsafe,
        hasProxy: !!(window as any).TelegramWebviewProxy,
        hashLength: window.location.hash?.length,
        hasTgWebAppData: window.location.hash?.includes('tgWebAppData'),
        locationSearch: window.location.search?.slice(0, 200),
        referrer: document.referrer?.slice(0, 100),
      }))

      try {
        // If we have a stored token, try to fetch the user profile directly
        if (tokens?.access) {
          try {
            const me = await users.me()
            if (cancelled) return
            setAuth(me, tokens)
            setIsLoading(false)
            return
          } catch {
            if (cancelled) return
            // Token expired or invalid — fall through to re-auth
            clearAuth()
          }
        }

        // initData arrives asynchronously via postMessage from Telegram's shell
        // after WebApp.ready() is called. Poll for up to 1 second so we don't
        // read it before Telegram has had a chance to inject it.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
       const getInitData = async (): Promise<string | undefined> => {
  const tg = (window as any).Telegram?.WebApp;

  if (tg) {
    // Notify Telegram the app is ready
    tg.ready();
    
    // If data is already there, return it
    if (tg.initData) return tg.initData;
  }

  // Fallback: If you still need a slight wait for async script injection
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const liveData = (window as any).Telegram?.WebApp?.initData;
    if (liveData) return liveData;
  }

  return undefined;
};


        const devInitData = import.meta.env.DEV
          ? (import.meta.env.VITE_DEV_INIT_DATA as string | undefined)
          : undefined
        const activeInitData = await getInitData() || devInitData

        console.log('[Auth] initData present:', !!activeInitData, '| length:', activeInitData?.length ?? 0)

        if (!activeInitData) {
          if (!cancelled) {
            setError('No Telegram context. Open this app inside Telegram.')
            setIsLoading(false)
          }
          return
        }

        if (!activeInitData && devInitData) {
          console.warn('[Auth] Using VITE_DEV_INIT_DATA — dev only')
        }

        const { user: authUser, tokens: authTokens } =
          await auth.telegram(activeInitData)
        if (cancelled) return
        setAuth(authUser, authTokens)
        setTokens(authTokens)
      } catch (err) {
        console.error('[Auth] Failed:', err)
        if (!cancelled) {
          setError('Authentication failed. Please try again.')
          clearAuth()
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    authenticate()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isLoading, error, isAuthenticated, user }
}
