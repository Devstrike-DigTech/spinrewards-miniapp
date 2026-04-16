import { useEffect, useState } from 'react'
import { wallet, withdrawals, kyc } from '@/api/endpoints'
import { useWalletStore } from '@/store/walletStore'
import type { WithdrawalRecord, KYCStatus } from '@/types'
import styles from './WalletPage.module.css'

export function WalletPage() {
  const { coinBalance, cashBalance, setBalance } = useWalletStore()
  const [history, setHistory] = useState<WithdrawalRecord[]>([])
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      wallet.balance(),
      withdrawals.list(),
      kyc.status(),
    ]).then(([balance, withdrawalList, kycData]) => {
      setBalance(balance.coin_balance, balance.cash_balance)
      setHistory(withdrawalList)
      setKycStatus(kycData)
    }).finally(() => setIsLoading(false))
  }, [setBalance])

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Wallet</h1>

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Coins</span>
          <span className={styles.cardValue}>
            {coinBalance ? parseFloat(coinBalance).toLocaleString() : '0'}
          </span>
          <span className={styles.cardSub}>Play currency</span>
        </div>
        <div className={`${styles.card} ${styles.cardCash}`}>
          <span className={styles.cardLabel}>Cash</span>
          <span className={styles.cardValue}>
            ₦{cashBalance ? parseFloat(cashBalance).toLocaleString() : '0'}
          </span>
          <span className={styles.cardSub}>Withdrawable</span>
        </div>
      </div>

      {kycStatus?.status !== 'approved' && (
        <div className={styles.kycBanner}>
          <p className={styles.kycText}>
            {kycStatus?.status === 'pending'
              ? 'KYC verification pending — withdrawals will be enabled once approved.'
              : 'Complete KYC to withdraw your winnings.'}
          </p>
          {kycStatus?.status === 'unverified' && (
            <button className={styles.kycBtn}>Verify Now</button>
          )}
        </div>
      )}

      {kycStatus?.status === 'approved' && (
        <button className={styles.withdrawBtn}>Withdraw Cash</button>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Withdrawal History</h2>
        {history.length === 0 ? (
          <p className={styles.empty}>No withdrawals yet.</p>
        ) : (
          <div className={styles.list}>
            {history.map((record) => (
              <div key={record.id} className={styles.record}>
                <div>
                  <p className={styles.recordAmount}>
                    ₦{parseFloat(record.amount).toLocaleString()}
                  </p>
                  <p className={styles.recordDate}>
                    {new Date(record.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`${styles.status} ${styles[`status_${record.status}`]}`}
                >
                  {record.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
