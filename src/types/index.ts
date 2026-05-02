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

// Spin
export interface SpinOutcome {
  label: string
  multiplier: string
  coin_won: string
  cash_won: string
  new_coin_balance: string
  new_cash_balance: string
}

export interface SpinRequest {
  stake_amount: number
  idempotency_key: string
}

// RTP
export interface RTPOutcome {
  id: string
  label: string
  multiplier: string
  probability: string
  color: string
}

export interface RTPTier {
  id: string
  min_stake: string
  max_stake: string
  rtp_target: string
  outcomes: RTPOutcome[]
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
export interface KYCSubmission {
  nin: string
  bank_code: string
  account_number: string
}

export interface KYCStatus {
  status: 'unverified' | 'pending' | 'approved' | 'rejected'
  rejection_reason?: string
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
