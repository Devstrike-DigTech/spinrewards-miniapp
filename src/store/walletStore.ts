import { create } from 'zustand'
import type { WalletBalance } from '@/types'

interface WalletState {
  /** Coins funded by cash/crypto deposits. Spinnable → 100% of win to earnings. */
  depositCoins: string | null
  /** Coins funded by challenge rewards. Spinnable → 40% of win to earnings. */
  bonusCoins: string | null
  /** Sum of deposit_coins + bonus_coins */
  totalCoins: string | null
  /** NGN earnings from wins and deposit_credit rewards. Withdrawable. */
  earnings: string | null
  /** USD equivalent of earnings (display only) */
  earningsUsd: string | null
  /** Currently staked amount */
  staked: string | null
  isLoading: boolean
  /** Hydrate the store from a fresh WalletBalance API response */
  setBalance: (data: WalletBalance) => void
  setLoading: (loading: boolean) => void
}

export const useWalletStore = create<WalletState>()((set) => ({
  depositCoins: null,
  bonusCoins: null,
  totalCoins: null,
  earnings: null,
  earningsUsd: null,
  staked: null,
  isLoading: false,

  setBalance: (data) =>
    set({
      depositCoins: data.deposit_coins,
      bonusCoins: data.bonus_coins,
      totalCoins: data.total_coins,
      earnings: data.earnings,
      earningsUsd: data.earnings_usd_equivalent,
      staked: data.staked,
    }),

  setLoading: (loading) => set({ isLoading: loading }),
}))
