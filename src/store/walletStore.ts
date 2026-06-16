import { create } from 'zustand'
import type { WalletBalance } from '@/types'

interface WalletState {
  // Spendable (fund spins)
  cryptoCoins: string | null   // USDT-pegged 1:1
  nairaCoins: string | null    // NGN-pegged 1:1
  bonusCoins: string | null    // platform units
  // Withdrawable
  cryptoWithdraw: string | null // USDT, → crypto wallet
  nairaWithdraw: string | null  // NGN, → bank account
  // Transient hold during an in-flight spin
  staked: string | null
  isLoading: boolean
  /** Hydrate the store from a fresh WalletBalance API response */
  setBalance: (data: WalletBalance) => void
  setLoading: (loading: boolean) => void
}

export const useWalletStore = create<WalletState>()((set) => ({
  cryptoCoins: null,
  nairaCoins: null,
  bonusCoins: null,
  cryptoWithdraw: null,
  nairaWithdraw: null,
  staked: null,
  isLoading: false,

  setBalance: (data) =>
    set({
      cryptoCoins: data.crypto_coins,
      nairaCoins: data.naira_coins,
      bonusCoins: data.bonus_coins,
      cryptoWithdraw: data.crypto_withdraw_balance,
      nairaWithdraw: data.naira_withdraw_balance,
      staked: data.staked,
    }),

  setLoading: (loading) => set({ isLoading: loading }),
}))
