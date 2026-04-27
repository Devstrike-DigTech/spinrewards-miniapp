import { useEffect, useState } from 'react'
import { auth, users } from '@/api/endpoints'
import { useAuthStore } from '@/store/authStore'
import { useTelegram } from './useTelegram'

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { initData } = useTelegram()
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

        // Authenticate with Telegram initData
        const activeInitData = initData || (
          import.meta.env.DEV
            ? (import.meta.env.VITE_DEV_INIT_DATA as string | undefined)
            : undefined
        )

        if (!activeInitData) {
          if (!cancelled) {
            setError('No Telegram context. Open this app inside Telegram.')
            setIsLoading(false)
          }
          return
        }

        if (!initData && activeInitData) {
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
