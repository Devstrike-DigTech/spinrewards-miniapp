import { create } from 'zustand'
import type { PublicSettings } from '@/types'

interface SettingsState {
  settings: PublicSettings | null
  isLoaded: boolean
  setSettings: (data: PublicSettings) => void
}

/**
 * Stores public app configuration fetched from /settings/public/ on launch.
 * Read dynamic values (min deposits/withdrawals, bonus rate, crypto flag) from
 * here rather than hardcoding them anywhere in the UI.
 */
export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: null,
  isLoaded: false,

  setSettings: (data) => set({ settings: data, isLoaded: true }),
}))

// ── Convenience selectors ─────────────────────────────────────────────────────

/** Bonus payout rate as a percentage string e.g. "40%" */
export function bonusPayoutLabel(settings: PublicSettings | null): string {
  if (!settings) return '40%'
  const rate = parseFloat(settings.bonus_payout_rate)
  return `${Math.round(rate * 100)}%`
}

/** Coins credited for an NGN deposit — 1:1 in v3 (₦1 → 1 naira coin) */
export function coinsForNgn(amountNgn: number): number {
  return Math.floor(amountNgn)
}

/** Coins credited for a USD deposit — 1:1 in v3 (1 USDT → 1 crypto coin) */
export function coinsForUsd(amountUsd: number): number {
  return amountUsd
}

/** Whether the crypto withdrawal rail is currently enabled */
export function cryptoWithdrawalEnabled(settings: PublicSettings | null): boolean {
  return settings?.crypto_withdrawal_enabled ?? false
}

/** Display-only NGN ≈ for a USDT amount, using the display rate */
export function usdToNgnDisplay(amountUsd: number, settings: PublicSettings | null): number {
  const rate = settings ? parseFloat(settings.ngn_per_usd_display_rate) : 1500
  return Math.round(amountUsd * rate)
}
