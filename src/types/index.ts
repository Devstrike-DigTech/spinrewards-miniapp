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

// Wallet
export interface WalletBalance {
  coin_balance: string
  cash_balance: string
  staked_balance: string
  total_balance: string
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

export interface SpinResult {
  id: string
  wheel: WheelRecord
  stake_amount: string
  /** 0-indexed position — pass to spinEngine.spinTo() */
  segment_position: number
  /** User-visible label e.g. "3×", "Loss", "₦1000" */
  segment_label: string
  multiplier: string
  /** Final NGN payout — already calculated */
  payout_amount: string
  /** Drive celebration UI from this, not multiplier */
  outcome: SpinOutcomeType
  server_seed_hash: string
  client_seed: string | null
  nonce: number
  is_welcome_spin: boolean
  created_at: string
}

export interface SpinRequest {
  wheel_id: string
  stake_amount: string   // string decimal e.g. "500.00"
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
export type DepositProvider = 'paystack' | 'monnify' | 'nowpayments'
export type DepositStatus = 'pending' | 'completed' | 'failed' | 'expired'

export interface DepositRecord {
  id: string
  amount: string
  provider: DepositProvider
  status: DepositStatus
  internal_reference: string
  provider_reference: string
  payment_url: string        // Paystack — redirect user here
  payment_address: string    // NOWPayments — show as QR + copy; Monnify VA details in text form
  original_amount: string | null   // NOWPayments — USDT amount to send
  original_currency: string        // NOWPayments — "USDT"
  conversion_rate: string | null   // NOWPayments — NGN per USDT at lock time
  created_at: string
  completed_at: string | null
}

export interface DepositRequest {
  amount: string   // string decimal e.g. "5000.00", min ₦100
  provider: DepositProvider
}

export interface VirtualAccount {
  id: string
  account_number: string
  account_name: string
  bank_name: string
  bank_code: string
  is_active: boolean
  created_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// Transactions (unified feed from /wallet/transactions/)
export interface TransactionRecord {
  id: string
  type: 'deposit' | 'withdrawal' | 'spin_win' | 'spin_stake' | 'referral_bonus' | string
  description: string
  amount: string          // positive = credit, negative = debit
  currency: 'coins' | 'cash'
  status: 'pending' | 'completed' | 'failed'
  created_at: string
}

// Withdrawals
export interface WithdrawalRequest {
  amount: number
  bank_code: string
  account_number: string
}

export interface WithdrawalRecord {
  id: string
  amount: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
}

// KYC
export type KYCOverallStatus = 'unverified' | 'pending' | 'partial' | 'approved' | 'rejected'
export type KYCSectionStatus = 'pending' | 'verified' | 'requires_correction' | 'rejected'

export interface KYCStatusResponse {
  overall_status: KYCOverallStatus
  personal_info_status: KYCSectionStatus
  personal_info_reason: string
  bank_account_status: KYCSectionStatus
  bank_account_reason: string
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
  nin: string
  bvn: string
  date_of_birth: string  // YYYY-MM-DD
  phone_number?: string
  bank_code: string
  account_number: string
  document_id: string
}

// Daily Reward
export interface DailyRewardStatus {
  can_claim: boolean
  current_streak: number
  next_reward_amount: number
  hours_until_next: number | null
}

// API error shape
export interface APIError {
  error: string
  code: string
  message: string
}
