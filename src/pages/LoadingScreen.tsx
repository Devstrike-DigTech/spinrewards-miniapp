import styles from './LoadingScreen.module.css'

export function LoadingScreen() {
  return (
    <div className={styles.container}>
      <img src="/logo.png" alt="Spin Rewards" className={styles.logo} />
      <div className={styles.spinner} />
    </div>
  )
}
