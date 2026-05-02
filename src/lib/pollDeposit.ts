import { deposits } from '@/api/endpoints'
import type { DepositRecord } from '@/types'

export type PollResult =
  | { success: true; deposit: DepositRecord }
  | { success: false; reason: 'failed' | 'expired' | 'timeout' }

/**
 * Poll a deposit until it leaves the pending state.
 *
 * Paystack / Monnify:   intervalMs=3000, maxAttempts=60  (3 min)
 * NOWPayments (crypto): intervalMs=3000, maxAttempts=300 (15 min)
 *
 * Returns as soon as status is completed/failed/expired, or after timeout.
 * A timeout does NOT mean the payment failed — webhooks can be delayed.
 */
export async function pollDeposit(
  depositId: string,
  {
    maxAttempts = 60,
    intervalMs = 3000,
    onPoll,
  }: {
    maxAttempts?: number
    intervalMs?: number
    /** Called after each poll with the latest deposit record. */
    onPoll?: (deposit: DepositRecord) => void
  } = {}
): Promise<PollResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const deposit = await deposits.get(depositId)
    onPoll?.(deposit)

    if (deposit.status === 'completed') return { success: true, deposit }
    if (deposit.status === 'failed')    return { success: false, reason: 'failed' }
    if (deposit.status === 'expired')   return { success: false, reason: 'expired' }

    await new Promise((r) => setTimeout(r, intervalMs))
  }

  return { success: false, reason: 'timeout' }
}
