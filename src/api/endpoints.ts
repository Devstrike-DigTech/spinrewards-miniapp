import { publicClient, apiClient } from './client'
import type {
  AuthResponse,
  WalletBalance,
  SpinRequest,
  SpinOutcome,
  RTPTier,
  ReferralInfo,
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
      .post<AuthResponse>('/auth/telegram/', { init_data: initData })
      .then((r) => r.data),
}

// User
export const users = {
  me: (): Promise<User> =>
    apiClient.get<User>('/users/me/').then((r) => r.data),
}

// Wallet
export const wallet = {
  balance: (): Promise<WalletBalance> =>
    apiClient.get<WalletBalance>('/wallet/').then((r) => r.data),
}

// Spin
export const spin = {
  tiers: (): Promise<RTPTier[]> =>
    apiClient.get<RTPTier[]>('/spin/tiers/').then((r) => r.data),

  execute: (payload: SpinRequest): Promise<SpinOutcome> =>
    apiClient.post<SpinOutcome>('/spin/', payload).then((r) => r.data),
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
