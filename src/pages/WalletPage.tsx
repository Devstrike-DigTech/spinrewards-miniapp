import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { wallet, kyc, withdrawals as withdrawalsApi } from '@/api/endpoints'
import { useWalletStore } from '@/store/walletStore'
import { useSettingsStore, bonusPayoutLabel } from '@/store/settingsStore'
import { formatNaira, formatCoins, formatDate } from '@/lib/format'
import { FundWalletModal } from '@/components/FundWalletModal/FundWalletModal'
import type { TransactionRecord, KYCStatusResponse, WithdrawalRecord, WithdrawalStatus } from '@/types'
import styles from './WalletPage.module.css'

export function WalletPage() {
  const navigate = useNavigate()
  const {
    depositCoins, bonusCoins, earnings, earningsUsd, staked,
    setBalance,
  } = useWalletStore()
  const { settings } = useSettingsStore()
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [recentWithdrawals, setRecentWithdrawals] = useState<WithdrawalRecord[]>([])
  const [kycStatus, setKycStatus] = useState<KYCStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showFund, setShowFund] = useState(false)

  const loadData = useCallback(() => {
    setIsLoading(true)
    Promise.allSettled([
      wallet.balance(),
      wallet.transactions(1, 20),
      kyc.status(),
      withdrawalsApi.list(1),
    ]).then(([balanceResult, txResult, kycResult, wdResult]) => {
      if (balanceResult.status === 'fulfilled') {
        setBalance(balanceResult.value)
      }
      if (txResult.status === 'fulfilled') {
        const data = txResult.value
        const list = Array.isArray(data) ? data : (data?.results ?? [])
        setTransactions(list)
      }
      if (kycResult.status === 'fulfilled') {
        setKycStatus(kycResult.value)
      }
      if (wdResult.status === 'fulfilled') {
        const d = wdResult.value
        const list = Array.isArray(d) ? d : (d?.results ?? [])
        setRecentWithdrawals(list.slice(0, 5))
      }

      const allFailed = [balanceResult, txResult, kycResult].every(r => r.status === 'rejected')
      if (allFailed) {
        setLoadError('Could not load wallet data. Check your connection and try again.')
      } else {
        setLoadError(null)
      }
    }).finally(() => setIsLoading(false))
  }, [setBalance])

  useEffect(() => { loadData() }, [loadData])

  const handleFundSuccess = useCallback(() => {
    setShowFund(false)
    loadData()
  }, [loadData])

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Wallet</h1>
        <p className={styles.loadError}>{loadError}</p>
        <button className={styles.retryBtn} onClick={loadData}>Retry</button>
      </div>
    )
  }

  const kycVerified = kycStatus?.nin_verified === true || kycStatus?.overall_status === 'approved'
  const earningsNum = parseFloat(earnings ?? '0')
  const canWithdraw = (kycVerified || kycStatus?.can_withdraw === true) && earningsNum > 0
  const bonusPct = bonusPayoutLabel(settings)

  return (
    <>
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Wallet</h1>

        {/* ── Balance Cards ── */}
        <div className={styles.cards}>

          {/* Deposit Coins */}
          <div className={styles.card}>
            <div className={styles.cardLeft}>
              <span className={styles.cardIcon}>💰</span>
              <div>
                <p className={styles.cardLabel}>Deposit Coins</p>
                <p className={styles.cardValue}>{formatCoins(depositCoins)}</p>
                <p className={styles.cardSub}>Spin to win → 100% to earnings</p>
              </div>
            </div>
            <button className={styles.cardAction} onClick={() => setShowFund(true)}>
              + Deposit
            </button>
          </div>

          {/* Bonus Coins */}
          <div className={`${styles.card} ${styles.cardBonus}`}>
            <div className={styles.cardLeft}>
              <span className={styles.cardIcon}>🎁</span>
              <div>
                <p className={styles.cardLabel}>Bonus Coins</p>
                <p className={styles.cardValue}>{formatCoins(bonusCoins)}</p>
                <p className={styles.cardSub}>Spin to win → {bonusPct} to earnings</p>
              </div>
            </div>
          </div>

          {/* Earnings */}
          <div className={`${styles.card} ${styles.cardEarnings}`}>
            <div className={styles.cardLeft}>
              <span className={styles.cardIcon}>💵</span>
              <div>
                <p className={styles.cardLabel}>Earnings</p>
                <p className={styles.cardValue}>{formatNaira(earnings)}</p>
                {earningsUsd && parseFloat(earningsUsd) > 0 && (
                  <p className={styles.cardSub}>≈ ${parseFloat(earningsUsd).toFixed(2)}</p>
                )}
              </div>
            </div>
            <button
              className={`${styles.cardAction} ${!canWithdraw ? styles.cardActionDisabled : ''}`}
              onClick={() => canWithdraw && navigate('/withdraw')}
              disabled={!canWithdraw}
            >
              Withdraw
            </button>
          </div>

          {/* Staked — only when non-zero */}
          {staked && parseFloat(staked) > 0 && (
            <div className={`${styles.card} ${styles.cardStake}`}>
              <div className={styles.cardLeft}>
                <span className={styles.cardIcon}>🔒</span>
                <div>
                  <p className={styles.cardLabel}>Staked</p>
                  <p className={styles.cardValue}>{formatCoins(staked)}</p>
                </div>
              </div>
              <span className={styles.stakeBadge}>In Play</span>
            </div>
          )}
        </div>

        {/* ── KYC Banner ── */}
        {!kycVerified && (
          <div className={`${styles.kycBanner} ${kycStatus?.overall_status === 'partial' ? styles.kycPending : ''}`}>
            <div className={styles.kycBannerLeft}>
              <span className={styles.kycBannerIcon}>
                {kycStatus?.overall_status === 'partial' ? '⚠️' : '🔍'}
              </span>
              <p className={styles.kycBannerText}>
                {kycStatus?.overall_status === 'partial'
                  ? 'Some identity details need correction before you can withdraw.'
                  : kycStatus?.overall_status === 'rejected'
                    ? 'Your identity verification was rejected. Contact support.'
                    : 'Verify your identity to unlock cash withdrawals.'}
              </p>
            </div>
            <button className={styles.kycBtn} onClick={() => navigate('/kyc')}>
              {kycStatus?.overall_status === 'partial' ? 'Fix Now' : 'Verify Now'}
            </button>
          </div>
        )}

        {/* ── Withdrawal History ── */}
        {recentWithdrawals.length > 0 && (
          <div className={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 className={styles.sectionTitle}>Withdrawals</h2>
              <button
                style={{ fontSize: 12, color: '#c9a028', fontWeight: 600 }}
                onClick={() => navigate('/withdraw')}
              >
                New →
              </button>
            </div>
            <div className={styles.txList}>
              {recentWithdrawals.map((wd) => (
                <div key={wd.id} className={styles.txRow}>
                  <div className={styles.txIconWrap}>
                    <span className={styles.txIcon}>{getWdIcon(wd.status)}</span>
                  </div>
                  <div className={styles.txMeta}>
                    <p className={styles.txDescription}>
                      {wd.bank_account
                        ? `${wd.bank_account.bank_name} ${wd.bank_account.account_number_masked}`
                        : 'Bank Withdrawal'}
                    </p>
                    <p className={styles.txDate}>{formatDate(wd.requested_at)}</p>
                  </div>
                  <div className={styles.txAmountWrap}>
                    <p className={`${styles.txAmount} ${styles.txDebit}`}>
                      -{formatNaira(wd.amount)}
                    </p>
                    <p className={`${styles.txStatus} ${getWdStatusClass(wd.status, styles)}`}>
                      {getWdStatusLabel(wd.status)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Transaction History ── */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Transaction History</h2>
          {transactions.length === 0 ? (
            <p className={styles.empty}>No transactions yet.</p>
          ) : (
            <div className={styles.txList}>
              {transactions.map((tx) => (
                <div key={tx.id} className={styles.txRow}>
                  <div className={styles.txIconWrap}>
                    <span className={styles.txIcon}>{getTxIcon(tx.type)}</span>
                  </div>
                  <div className={styles.txMeta}>
                    <p className={styles.txDescription}>{tx.description || formatTxType(tx.type)}</p>
                    <p className={styles.txDate}>{formatDate(tx.created_at)}</p>
                  </div>
                  <div className={styles.txAmountWrap}>
                    <p className={`${styles.txAmount} ${isCredit(tx) ? styles.txCredit : styles.txDebit}`}>
                      {isCredit(tx) ? '+' : ''}
                      {tx.balance_type === 'earnings'
                        ? formatNaira(tx.amount)
                        : `🪙 ${formatCoins(tx.amount)}`}
                    </p>
                    <p className={`${styles.txStatus} ${styles[`txStatus_${tx.status}`]}`}>
                      {tx.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showFund && (
        <FundWalletModal
          onClose={() => setShowFund(false)}
          onSuccess={handleFundSuccess}
        />
      )}
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isCredit(tx: TransactionRecord): boolean {
  const debitTypes = ['withdrawal', 'spin_stake']
  if (debitTypes.includes(tx.type)) return false
  return !tx.amount.startsWith('-')
}

function getTxIcon(type: string): string {
  switch (type) {
    case 'deposit':        return '⬇️'
    case 'withdrawal':     return '⬆️'
    case 'win':
    case 'spin_win':       return '🎡'
    case 'spin_stake':     return '🔒'
    case 'referral_bonus': return '👥'
    default:               return '💱'
  }
}

function formatTxType(type: string): string {
  switch (type) {
    case 'deposit':        return 'Cash Deposit'
    case 'withdrawal':     return 'Cash Withdrawal'
    case 'win':
    case 'spin_win':       return 'Spin Win'
    case 'spin_stake':     return 'Spin Stake'
    case 'referral_bonus': return 'Referral Bonus'
    default:               return type.replace(/_/g, ' ')
  }
}

function getWdIcon(status: WithdrawalStatus): string {
  switch (status) {
    case 'completed':  return '✅'
    case 'failed':
    case 'rejected':   return '❌'
    case 'cancelled':  return '↩️'
    case 'processing': return '🏦'
    default:           return '⏳'
  }
}

function getWdStatusLabel(status: WithdrawalStatus): string {
  switch (status) {
    case 'pending_review': return 'Pending review'
    case 'pending':        return 'Queued'
    case 'processing':     return 'Processing'
    case 'completed':      return 'Sent'
    case 'failed':         return 'Failed'
    case 'rejected':       return 'Rejected'
    case 'cancelled':      return 'Cancelled'
    default:               return status
  }
}

function getWdStatusClass(status: WithdrawalStatus, s: Record<string, string>): string {
  if (status === 'completed') return s.txStatus_completed
  if (status === 'failed' || status === 'rejected') return s.txStatus_failed
  return s.txStatus_pending
}
