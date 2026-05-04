import styles from './WalletPage.module.css' // reuse shell style

export function RewardsPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Rewards</h1>
      <p style={{ color: '#60607a', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
        Rewards & leaderboard coming soon…
      </p>
    </div>
  )
}
