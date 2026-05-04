import { publicClient, apiClient } from './client'
import type {
  AuthResponse,
  WalletBalance,
  SpinRequest,
  SpinResult,
  WheelRecord,
  ReferralInfo,
  DepositRequest,
  DepositRecord,
  VirtualAccount,
  PaginatedResponse,
  WithdrawalRequest,
  WithdrawalRecord,
  KYCSubmission,
  KYCStatus,
  DailyRewardStatus,
  User,
} from '@/types'

// Auth
export const auth = {
  telegram: (initData: string): Promise<AuthResponse> =>
    publicClient
      .post('/auth/telegram/', { init_data: initData })
      .then((r) => {
        // Backend wraps response in { data: { ... } } — unwrap if present
        const raw = r.data?.data ?? r.data
        // Backend uses access_token/refresh_token — normalise to access/refresh
        return {
          user: raw.user,
          tokens: {
            access: raw.access_token ?? raw.access,
            refresh: raw.refresh_token ?? raw.refresh,
          },
        } satisfies AuthResponse
      }),
}

// User
export const users = {
  me: (): Promise<User> =>
    apiClient.get('/users/me/').then((r) => r.data?.data ?? r.data),
}

// Wallet
export const wallet = {
  balance: (): Promise<WalletBalance> =>
    apiClient.get('/wallet/').then((r) => r.data?.data ?? r.data),

  transactions: (page = 1, pageSize = 20) =>
    apiClient
      .get('/wallet/transactions/', { params: { page, page_size: pageSize } })
      .then((r) => r.data?.data ?? r.data),
}

// Deposits
export const deposits = {
  /** Initiate a deposit. Returns provider-specific fields (payment_url / payment_address). */
  initiate: (payload: DepositRequest): Promise<DepositRecord> =>
    apiClient.post('/deposits/', payload).then((r) => r.data?.data ?? r.data),

  /** Poll this after Paystack redirect until status !== 'pending'. */
  get: (id: string): Promise<DepositRecord> =>
    apiClient.get(`/deposits/${id}/`).then((r) => r.data?.data ?? r.data),

  /** Paginated deposit history. */
  list: (page = 1): Promise<PaginatedResponse<DepositRecord>> =>
    apiClient
      .get('/deposits/list/', { params: { page } })
      .then((r) => r.data?.data ?? r.data),

  /** Get (or create) the user's permanent Monnify virtual account. */
  virtualAccount: (): Promise<VirtualAccount> =>
    apiClient.get('/deposits/virtual-account/').then((r) => r.data?.data ?? r.data),
}

// Spin
export const spin = {
  /**
   * List ALL wheels (includes inactive). Use activeWheels() for normal user flow.
   * Only use this for admin/debug views.
   */
  wheels: (): Promise<WheelRecord[]> =>
    apiClient.get('/spin/wheels/').then((r) => {
      const d = r.data?.data ?? r.data
      return Array.isArray(d) ? d : (d?.wheels ?? [])
    }),

  /**
   * List active wheels only. Use this on app startup.
   * Welcome wheel is auto-excluded after first use.
   */
  activeWheels: (): Promise<WheelRecord[]> =>
    apiClient.get('/spin/wheels/active/').then((r) => {
      const d = r.data?.data ?? r.data
      return Array.isArray(d) ? d : (d?.wheels ?? [])
    }),

  /**
   * Given a stake amount, returns the single wheel whose range matches.
   * Range is [min_stake, max_stake) — inclusive lower, exclusive upper.
   * Throws with code NO_WHEEL_FOR_STAKE (404) if no wheel matches.
   */
  forStake: (amount: number): Promise<WheelRecord> =>
    apiClient
      .get('/spin/wheels/for-stake/', { params: { amount } })
      .then((r) => {
        const d = r.data?.data ?? r.data
        // Backend wraps in { wheel: { ... } }
        return d?.wheel ?? d
      }),

  /** Execute a spin. Call BEFORE starting animation. Outcome is locked here. */
  execute: (payload: SpinRequest): Promise<SpinResult> =>
    apiClient.post('/spin/', payload).then((r) => r.data?.data ?? r.data),

  /** Free one-time welcome spin. No wheel_id or stake needed. */
  welcome: (clientSeed?: string): Promise<SpinResult> =>
    apiClient
      .post('/spin/welcome/', clientSeed ? { client_seed: clientSeed } : {})
      .then((r) => r.data?.data ?? r.data),

  /** Paginated spin history, newest first. */
  history: (page = 1): Promise<PaginatedResponse<SpinResult>> =>
    apiClient
      .get('/spin/history/', { params: { page } })
      .then((r) => r.data?.data ?? r.data),
}

// Referrals
export const referrals = {
  info: (): Promise<ReferralInfo> =>
    apiClient.get<ReferralInfo>('/referrals/').then((r) => r.data),
}

// Withdrawals
export const withdrawals = {
  request: (payload: WithdrawalRequest): Promise<WithdrawalRecord> =>
    apiClient
      .post<WithdrawalRecord>('/withdrawals/', payload)
      .then((r) => r.data),

  list: (): Promise<WithdrawalRecord[]> =>
    apiClient.get<WithdrawalRecord[]>('/withdrawals/').then((r) => r.data),
}

// KYC
export const kyc = {
  status: (): Promise<KYCStatus> =>
    apiClient.get<KYCStatus>('/kyc/').then((r) => r.data),

  submit: (payload: KYCSubmission): Promise<void> =>
    apiClient.post('/kyc/', payload).then(() => undefined),
}

// Daily reward
export const rewards = {
  status: (): Promise<DailyRewardStatus> =>
    apiClient.get<DailyRewardStatus>('/rewards/daily/').then((r) => r.data),

  claim: (): Promise<{ amount_credited: number }> =>
    apiClient
      .post<{ amount_credited: number }>('/rewards/daily/claim/')
      .then((r) => r.data),
}
