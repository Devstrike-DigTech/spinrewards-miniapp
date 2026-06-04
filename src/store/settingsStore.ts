import { create } from 'zustand'
import type { PublicSettings } from '@/types'

interface SettingsState {
  settings: PublicSettings | null
  isLoaded: boolean
  setSettings: (data: PublicSettings) => void
}

/**
 * Stores public app configuration fetched from /settings/public/ on launch.
 * Read dynamic values (min deposits, coin rates, payout %) from here
 * rather than hardcoding them anywhere in the UI.
 */
export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: null,
  isLoaded: false,

  setSettings: (data) => set({ settings: data, isLoaded: true }),
}))

// ── Convenience selectors ─────────────────────────────────────────────────────

/** Bonus wallet payout rate as a percentage string e.g. "40%" */
export function bonusPayoutLabel(settings: PublicSettings | null): string {
  if (!settings) return '40%'
  const rate = parseFloat(settings.bonus_wallet_payout_rate)
  return `${Math.round(rate * 100)}%`
}

/** "You'll get X coins" preview for an NGN deposit amount */
export function coinsForNgn(amountNgn: number, settings: PublicSettings | null): number {
  if (!settings) return amountNgn
  return Math.floor(amountNgn * parseFloat(settings.coins_per_ngn))
}

/** "You'll get X coins" preview for a USD deposit amount */
export function coinsForUsd(amountUsd: number, settings: PublicSettings | null): number {
  if (!settings) return amountUsd * 1500
  return Math.floor(amountUsd * parseFloat(settings.coins_per_usd))
}
