// Auth
export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface AuthResponse {
  user: User
  tokens: AuthTokens
}

// User
export interface User {
  id: string
  telegram_id: string
  first_name: string
  last_name: string
  username: string
  referral_code: string
  is_kyc_verified: boolean
  created_at: string
}

// Wallet — v3 six balances. Never sum across currencies.
//   Spendable (fund spins):  crypto_coins (USDT-pegged), naira_coins (NGN-pegged), bonus_coins
//   Withdrawable:            crypto_withdraw_balance (USDT), naira_withdraw_balance (NGN)
//   Transient:               staked (hold during an in-flight spin)
export interface WalletBalance {
  crypto_coins: string
  naira_coins: string
  bonus_coins: string
  crypto_withdraw_balance: string
  naira_withdraw_balance: string
  staked: string
}

// Optional caps block also returned by /wallet/
export interface CurrencyCaps {
  min_deposit_ngn: string
  min_deposit_usd: string
  min_withdrawal_ngn: string
  min_withdrawal_usdt: string
}

// Public app settings (fetched once on launch from /settings/public/)
export interface PublicSettings {
  bonus_payout_rate: string         // e.g. "0.40" — fraction of a bonus-spin gross paid out
  bonus_to_ngn_rate: string         // bonus → NGN (1:1 in MVP)
  bonus_to_usdt_rate: string        // bonus → USDT (1:1 in MVP)
  ngn_per_usd_display_rate: string  // display-only NGN/USD comparison rate
  min_deposit_ngn: string
  min_deposit_usd: string
  min_withdrawal_ngn: string
  min_withdrawal_usdt: string
  crypto_withdrawal_enabled: boolean
}

// Spin — Wheels
export type WheelType = 'standard' | 'power' | 'mega' | 'welcome' | 'daily_challenge'

/**
 * One segment as returned by the backend.
 * position matches segment_position in SpinResult — pass to spinTo() as-is.
 */
export interface WheelSegmentAPI {
  position: number
  label: string       // e.g. "Loss", "0.5×", "2×", "₦1000"
  multiplier: string  // decimal string e.g. "0.00", "2.00"
  weight: number      // relative probability weight (not shown to user)
  color: string       // hex e.g. "#1A237E"
}

export interface WheelRecord {
  id: string
  wheel_type: WheelType
  name: string
  currency_type: 'coin' | 'cash'
  min_stake: string    // "0.00" for welcome/free wheels
  max_stake: string
  is_welcome_only: boolean
  rtp_target: string   // informational only — do NOT display to users
  /** Segment definitions from the backend — use these to draw the wheel */
  segments?: WheelSegmentAPI[]
}

// Spin — Result
export type SpinOutcomeType = 'win' | 'loss' | 'push' | 'partial_loss'

/** Spendable bucket a spin is staked from */
export type SpinSource = 'crypto_coins' | 'naira_coins' | 'bonus_coins'
/** Where a bonus-spin win lands (chosen at spin time) */
export type BonusDestination = 'crypto' | 'naira'

export interface SpinResult {
  id: string
  wheel: WheelRecord
  stake_amount: string
  /** 0-indexed position — pass to spinEngine.spinTo() */
  segment_position: number
  /** User-visible label e.g. "3×", "Loss", "₦1000" */
  segment_label: string
  multiplier: string
  /** Gross wheel payout (before the bonus haircut for bonus spins) */
  payout_amount: string
  /** Actual amount credited to the withdraw balance (esp. for bonus spins). May be absent on older responses. */
  net_credited?: string
  /** Currency of the payout — '' on a loss */
  payout_currency?: 'NGN' | 'USDT' | ''
  /** Which withdraw balance was credited — '' on a loss */
  credited_balance?: 'naira_withdraw' | 'crypto_withdraw' | ''
  /** Drive celebration UI from this, not multiplier */
  outcome: SpinOutcomeType
  /** Which coin wallet was used for this spin */
  source_wallet: SpinSource
  /** For bonus spins only */
  bonus_destination?: BonusDestination | ''
  segment_landed?: { label: string; multiplier: string }
  server_seed_hash?: string
  client_seed?: string | null
  nonce?: number
  is_welcome_spin?: boolean
  created_at: string
}

export interface SpinRequest {
  wheel_id: string
  stake_amount: string            // string decimal e.g. "500.00"
  source_wallet: SpinSource       // required — which balance to stake from
  bonus_destination?: BonusDestination  // required iff source_wallet === 'bonus_coins'
  client_seed?: string
}

// Referral
export interface ReferralInfo {
  referral_code: string
  referral_link: string
  total_referrals: number
  total_earned: string
}

// Deposits
export type DepositProvider = 'paystack' | 'nowpayments'
export type DepositStatus = 'pending' | 'completed' | 'failed' | 'expired'

export interface DepositRecord {
  id: string
  amount: string
  provider: DepositProvider
  status: DepositStatus
  internal_reference: string
  provider_reference: string
  payment_url: string        // Paystack — redirect user here
  payment_address: string    // NOWPayments — show as QR + copy
  original_amount: string | null   // NOWPayments — crypto amount to send
  original_currency: string        // NOWPayments — e.g. "BTC", "USDT"
  conversion_rate: string | null   // NOWPayments — NGN per crypto unit at lock time
  created_at: string
  completed_at: string | null
}

export interface DepositRequest {
  provider: 'paystack' | 'nowpayments'
  amount: string              // decimal string — NGN for paystack, USD for nowpayments
  pay_currency?: string       // required for nowpayments e.g. "btc", "usdt"
}

export interface CryptoCurrency {
  code: string        // e.g. "btc", "usdt"
  name: string        // e.g. "Bitcoin", "Tether USD"
  logo_url: string
  is_stable: boolean
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// Transactions (unified feed from /wallet/transactions/)
export type TransactionBalanceType =
  | 'naira_coins' | 'crypto_coins' | 'bonus_coins'
  | 'naira_withdraw' | 'crypto_withdraw' | 'staked'

export interface TransactionRecord {
  id: string
  type: 'deposit' | 'withdrawal' | 'win' | 'lock' | 'forfeit' | 'refund' | 'bonus' | 'spin_win' | 'spin_stake' | 'referral_bonus' | string
  balance_type: TransactionBalanceType | string
  currency?: 'NGN' | 'USDT' | string
  description?: string
  amount: string          // positive = credit, negative = debit
  balance_before?: string
  balance_after?: string
  reference_id?: string | null
  status: 'pending' | 'completed' | 'failed'
  metadata?: Record<string, unknown> | null
  created_at: string
}

// Withdrawals
export type WithdrawalStatus =
  | 'pending_review'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled'

export interface SavedBankAccount {
  id: string
  bank_code: string
  bank_name: string
  account_number_masked: string
  account_name: string
  is_default: boolean
  is_active: boolean
  verified_at: string
}

export interface WithdrawalBankAccount {
  id: string
  bank_code: string
  bank_name: string
  account_number_masked: string
  account_name: string
  is_active: boolean
  verified_at: string
}

export type WithdrawalRail = 'bank' | 'crypto'

export interface WithdrawalRecord {
  id: string
  rail: WithdrawalRail
  currency: 'NGN' | 'USDT'
  bank_account: WithdrawalBankAccount | null
  wallet_address: string
  network: string
  tx_hash: string
  amount: string
  fee: string
  net_amount: string
  status: WithdrawalStatus
  reference: string
  requires_review: boolean
  forced_manual_review?: boolean
  failure_reason: string
  requested_at: string
  completed_at: string | null
}

/** Payload for POST /withdrawals/ — bank or crypto rail */
export type WithdrawPayload =
  | { rail: 'bank'; amount: string; saved_account_id: string }
  | { rail: 'bank'; amount: string; bank_code: string; account_number: string }
  | { rail: 'crypto'; amount: string; saved_wallet_id: string }
  | { rail: 'crypto'; amount: string; wallet_address: string; network: 'TRC20' }

// Saved TRC-20 crypto wallet (v3)
export interface CryptoWallet {
  id: string
  network: string
  address: string
  address_masked: string
  label: string
  is_default: boolean
  is_active: boolean
  verified_at: string
}

// KYC
export type KYCOverallStatus = 'unverified' | 'pending' | 'partial' | 'approved' | 'rejected'
export type KYCSectionStatus = 'pending' | 'verified' | 'requires_correction' | 'rejected'

export interface KYCStatusResponse {
  overall_status: KYCOverallStatus
  /** True once NIN has been successfully verified — the account is locked after this */
  nin_verified: boolean
  /** Official name from the NIN provider — display in the locked verified card */
  nin_full_name: string
  personal_info_status: KYCSectionStatus
  personal_info_reason: string
  document_status: KYCSectionStatus
  document_reason: string
  can_withdraw: boolean
  submitted_at: string | null
  last_resubmission_at: string | null
}

export interface KYCBank {
  code: string
  name: string
}

export interface KYCDocumentUploadResponse {
  id: string
  document_type: string
  original_filename: string
  file_size_bytes: number
  content_type: string
  status: string
  uploaded_at: string
}

export interface KYCSubmitPayload {
  full_name: string
  nin: string             // 11 digits
  date_of_birth: string   // YYYY-MM-DD
  phone_number?: string
  document_id?: string
}

// Daily Reward
export interface DailyRewardStatus {
  can_claim: boolean
  current_streak: number
  next_reward_amount: number
  hours_until_next: number | null
}

// Challenges (player-facing)
export interface ChallengeProgress {
  progress_id?: string
  current_count: number
  target_count: number
  progress_pct: number
  is_completed: boolean
  completed_at: string | null
  /** True when completed and reward has not yet been claimed — show glowing Claim button */
  claimable: boolean
  reward_claimed: boolean
  reward_claimed_at: string | null
  window_start: string
  window_end: string | null
}

export interface ChallengeClaimResponse {
  reward_type: string
  amount: string
  credited_to: string
  /** Human-readable wallet label e.g. "Bonus Coins" — use in toast message */
  credited_to_label: string
  challenge_name: string
  message: string
}

export interface Challenge {
  id: string
  name: string
  description: string
  type: string
  recurrence: string
  criteria: Record<string, unknown>
  reward: {
    /** 'bonus_credit' | 'deposit_credit' | 'free_spins' | 'multiplier_boost'
     *  Legacy aliases: 'coins' (= bonus_credit), 'cash' (= deposit_credit) */
    type: string
    amount: number
  }
  is_active: boolean
  is_visible: boolean
  max_completions_per_user: number | null
  starts_at: string | null
  expires_at: string | null
  created_at: string
  participant_count: number
  completion_count: number
  my_progress: ChallengeProgress | null
}

// Referrals (player-facing)
export interface MyCodeData {
  referral_code: string   // the shareable code (was: code)
  share_url: string       // deep link e.g. https://t.me/SpinRewardsBot?start=ABC123
  total_referred: number
  total_earned: string
  pending_count: number
}

export interface MyReferralEntry {
  id: string
  referred_user_name: string   // flat string (was: referred_user.name)
  status: 'pending' | 'qualified' | 'rewarded' | 'rejected'
  joined_at: string
  first_deposit_at: string | null
  reward_earned: string | null
  created_at: string
}

export interface MyReferralsData {
  referrals: MyReferralEntry[]
}

// API error shape
export interface APIError {
  error: string
  code: string
  message: string
}
