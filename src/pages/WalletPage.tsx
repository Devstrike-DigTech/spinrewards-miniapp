import { useEffect, useState, useCallback } from 'react'
import { wallet, kyc } from '@/api/endpoints'
import { useWalletStore } from '@/store/walletStore'
import { formatNaira, formatCoins, formatDate } from '@/lib/format'
import { FundWalletModal } from '@/components/FundWalletModal/FundWalletModal'
import { WithdrawModal } from '@/components/WithdrawModal/WithdrawModal'
import type { TransactionRecord, KYCStatusResponse } from '@/types'
import styles from './WalletPage.module.css'

export function WalletPage() {
  const { coinBalance, cashBalance, stakedBalance, setBalance } = useWalletStore()
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [kycStatus, setKycStatus] = useState<KYCStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showFund, setShowFund] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)

  const loadData = useCallback(() => {
    setIsLoading(true)
    Promise.allSettled([
      wallet.balance(),
      wallet.transactions(1, 20),
      kyc.status(),
    ]).then(([balanceResult, txResult, kycResult]) => {
      if (balanceResult.status === 'fulfilled') {
        const b = balanceResult.value
        setBalance(b.coin_balance, b.cash_balance, b.staked_balance)
      }

      if (txResult.status === 'fulfilled') {
        const data = txResult.value
        // Handle both paginated {results:[]} and plain array
        const list = Array.isArray(data) ? data : (data?.results ?? [])
        setTransactions(list)
      }

      if (kycResult.status === 'fulfilled') {
        setKycStatus(kycResult.value)
      }

      const allFailed = [balanceResult, txResult, kycResult].every(
        (r) => r.status === 'rejected'
      )
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

  const handleWithdrawSuccess = useCallback(() => {
    setShowWithdraw(false)
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

  const kycApproved = kycStatus?.overall_status === 'approved'
  const canWithdraw = (kycApproved || kycStatus?.can_withdraw === true) && parseFloat(cashBalance ?? '0') >= 2000

  return (
    <>
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Wallet</h1>

        {/* ── Balance Cards ── */}
        <div className={styles.cards}>

          {/* Coins card */}
          <div className={styles.card}>
            <div className={styles.cardLeft}>
              <span className={styles.cardIcon}>🪙</span>
              <div>
                <p className={styles.cardLabel}>Total Coins</p>
                <p className={styles.cardValue}>{formatCoins(coinBalance)}</p>
              </div>
            </div>
            <button
              className={styles.cardAction}
              onClick={() => setShowFund(true)}
            >
              Deposit
            </button>
          </div>

          {/* Earnings card */}
          <div className={`${styles.card} ${styles.cardEarnings}`}>
            <div className={styles.cardLeft}>
              <span className={styles.cardIcon}>💵</span>
              <div>
                <p className={styles.cardLabel}>Total Earnings</p>
                <p className={styles.cardValue}>{formatNaira(cashBalance)}</p>
              </div>
            </div>
            <button
              className={`${styles.cardAction} ${!canWithdraw ? styles.cardActionDisabled : ''}`}
              onClick={() => canWithdraw && setShowWithdraw(true)}
              disabled={!canWithdraw}
            >
              Withdraw
            </button>
          </div>

          {/* Stake balance — only show when non-zero */}
          {stakedBalance && parseFloat(stakedBalance) > 0 && (
            <div className={`${styles.card} ${styles.cardStake}`}>
              <div className={styles.cardLeft}>
                <span className={styles.cardIcon}>🔒</span>
                <div>
                  <p className={styles.cardLabel}>Stake Balance</p>
                  <p className={styles.cardValue}>{formatNaira(stakedBalance)}</p>
                </div>
              </div>
              <span className={styles.stakeBadge}>In Play</span>
            </div>
          )}
        </div>

        {/* ── KYC Banner ── */}
        {!kycApproved && (
          <div className={`${styles.kycBanner} ${kycStatus?.overall_status === 'partial' ? styles.kycPending : ''}`}>
            <div className={styles.kycBannerLeft}>
              <span className={styles.kycBannerIcon}>
                {kycStatus?.overall_status === 'partial' ? '⚠️' : '🔍'}
              </span>
              <p className={styles.kycBannerText}>
                {kycStatus?.overall_status === 'partial'
                  ? 'Some KYC details need correction before you can withdraw.'
                  : kycStatus?.overall_status === 'rejected'
                    ? 'Your KYC was rejected. Contact support for help.'
                    : 'Verify your identity to unlock cash withdrawals.'}
              </p>
            </div>
            <button className={styles.kycBtn} onClick={() => window.location.assign('/kyc')}>
              {kycStatus?.overall_status === 'partial' ? 'Fix Now' : 'Verify Now'}
            </button>
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
                    <span className={styles.txIcon}>
                      {getTxIcon(tx.type)}
                    </span>
                  </div>
                  <div className={styles.txMeta}>
                    <p className={styles.txDescription}>{tx.description || formatTxType(tx.type)}</p>
                    <p className={styles.txDate}>{formatDate(tx.created_at)}</p>
                  </div>
                  <div className={styles.txAmountWrap}>
                    <p className={`${styles.txAmount} ${isCredit(tx) ? styles.txCredit : styles.txDebit}`}>
                      {isCredit(tx) ? '+' : ''}
                      {tx.currency === 'coins'
                        ? `🪙${formatCoins(tx.amount)}`
                        : formatNaira(tx.amount)}
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

      {/* ── Modals ── */}
      {showFund && (
        <FundWalletModal
          onClose={() => setShowFund(false)}
          onSuccess={handleFundSuccess}
        />
      )}
      {showWithdraw && (
        <WithdrawModal
          cashBalance={cashBalance}
          onClose={() => setShowWithdraw(false)}
          onSuccess={handleWithdrawSuccess}
        />
      )}
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isCredit(tx: TransactionRecord): boolean {
  const debitTypes = ['withdrawal', 'spin_stake']
  if (debitTypes.includes(tx.type)) return false
  // Also treat negative amount strings as debits
  return !tx.amount.startsWith('-')
}

function getTxIcon(type: string): string {
  switch (type) {
    case 'deposit':        return '⬇️'
    case 'withdrawal':     return '⬆️'
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
    case 'spin_win':       return 'Spin Win'
    case 'spin_stake':     return 'Spin Stake'
    case 'referral_bonus': return 'Referral Bonus'
    default:               return type.replace(/_/g, ' ')
  }
}
