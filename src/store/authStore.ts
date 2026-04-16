import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, AuthTokens } from '@/types'

interface AuthState {
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  setAuth: (user: User, tokens: AuthTokens) => void
  setTokens: (tokens: AuthTokens) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,

      setAuth: (user, tokens) =>
        set({ user, tokens, isAuthenticated: true }),

      setTokens: (tokens) =>
        set({ tokens }),

      clearAuth: () =>
        set({ user: null, tokens: null, isAuthenticated: false }),
    }),
    {
      name: 'spinrewards-auth',
      // Only persist tokens — user data is re-fetched on each launch
      partialize: (state) => ({ tokens: state.tokens }),
    }
  )
)
