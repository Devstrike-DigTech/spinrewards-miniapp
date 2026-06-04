import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { withdrawals as withdrawalsApi, wallet, kyc as kycApi } from '@/api/endpoints'
import { useWalletStore } from '@/store/walletStore'
import { useTelegram } from '@/hooks/useTelegram'
import { formatNaira, formatDate } from '@/lib/format'
import type {
  SavedBankAccount,
  KYCBank,
  WithdrawalRecord,
  WithdrawalStatus,
} from '@/types'
import styles from './WithdrawPage.module.css'

// ── Constants ────────────────────────────────────────────────────────────────

const TERMINAL: WithdrawalStatus[] = ['completed', 'failed', 'rejected', 'cancelled']
const MIN_WITHDRAWAL = 1000 // fallback if we can't derive from backend

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

// ── Status Screen (polling) ──────────────────────────────────────────────────

function StatusScreen({ initial, onDone }: { initial: WithdrawalRecord; onDone: () => void }) {
  const navigate = useNavigate()
  const { setBalance } = useWalletStore()
  const [wd, setWd] = useState<WithdrawalRecord>(initial)
  const [cancelling, setCancelling] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (TERMINAL.includes(wd.status)) return
    const ms = wd.status === 'pending_review' ? 30_000 : 4_000
    intervalRef.current = setInterval(async () => {
      try {
        const updated = await withdrawalsApi.get(wd.id)
        setWd(updated)
        if (TERMINAL.includes(updated.status)) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          wallet.balance().then(setBalance).catch(() => {})
        }
      } catch { /* keep trying */ }
    }, ms)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [wd.id, wd.status, setBalance])

  async function handleCancel() {
    if (cancelling) return
    setCancelling(true)
    try {
      const updated = await withdrawalsApi.cancel(wd.id)
      setWd(updated)
      wallet.balance().then(setBalance).catch(() => {})
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
      <div className={styles.statusHero}>
        <div className={`${styles.statusIconWrap} ${statusIconClass(wd.status, styles)}`}>
          {statusIcon(wd.status)}
        </div>
        <p className={styles.statusTitle}>{statusTitle(wd.status)}</p>
        <p className={styles.statusAmount}>{formatNaira(wd.net_amount || wd.amount)}</p>
        <p className={styles.statusBank}>{bankLine}</p>
      </div>

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

      {isPendingReview && (
        <p className={styles.statusNote}>
          Your withdrawal is awaiting admin approval. Usually approved within a few minutes during business hours.
        </p>
      )}
      {wd.status === 'processing' && (
        <p className={styles.statusNote}>Sending to your bank — usually completes within 1–5 minutes.</p>
      )}
      {(isFailed || isRejected) && (
        <p className={`${styles.statusNote} ${styles.statusNoteError}`}>
          {wd.failure_reason
            ? `${wd.failure_reason}. Your funds have been returned to your wallet.`
            : 'Your funds have been returned to your wallet.'}
        </p>
      )}
      {isCompleted && (
        <p className={styles.statusNote}>Money has been sent to your bank account successfully. 🎉</p>
      )}

      {!isTerminal && (
        <div className={styles.pollingRow}>
          <div className={styles.pollingDot} />
          <span>Checking for updates…</span>
        </div>
      )}

      <div className={styles.statusActions}>
        {isPendingReview && (
          <button className={styles.cancelBtn} onClick={handleCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel Withdrawal'}
          </button>
        )}
        {isTerminal && (
          <button className={styles.primaryBtn} onClick={onDone}>Done</button>
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

// ── Name Mismatch Screen ─────────────────────────────────────────────────────

function NameMismatchScreen({
  accountNumber,
  bankReturnedName,
  onTryAgain,
}: {
  accountNumber: string
  bankReturnedName: string
  onTryAgain: () => void
}) {
  return (
    <div className={styles.page}>
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🔍</div>
        <p className={styles.emptyTitle}>Account Name Mismatch</p>
        <p className={styles.emptySub}>
          The account <strong style={{ color: '#fff' }}>{accountNumber}</strong> is in the name of:
        </p>
        <div className={styles.mismatchName}>{bankReturnedName}</div>
        <p className={styles.emptySub}>
          This doesn't match the name on your verified identity. Please use a bank account in your own name.
        </p>
        <button className={styles.emptyBtn} onClick={onTryAgain}>
          Try Another Account
        </button>
      </div>
    </div>
  )
}

// ── Saved Account Item ───────────────────────────────────────────────────────

function SavedAccountItem({
  account,
  selected,
  onSelect,
  onDelete,
  deleting,
}: {
  account: SavedBankAccount
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div
      className={`${styles.accountItem} ${selected ? styles.accountItemSelected : ''}`}
      onClick={onSelect}
    >
      <div className={`${styles.accountRadio} ${selected ? styles.accountRadioSelected : ''}`} />
      <div className={styles.accountInfo}>
        <p className={styles.accountBank}>
          {account.bank_name}
          {account.is_default && <span className={styles.defaultBadge}>Default</span>}
        </p>
        <p className={styles.accountNumber}>{account.account_number_masked}</p>
        <p className={styles.accountName}>{account.account_name}</p>
      </div>
      <button
        className={styles.accountDeleteBtn}
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        disabled={deleting}
      >
        {deleting ? '…' : '✕'}
      </button>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

type ScreenView = 'loading' | 'kyc_required' | 'no_earnings' | 'form' | 'status' | 'name_mismatch'

export function WithdrawPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { earnings, setBalance } = useWalletStore()

  const [view, setView] = useState<ScreenView>('loading')
  const [loadErr, setLoadErr] = useState('')

  // Data
  const [savedAccounts, setSavedAccounts] = useState<SavedBankAccount[]>([])
  const [banks, setBanks] = useState<KYCBank[]>([])
  const [earnings_amount, setEarnings] = useState<string>('0')

  // Form state
  const [amount, setAmount] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [showBankForm, setShowBankForm] = useState(false)
  const [bankCode, setBankCode] = useState('')
  const [accountNo, setAccountNo] = useState('')

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Name mismatch
  const [mismatchName, setMismatchName] = useState('')
  const [mismatchAccNo, setMismatchAccNo] = useState('')

  // Active withdrawal (status screen)
  const [activeWd, setActiveWd] = useState<WithdrawalRecord | null>(null)

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setView('loading')
    setLoadErr('')
    try {
      const [balRes, kycRes, accountsRes, banksRes] = await Promise.allSettled([
        wallet.balance(),
        kycApi.status(),
        withdrawalsApi.savedAccounts(),
        withdrawalsApi.banks(),
      ])

      if (balRes.status === 'fulfilled') {
        setBalance(balRes.value)
        setEarnings(balRes.value.earnings)
      }

      if (kycRes.status === 'fulfilled') {
        const canWd = kycRes.value.nin_verified || kycRes.value.can_withdraw
        if (!canWd) { setView('kyc_required'); return }
      }

      const earningsNum = parseFloat(
        balRes.status === 'fulfilled' ? balRes.value.earnings : '0'
      )
      if (earningsNum <= 0) { setView('no_earnings'); return }

      if (accountsRes.status === 'fulfilled') {
        const accts = accountsRes.value.accounts ?? []
        setSavedAccounts(accts)
        // Pre-select default account
        const def = accts.find(a => a.is_default) ?? accts[0]
        if (def) setSelectedAccountId(def.id)
        // Show bank form if no accounts exist
        if (accts.length === 0) setShowBankForm(true)
      }

      if (banksRes.status === 'fulfilled') {
        setBanks(banksRes.value.banks ?? [])
      }

      setView('form')
    } catch {
      setLoadErr('Could not load withdrawal info. Check your connection.')
      setView('form')
    }
  }, [setBalance])

  useEffect(() => { loadData() }, [loadData])

  // ── Delete saved account ──────────────────────────────────────────────────
  async function handleDeleteAccount(id: string) {
    if (!window.confirm('Remove this bank account?')) return
    setDeletingId(id)
    try {
      await withdrawalsApi.deleteSavedAccount(id)
      const updated = savedAccounts.filter(a => a.id !== id)
      setSavedAccounts(updated)
      if (selectedAccountId === id) {
        const next = updated[0]
        setSelectedAccountId(next?.id ?? '')
      }
      if (updated.length === 0) setShowBankForm(true)
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Could not remove account.')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (submitting) return
    const amtNum = parseFloat(amount)
    if (!amount || isNaN(amtNum) || amtNum < MIN_WITHDRAWAL) return

    setSubmitting(true)
    setSubmitErr('')

    try {
      let wd: WithdrawalRecord

      if (showBankForm || !selectedAccountId) {
        // Inline bank details
        if (!bankCode || accountNo.length !== 10) {
          setSubmitErr('Please select a bank and enter a 10-digit account number.')
          return
        }
        wd = await withdrawalsApi.submit({
          amount: amtNum,
          bank_code: bankCode,
          account_number: accountNo,
        })
        // Account was saved automatically — reload list
        withdrawalsApi.savedAccounts().then(r => {
          const accts = r.accounts ?? []
          setSavedAccounts(accts)
          setShowBankForm(false)
          const def = accts.find(a => a.is_default) ?? accts[0]
          if (def) setSelectedAccountId(def.id)
        }).catch(() => {})
      } else {
        // Saved account
        wd = await withdrawalsApi.submit({
          amount: amtNum,
          saved_account_id: selectedAccountId,
        })
      }

      setActiveWd(wd)
      haptic.notificationOccurred('success')
      // Refresh wallet — earnings debited
      wallet.balance().then(setBalance).catch(() => {})
    } catch (err: any) {
      const code = err?.response?.data?.code
      const msg  = err?.response?.data?.message ?? 'Withdrawal failed. Please try again.'

      if (code === 'NAME_MISMATCH') {
        setMismatchName(err.response.data.account_name ?? 'Unknown')
        setMismatchAccNo(accountNo)
        setView('name_mismatch')
      } else if (code === 'KYC_REQUIRED') {
        setView('kyc_required')
      } else {
        setSubmitErr(msg)
        haptic.notificationOccurred('error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleDone() {
    setActiveWd(null)
    setAmount('')
    setSubmitErr('')
    loadData()
  }

  // ── Renders ───────────────────────────────────────────────────────────────

  if (activeWd) {
    return <StatusScreen initial={activeWd} onDone={handleDone} />
  }

  if (view === 'name_mismatch') {
    return (
      <NameMismatchScreen
        accountNumber={mismatchAccNo}
        bankReturnedName={mismatchName}
        onTryAgain={() => {
          setBankCode('')
          setAccountNo('')
          setSubmitErr('')
          setView('form')
        }}
      />
    )
  }

  if (view === 'loading') {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (loadErr && view !== 'form') {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠️</div>
          <p className={styles.emptyTitle}>Couldn't load</p>
          <p className={styles.emptySub}>{loadErr}</p>
          <button className={styles.emptyBtn} onClick={loadData}>Try Again</button>
        </div>
      </div>
    )
  }

  if (view === 'kyc_required') {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🪪</div>
          <p className={styles.emptyTitle}>Identity verification required</p>
          <p className={styles.emptySub}>Complete your KYC to unlock cash withdrawals.</p>
          <button className={styles.emptyBtn} onClick={() => navigate('/kyc')}>Verify Now</button>
        </div>
      </div>
    )
  }

  if (view === 'no_earnings') {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎰</div>
          <p className={styles.emptyTitle}>No earnings yet</p>
          <p className={styles.emptySub}>Spin the wheel to win real cash, then come back to withdraw.</p>
          <button className={styles.emptyBtn} onClick={() => navigate('/')}>Spin Now</button>
        </div>
      </div>
    )
  }

  const earningsNum = parseFloat(earnings_amount || earnings || '0')
  const amtNum = parseFloat(amount) || 0
  const isReady = amtNum >= MIN_WITHDRAWAL && amtNum <= earningsNum && (
    showBankForm
      ? (bankCode !== '' && accountNo.length === 10)
      : !!selectedAccountId
  )

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
            <p className={styles.balanceLabel}>Available Earnings</p>
            <p className={styles.balanceValue}>{formatNaira(String(earningsNum))}</p>
          </div>
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
              min={MIN_WITHDRAWAL}
              max={earningsNum}
              onChange={(e) => { setAmount(e.target.value); setSubmitErr('') }}
            />
          </div>
          <div className={styles.amountHint}>
            <span>Min: {formatNaira(String(MIN_WITHDRAWAL))}</span>
            <span>Max: {formatNaira(String(earningsNum))}</span>
          </div>
        </div>

        {/* ── Send to ── */}
        <div>
          <p className={styles.label} style={{ marginBottom: 10 }}>Send to</p>

          {/* Saved accounts list */}
          {!showBankForm && savedAccounts.length > 0 && (
            <div className={styles.accountsList}>
              {savedAccounts.map((acct) => (
                <SavedAccountItem
                  key={acct.id}
                  account={acct}
                  selected={selectedAccountId === acct.id}
                  onSelect={() => setSelectedAccountId(acct.id)}
                  onDelete={() => handleDeleteAccount(acct.id)}
                  deleting={deletingId === acct.id}
                />
              ))}
              <button
                className={styles.addAccountBtn}
                onClick={() => { setShowBankForm(true); setBankCode(''); setAccountNo('') }}
              >
                + Add new account
              </button>
            </div>
          )}

          {/* Bank form */}
          {showBankForm && (
            <div className={styles.bankFormWrap}>
              {savedAccounts.length > 0 && (
                <button
                  className={styles.backToAccountsBtn}
                  onClick={() => { setShowBankForm(false); setSubmitErr('') }}
                >
                  ← Use saved account
                </button>
              )}

              {/* Bank selector */}
              <div className={styles.bankFormGroup}>
                <label className={styles.bankFormLabel}>Bank</label>
                <select
                  className={styles.bankSelect}
                  value={bankCode}
                  onChange={(e) => { setBankCode(e.target.value); setSubmitErr('') }}
                >
                  <option value="">Select bank</option>
                  {banks.map((b) => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Account number */}
              <div className={styles.bankFormGroup}>
                <label className={styles.bankFormLabel}>Account Number</label>
                <input
                  className={styles.bankInput}
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={accountNo}
                  onChange={(e) => { setAccountNo(e.target.value.replace(/\D/g, '')); setSubmitErr('') }}
                  placeholder="10-digit account number"
                />
                <p className={styles.bankInputHint}>
                  Account name will be verified against your NIN on submission
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Submit error */}
        {submitErr && (
          <p style={{ fontSize: 13, color: '#e83d3d' }}>⚠ {submitErr}</p>
        )}

        {/* Crypto option — coming soon */}
        <div className={styles.cryptoComingSoon}>
          <span>₿</span>
          <span>Crypto withdrawal — coming soon</span>
        </div>

        {/* Submit */}
        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={!isReady || submitting}
        >
          {submitting ? 'Submitting…' : `Withdraw ${amount ? formatNaira(amount) : ''}`}
        </button>
      </div>
    </div>
  )
}
