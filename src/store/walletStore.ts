import { create } from 'zustand'

interface WalletState {
  coinBalance: string | null
  cashBalance: string | null
  stakedBalance: string | null
  isLoading: boolean
  setBalance: (coin: string, cash: string, staked?: string) => void
  setLoading: (loading: boolean) => void
}

export const useWalletStore = create<WalletState>()((set) => ({
  coinBalance: null,
  cashBalance: null,
  stakedBalance: null,
  isLoading: false,

  setBalance: (coin, cash, staked = '0.00') =>
    set({ coinBalance: coin, cashBalance: cash, stakedBalance: staked }),

  setLoading: (loading) =>
    set({ isLoading: loading }),
}))
