import styles from './WalletPage.module.css' // reuse shell style

export function ProfilePage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Profile</h1>
      <p style={{ color: '#60607a', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
        Profile & KYC settings coming soon…
      </p>
    </div>
  )
}
