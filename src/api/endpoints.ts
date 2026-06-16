import { publicClient, apiClient } from './client'
import type {
  AuthResponse,
  WalletBalance,
  PublicSettings,
  SpinRequest,
  SpinResult,
  WheelRecord,
  ReferralInfo,
  DepositRequest,
  DepositRecord,
  CryptoCurrency,
  PaginatedResponse,
  WithdrawalRecord,
  WithdrawPayload,
  SavedBankAccount,
  CryptoWallet,
  KYCStatusResponse,
  KYCBank,
  KYCDocumentUploadResponse,
  KYCSubmitPayload,
  User,
  Challenge,
  ChallengeClaimResponse,
  MyCodeData,
  MyReferralsData,
  TransactionRecord,
} from '@/types'

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  telegram: (initData: string): Promise<AuthResponse> =>
    publicClient
      .post('/auth/telegram/', { init_data: initData })
      .then((r) => {
        const raw = r.data?.data ?? r.data
        return {
          user: raw.user,
          tokens: {
            access: raw.access_token ?? raw.access,
            refresh: raw.refresh_token ?? raw.refresh,
          },
        } satisfies AuthResponse
      }),
}

// ── User ──────────────────────────────────────────────────────────────────────

export const users = {
  me: (): Promise<User> =>
    apiClient.get('/users/me/').then((r) => r.data?.data ?? r.data),
}

// ── Public Settings (no auth, cached for session) ────────────────────────────

export const settings = {
  /** Fetch dynamic app config. Call once on launch and cache in settingsStore. */
  public: (): Promise<PublicSettings> =>
    publicClient.get('/settings/public/').then((r) => r.data?.data ?? r.data),
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export const wallet = {
  /** v3: balances live under data.wallet (top-level dupes kept for back-compat). */
  balance: (): Promise<WalletBalance> =>
    apiClient.get('/wallet/').then((r) => {
      const d = r.data?.data ?? r.data
      return (d?.wallet ?? d) as WalletBalance
    }),

  transactions: (page = 1, pageSize = 20): Promise<PaginatedResponse<TransactionRecord>> =>
    apiClient
      .get('/wallet/transactions/', { params: { page, page_size: pageSize } })
      .then((r) => r.data?.data ?? r.data),
}

// ── Deposits ─────────────────────────────────────────────────────────────────

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

  /** Available crypto currencies for the NOWPayments flow. */
  cryptoCurrencies: (): Promise<{ currencies: CryptoCurrency[] }> =>
    apiClient.get('/deposits/crypto/currencies/').then((r) => r.data?.data ?? r.data),
}

// ── Spin ──────────────────────────────────────────────────────────────────────

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
        return d?.wheel ?? d
      }),

  /**
   * Execute a spin. Call BEFORE starting animation — outcome is locked here.
   * Requires source_wallet to specify which coin balance is staked.
   */
  execute: (payload: SpinRequest): Promise<SpinResult> =>
    apiClient.post('/spin/', payload).then((r) => r.data?.data ?? r.data),

  /** Free one-time welcome spin. No wheel_id, stake, or source_wallet needed. */
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

// ── Referrals ─────────────────────────────────────────────────────────────────

export const referrals = {
  info: (): Promise<ReferralInfo> =>
    apiClient.get('/referrals/').then((r) => r.data?.data ?? r.data),

  /** My referral code, share URL, and summary stats. */
  myCode: (): Promise<MyCodeData> =>
    apiClient.get('/referrals/me/').then((r) => r.data?.data ?? r.data),

  /** List of users I have referred with their statuses. */
  myReferrals: (): Promise<MyReferralsData> =>
    apiClient.get('/referrals/list/').then((r) => r.data?.data ?? r.data),

  apply: (code: string): Promise<{ message: string; referral_id: string; referrer_name: string }> =>
    apiClient.post('/referrals/apply/', { referral_code: code }).then((r) => r.data?.data ?? r.data),
}

// ── Challenges ────────────────────────────────────────────────────────────────

export const challenges = {
  list: (): Promise<{ challenges: Challenge[] }> =>
    apiClient.get('/challenges/').then((r) => r.data?.data ?? r.data),

  get: (id: string): Promise<Challenge> =>
    apiClient.get(`/challenges/${id}/`).then((r) => r.data?.data ?? r.data),

  /**
   * Manually claim the reward for a completed challenge.
   * Only callable when my_progress.claimable === true.
   * Returns credited_to_label for the toast message.
   */
  claim: (id: string): Promise<ChallengeClaimResponse> =>
    apiClient
      .post(`/challenges/${id}/claim/`)
      .then((r) => r.data?.data ?? r.data),
}

// ── Withdrawals ───────────────────────────────────────────────────────────────

export const withdrawals = {
  /** Nigerian bank list for the dropdown (server-cached 24 h). */
  banks: (): Promise<{ banks: KYCBank[] }> =>
    apiClient.get('/withdrawals/banks/').then((r) => r.data?.data ?? r.data),

  /** List the user's saved & active bank accounts. Empty array = first withdrawal. */
  savedAccounts: (): Promise<{ accounts: SavedBankAccount[] }> =>
    apiClient.get('/withdrawals/saved-accounts/').then((r) => r.data?.data ?? r.data),

  /**
   * Verify a bank account against the user's KYC name and save it.
   * Throws NAME_MISMATCH (400) if names don't match.
   */
  addSavedAccount: (bankCode: string, accountNumber: string): Promise<SavedBankAccount> =>
    apiClient
      .post('/withdrawals/saved-accounts/', {
        bank_code: bankCode,
        account_number: accountNumber,
      })
      .then((r) => r.data?.data ?? r.data),

  /** Soft-delete a saved account. */
  deleteSavedAccount: (id: string): Promise<void> =>
    apiClient.delete(`/withdrawals/saved-accounts/${id}/`).then(() => undefined),

  /** Mark an account as the default for future withdrawals. */
  setDefault: (id: string): Promise<SavedBankAccount> =>
    apiClient
      .post(`/withdrawals/saved-accounts/${id}/set-default/`)
      .then((r) => r.data?.data ?? r.data),

  /**
   * Submit a withdrawal.
   * Pass { amount, saved_account_id } to use a saved account, or
   * { amount, bank_code, account_number } for inline verification + save.
   * Throws NAME_MISMATCH, KYC_REQUIRED, INSUFFICIENT_FUNDS, BELOW_MINIMUM.
   */
  submit: (payload: WithdrawPayload): Promise<WithdrawalRecord> =>
    apiClient.post('/withdrawals/', payload).then((r) => r.data?.data ?? r.data),

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

// ── Crypto wallets (v3 — saved TRC-20 payout addresses) ─────────────────────────

export const cryptoWallets = {
  list: (): Promise<{ wallets: CryptoWallet[] }> =>
    apiClient.get('/crypto-wallets/').then((r) => r.data?.data ?? r.data),

  /** Validate + save a TRC-20 address. Throws INVALID_WALLET_ADDRESS on bad format. */
  add: (address: string, label = '', setDefault = false): Promise<CryptoWallet> =>
    apiClient
      .post('/crypto-wallets/', { address, network: 'TRC20', label, set_default: setDefault })
      .then((r) => r.data?.data ?? r.data),

  setDefault: (id: string): Promise<CryptoWallet> =>
    apiClient
      .patch(`/crypto-wallets/${id}/`, { action: 'set_default' })
      .then((r) => r.data?.data ?? r.data),

  remove: (id: string): Promise<void> =>
    apiClient.delete(`/crypto-wallets/${id}/`).then(() => undefined),
}

// ── KYC ───────────────────────────────────────────────────────────────────────

export const kyc = {
  /** Current KYC status — always call first when opening the KYC screen. */
  status: (): Promise<KYCStatusResponse> =>
    apiClient.get('/kyc/status/').then((r) => r.data?.data ?? r.data),

  /** Nigerian bank list (alias of /withdrawals/banks/ for compatibility). */
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
   * Submit (or resubmit) the KYC form.
   * Only collects: full_name, nin, date_of_birth, phone_number, document_id.
   * BVN and bank account are NO LONGER part of KYC — bank verification happens at withdrawal.
   */
  submit: (payload: KYCSubmitPayload): Promise<KYCStatusResponse> =>
    apiClient.post('/kyc/submit/', payload).then((r) => r.data?.data ?? r.data),
}
