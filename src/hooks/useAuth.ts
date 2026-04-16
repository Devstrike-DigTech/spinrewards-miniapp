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
    async function authenticate() {
      try {
        // If we have a stored token, try to fetch the user profile directly
        if (tokens?.access) {
          try {
            const me = await users.me()
            setAuth(me, tokens)
            setIsLoading(false)
            return
          } catch {
            // Token expired or invalid — fall through to re-auth
            clearAuth()
          }
        }

        // Authenticate with Telegram initData
        if (!initData) {
          setError('No Telegram context. Open this app inside Telegram.')
          setIsLoading(false)
          return
        }

        const { user: authUser, tokens: authTokens } =
          await auth.telegram(initData)
        setAuth(authUser, authTokens)
        setTokens(authTokens)
      } catch (err) {
        console.error('[Auth] Failed:', err)
        setError('Authentication failed. Please try again.')
        clearAuth()
      } finally {
        setIsLoading(false)
      }
    }

    authenticate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isLoading, error, isAuthenticated, user }
}
