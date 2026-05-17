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
  WithdrawalRecord,
  WithdrawalLimits,
  KYCStatusResponse,
  KYCBank,
  KYCDocumentUploadResponse,
  KYCSubmitPayload,
  DailyRewardStatus,
  User,
  Challenge,
  MyCodeData,
  MyReferralsData,
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

  myCode: (): Promise<MyCodeData> =>
    apiClient.get('/referrals/my-code/').then((r) => r.data?.data ?? r.data),

  myReferrals: (): Promise<MyReferralsData> =>
    apiClient.get('/referrals/my-referrals/').then((r) => r.data?.data ?? r.data),

  apply: (code: string): Promise<{ message: string; referral_id: string; referrer_name: string }> =>
    apiClient.post('/referrals/apply/', { code }).then((r) => r.data?.data ?? r.data),
}

// Challenges
export const challenges = {
  list: (): Promise<{ challenges: Challenge[] }> =>
    apiClient.get('/challenges/').then((r) => r.data?.data ?? r.data),

  get: (id: string): Promise<Challenge> =>
    apiClient.get(`/challenges/${id}/`).then((r) => r.data?.data ?? r.data),
}

// Withdrawals
export const withdrawals = {
  /** Current limits + live balance. Call first when opening the withdraw screen. */
  limits: (): Promise<WithdrawalLimits> =>
    apiClient.get('/withdrawals/limits/').then((r) => r.data?.data ?? r.data),

  /**
   * Request a withdrawal. `forceManualReview` routes to the /manual-review/ endpoint
   * (admin always reviews, regardless of amount). Set to false to use the tiered auto-flow.
   * Currently defaulting to true (pre-launch mode) — flip to false when ready.
   */
  request: (amount: string, forceManualReview = true): Promise<WithdrawalRecord> => {
    const endpoint = forceManualReview
      ? '/withdrawals/manual-review/'
      : '/withdrawals/'
    return apiClient.post(endpoint, { amount }).then((r) => r.data?.data ?? r.data)
  },

  /** Paginated withdrawal history, newest first. */
  list: (page = 1): Promise<PaginatedResponse<WithdrawalRecord>> =>
    apiClient
      .get('/withdrawals/list/', { params: { page } })
      .then((r) => r.data?.data ?? r.data),

  /** Get a single withdrawal — use for status polling. */
  get: (id: string): Promise<WithdrawalRecord> =>
    apiClient.get(`/withdrawals/${id}/`).then((r) => r.data?.data ?? r.data),

  /** Cancel a withdrawal. Only valid when status === 'pending_review'. */
  cancel: (id: string): Promise<WithdrawalRecord> =>
    apiClient
      .post(`/withdrawals/${id}/cancel/`)
      .then((r) => r.data?.data ?? r.data),
}

// KYC
export const kyc = {
  /** Current KYC status — always call first when opening the KYC screen. */
  status: (): Promise<KYCStatusResponse> =>
    apiClient.get('/kyc/status/').then((r) => r.data?.data ?? r.data),

  /** Nigerian bank list for the dropdown — server-cached 24 h. */
  banks: (): Promise<KYCBank[]> =>
    apiClient.get('/kyc/banks/').then((r) => {
      const d = r.data?.data ?? r.data
      return d?.banks ?? d
    }),

  /**
   * Upload a utility bill or bank statement BEFORE submitting.
   * Returns the document_id to include in submit payload.
   * Do NOT manually set Content-Type — axios handles the multipart boundary.
   */
  uploadDocument: (
    file: File,
    documentType: 'utility_bill' | 'bank_statement' = 'utility_bill'
  ): Promise<KYCDocumentUploadResponse> => {
    const form = new FormData()
    form.append('file', file)
    form.append('document_type', documentType)
    return apiClient.post('/kyc/upload-document/', form).then((r) => r.data?.data ?? r.data)
  },

  /**
   * Live bank account lookup — debounce 300 ms before calling.
   * Triggers when bank_code AND account_number (10 digits) are both filled.
   * Returns the account name string.
   */
  resolveBank: (bankCode: string, accountNumber: string): Promise<string> =>
    apiClient
      .post('/kyc/resolve-bank/', { bank_code: bankCode, account_number: accountNumber })
      .then((r) => {
        const d = r.data?.data ?? r.data
        return (d?.account_name ?? d) as string
      }),

  /** Submit (or resubmit) the KYC form. Returns full status snapshot. */
  submit: (payload: KYCSubmitPayload): Promise<KYCStatusResponse> =>
    apiClient.post('/kyc/submit/', payload).then((r) => r.data?.data ?? r.data),
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
