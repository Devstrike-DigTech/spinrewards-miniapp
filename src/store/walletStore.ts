import { create } from 'zustand'

interface WalletState {
  coinBalance: string | null
  cashBalance: string | null
  isLoading: boolean
  setBalance: (coin: string, cash: string) => void
  setLoading: (loading: boolean) => void
}

export const useWalletStore = create<WalletState>()((set) => ({
  coinBalance: null,
  cashBalance: null,
  isLoading: false,

  setBalance: (coin, cash) =>
    set({ coinBalance: coin, cashBalance: cash }),

  setLoading: (loading) =>
    set({ isLoading: loading }),
}))
