import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { withdrawals as withdrawalsApi } from '@/api/endpoints'
import { useWalletStore } from '@/store/walletStore'
import { useTelegram } from '@/hooks/useTelegram'
import { formatNaira, formatDate } from '@/lib/format'
import type { WithdrawalLimits, WithdrawalRecord, WithdrawalStatus } from '@/types'
import styles from './WithdrawPage.module.css'

// ── Constants ────────────────────────────────────────────────────────────────

const TERMINAL: WithdrawalStatus[] = ['completed', 'failed', 'rejected', 'cancelled']

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusTitle(s: WithdrawalStatus): string {
  return (
    {
      pending_review: 'Awaiting Approval',
      pending:        'Queued',
      processing:     'Sending to Bank',
      completed:      'Sent ✓',
      failed:         'Transfer Failed',
      rejected:       'Rejected',
      cancelled:      'Cancelled',
    }[s] ?? s
  )
}

function statusIcon(s: WithdrawalStatus): string {
  return (
    {
      pending_review: '⏳',
      pending:        '🕐',
      processing:     '🏦',
      completed:      '✅',
      failed:         '❌',
      rejected:       '🚫',
      cancelled:      '↩️',
    }[s] ?? '💸'
  )
}

function statusIconClass(s: WithdrawalStatus, c: Record<string, string>): string {
  if (s === 'completed') return c.statusIconSuccess
  if (s === 'failed' || s === 'rejected') return c.statusIconFail
  if (s === 'processing' || s === 'pending') return c.statusIconProcess
  return c.statusIconPending
}

function pillClass(s: WithdrawalStatus, c: Record<string, string>): string {
  return (
    {
      pending_review: c.pillPendingReview,
      pending:        c.pillPending,
      processing:     c.pillProcessing,
      completed:      c.pillCompleted,
      failed:         c.pillFailed,
      rejected:       c.pillRejected,
      cancelled:      c.pillCancelled,
    }[s] ?? ''
  )
}

// ── Status screen (with polling) ─────────────────────────────────────────────

function StatusScreen({
  initial,
  onDone,
}: {
  initial: WithdrawalRecord
  onDone: () => void
}) {
  const navigate = useNavigate()
  const { setBalance } = useWalletStore()
  const [wd, setWd] = useState<WithdrawalRecord>(initial)
  const [cancelling, setCancelling] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Polling
  useEffect(() => {
    if (TERMINAL.includes(wd.status)) return

    const intervalMs = wd.status === 'pending_review' ? 30_000 : 4_000

    intervalRef.current = setInterval(async () => {
      try {
        const updated = await withdrawalsApi.get(wd.id)
        setWd(updated)
        if (TERMINAL.includes(updated.status)) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          // Refund or completion — refresh wallet balance
          withdrawalsApi.limits().then((l) => {
            setBalance(null as any, l.cash_balance, null as any)
          }).catch(() => {/* silent */})
        }
      } catch {
        // Network blip — keep trying
      }
    }, intervalMs)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [wd.id, wd.status, setBalance])

  async function handleCancel() {
    if (cancelling) return
    setCancelling(true)
    try {
      const updated = await withdrawalsApi.cancel(wd.id)
      setWd(updated)
      // Cash refunded — refresh balance
      withdrawalsApi.limits().then((l) => {
        setBalance(null as any, l.cash_balance, null as any)
      }).catch(() => {/* silent */})
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Could not cancel. Try again.')
    } finally {
      setCancelling(false)
    }
  }

  const isTerminal = TERMINAL.includes(wd.status)
  const isPendingReview = wd.status === 'pending_review'
  const isCompleted = wd.status === 'completed'
  const isFailed = wd.status === 'failed'
  const isRejected = wd.status === 'rejected'

  const bankLine = wd.bank_account
    ? `${wd.bank_account.bank_name} ${wd.bank_account.account_number_masked}`
    : 'Your verified bank account'

  return (
    <div className={styles.statusScreen}>
      {/* ── Hero ── */}
      <div className={styles.statusHero}>
        <div className={`${styles.statusIconWrap} ${statusIconClass(wd.status, styles)}`}>
          {statusIcon(wd.status)}
        </div>
        <p className={styles.statusTitle}>{statusTitle(wd.status)}</p>
        <p className={styles.statusAmount}>{formatNaira(wd.net_amount || wd.amount)}</p>
        <p className={styles.statusBank}>{bankLine}</p>
      </div>

      {/* ── Detail card ── */}
      <div className={styles.statusCard}>
        <div className={styles.statusRow}>
          <span className={styles.statusRowLabel}>Status</span>
          <span className={`${styles.statusPill} ${pillClass(wd.status, styles)}`}>
            {statusTitle(wd.status)}
          </span>
        </div>

        <div className={styles.statusDivider} />

        <div className={styles.statusRow}>
          <span className={styles.statusRowLabel}>Amount</span>
          <span className={styles.statusRowValue}>{formatNaira(wd.amount)}</span>
        </div>

        {parseFloat(wd.fee ?? '0') > 0 && (
          <div className={styles.statusRow}>
            <span className={styles.statusRowLabel}>Fee</span>
            <span className={styles.statusRowValue}>{formatNaira(wd.fee)}</span>
          </div>
        )}

        <div className={styles.statusRow}>
          <span className={styles.statusRowLabel}>Requested</span>
          <span className={styles.statusRowValue}>{formatDate(wd.requested_at)}</span>
        </div>

        {wd.completed_at && (
          <div className={styles.statusRow}>
            <span className={styles.statusRowLabel}>Completed</span>
            <span className={styles.statusRowValue}>{formatDate(wd.completed_at)}</span>
          </div>
        )}

        {wd.bank_account && (
          <>
            <div className={styles.statusDivider} />
            <div className={styles.statusRow}>
              <span className={styles.statusRowLabel}>Bank</span>
              <span className={styles.statusRowValue}>{wd.bank_account.bank_name}</span>
            </div>
            <div className={styles.statusRow}>
              <span className={styles.statusRowLabel}>Account</span>
              <span className={styles.statusRowValue}>{wd.bank_account.account_number_masked}</span>
            </div>
            <div className={styles.statusRow}>
              <span className={styles.statusRowLabel}>Name</span>
              <span className={styles.statusRowValue}>{wd.bank_account.account_name}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Context notes ── */}
      {isPendingReview && (
        <p className={styles.statusNote}>
          Your withdrawal is awaiting admin approval. This usually takes a few minutes during business hours.
        </p>
      )}
      {wd.status === 'processing' && (
        <p className={styles.statusNote}>
          Sending to your bank — usually completes within 1–5 minutes.
        </p>
      )}
      {(isFailed || isRejected) && wd.failure_reason && (
        <p className={`${styles.statusNote} ${styles.statusNoteError}`}>
          {wd.failure_reason}. Your funds have been returned to your wallet.
        </p>
      )}
      {(isFailed || isRejected) && !wd.failure_reason && (
        <p className={`${styles.statusNote} ${styles.statusNoteError}`}>
          Your funds have been returned to your wallet.
        </p>
      )}
      {isCompleted && (
        <p className={styles.statusNote}>
          Money has been sent to your bank account successfully. 🎉
        </p>
      )}

      {/* ── Polling indicator ── */}
      {!isTerminal && (
        <div className={styles.pollingRow}>
          <div className={styles.pollingDot} />
          <span>Checking for updates…</span>
        </div>
      )}

      {/* ── Actions ── */}
      <div className={styles.statusActions}>
        {isPendingReview && (
          <button
            className={styles.cancelBtn}
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling…' : 'Cancel Withdrawal'}
          </button>
        )}
        {isTerminal && (
          <button className={styles.primaryBtn} onClick={onDone}>
            Done
          </button>
        )}
        {!isTerminal && !isPendingReview && (
          <button
            className={styles.cancelBtn}
            style={{ borderColor: 'rgba(100,100,130,0.3)', color: '#60607a' }}
            onClick={() => navigate('/wallet')}
          >
            Back to Wallet
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function WithdrawPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { setBalance } = useWalletStore()

  const [limits, setLimits]     = useState<WithdrawalLimits | null>(null)
  const [loading, setLoading]   = useState(true)
  const [loadErr, setLoadErr]   = useState('')

  const [amount, setAmount]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr]   = useState('')

  const [activeWd, setActiveWd] = useState<WithdrawalRecord | null>(null)

  // Load limits
  useEffect(() => {
    withdrawalsApi.limits()
      .then(setLimits)
      .catch(() => setLoadErr('Could not load withdrawal info. Check your connection.'))
      .finally(() => setLoading(false))
  }, [])

  // Derived values
  const cash       = parseFloat(limits?.cash_balance ?? '0')
  const minWd      = parseFloat(limits?.min_withdrawal ?? '1000')
  const maxPerTxn  = parseFloat(limits?.max_per_transaction ?? '100000')
  const remaining  = parseFloat(limits?.remaining_today_amount ?? '0')
  const threshold  = parseFloat(limits?.auto_payout_threshold ?? '10000')
  const amtNum     = parseFloat(amount) || 0

  const maxAllowed = Math.min(cash, maxPerTxn, remaining)
  const willReview = amtNum >= threshold
  const isReady    = amtNum >= minWd && amtNum <= maxAllowed

  async function handleSubmit() {
    if (!isReady || submitting) return
    setSubmitting(true)
    setSubmitErr('')
    try {
      // Force manual review = true (pre-launch). Change to false when ready for auto-payout.
      const wd = await withdrawalsApi.request(amtNum.toFixed(2), true)
      setActiveWd(wd)
      haptic.notificationOccurred('success')
      // Refresh wallet balance (cash debited immediately)
      withdrawalsApi.limits().then((l) => {
        setBalance(null as any, l.cash_balance, null as any)
      }).catch(() => {/* silent */})
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Withdrawal failed. Please try again.'
      setSubmitErr(msg)
      haptic.notificationOccurred('error')
    } finally {
      setSubmitting(false)
    }
  }

  function handleDone() {
    setActiveWd(null)
    setAmount('')
    setSubmitErr('')
    // Reload limits (balance may have changed due to refund)
    setLoading(true)
    withdrawalsApi.limits()
      .then(setLimits)
      .catch(() => {/* keep old data */})
      .finally(() => setLoading(false))
  }

  // ── Render: active withdrawal status ──
  if (activeWd) {
    return <StatusScreen initial={activeWd} onDone={handleDone} />
  }

  // ── Render: loading ──
  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  // ── Render: load error ──
  if (loadErr) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠️</div>
          <p className={styles.emptyTitle}>Couldn't load</p>
          <p className={styles.emptySub}>{loadErr}</p>
          <button
            className={styles.emptyBtn}
            onClick={() => {
              setLoadErr('')
              setLoading(true)
              withdrawalsApi.limits().then(setLimits).catch(() => setLoadErr('Could not load withdrawal info.')).finally(() => setLoading(false))
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // ── Render: KYC gate ──
  if (!limits?.kyc_approved) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🪪</div>
          <p className={styles.emptyTitle}>Identity verification required</p>
          <p className={styles.emptySub}>Complete your KYC to unlock cash withdrawals.</p>
          <button className={styles.emptyBtn} onClick={() => navigate('/kyc')}>
            Verify Now
          </button>
        </div>
      </div>
    )
  }

  // ── Render: no balance ──
  if (cash <= 0) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎰</div>
          <p className={styles.emptyTitle}>No winnings yet</p>
          <p className={styles.emptySub}>Spin the wheel to win real cash, then come back to withdraw.</p>
          <button className={styles.emptyBtn} onClick={() => navigate('/')}>
            Spin Now
          </button>
        </div>
      </div>
    )
  }

  // ── Render: daily limit reached ──
  if ((limits?.remaining_today_count ?? 1) <= 0) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📅</div>
          <p className={styles.emptyTitle}>Daily limit reached</p>
          <p className={styles.emptySub}>
            You've made {limits?.max_daily_count} withdrawal{limits?.max_daily_count !== 1 ? 's' : ''} today.
            Come back tomorrow.
          </p>
          <button className={styles.emptyBtn} onClick={() => navigate('/wallet')}>
            Back to Wallet
          </button>
        </div>
      </div>
    )
  }

  // ── Render: form ──
  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/wallet')}>‹</button>
        <h1 className={styles.pageTitle}>Withdraw Earnings</h1>
      </div>

      {/* Balance card */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceLeft}>
          <div className={styles.balanceIcon}>💵</div>
          <div>
            <p className={styles.balanceLabel}>Available Balance</p>
            <p className={styles.balanceValue}>{formatNaira(limits!.cash_balance)}</p>
          </div>
        </div>
        <div className={styles.balanceLimits}>
          <p className={styles.balanceLimitRow}>
            Remaining today:{' '}
            <span className={styles.balanceLimitValue}>{formatNaira(limits!.remaining_today_amount)}</span>
          </p>
          <p className={styles.balanceLimitRow}>
            Withdrawals left:{' '}
            <span className={styles.balanceLimitValue}>{limits!.remaining_today_count}/{limits!.max_daily_count}</span>
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className={styles.formCard}>

        {/* Amount */}
        <div className={styles.amountWrap}>
          <label className={styles.label}>Amount</label>
          <div className={styles.amountRow}>
            <span className={styles.currencySymbol}>₦</span>
            <input
              className={styles.amountInput}
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              min={minWd}
              max={maxAllowed}
              onChange={(e) => {
                setAmount(e.target.value)
                setSubmitErr('')
              }}
            />
          </div>
          <div className={styles.amountHint}>
            <span>Min: {formatNaira(limits!.min_withdrawal)}</span>
            <span>Max: {formatNaira(maxAllowed.toString())}</span>
          </div>
        </div>

        {/* Admin review warning (above threshold) */}
        {willReview && amount !== '' && (
          <div className={styles.reviewWarning}>
            <span>⚠</span>
            <span>
              Withdrawals above {formatNaira(limits!.auto_payout_threshold)} require admin approval
              before processing. Usually approved within a few minutes.
            </span>
          </div>
        )}

        {/* Bank account info (from KYC) */}
        <div className={styles.bankInfoRow}>
          <span className={styles.bankInfoIcon}>🏦</span>
          <div className={styles.bankInfoText}>
            <p className={styles.bankInfoName}>Your verified bank account</p>
            <p className={styles.bankInfoSub}>Set up during KYC — funds sent here automatically</p>
          </div>
        </div>

        {/* Submit error */}
        {submitErr && (
          <p style={{ fontSize: 13, color: '#e83d3d' }}>⚠ {submitErr}</p>
        )}

        {/* Submit */}
        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={!isReady || submitting}
        >
          {submitting ? 'Submitting…' : 'Withdraw'}
        </button>
      </div>
    </div>
  )
}
