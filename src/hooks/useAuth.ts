import { useEffect, useState } from 'react'
import WebApp from '@twa-dev/sdk'
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

        // Read initData inside the effect so we always get the live value
        // from window.Telegram.WebApp, not a render-time snapshot that may
        // have been captured before Telegram's script finished injecting it.
        const activeInitData =
          WebApp.initData ||
          (import.meta.env.DEV
            ? (import.meta.env.VITE_DEV_INIT_DATA as string | undefined)
            : undefined)

        if (!activeInitData) {
          if (!cancelled) {
            setError('No Telegram context. Open this app inside Telegram.')
            setIsLoading(false)
          }
          return
        }

        if (!WebApp.initData && activeInitData) {
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
