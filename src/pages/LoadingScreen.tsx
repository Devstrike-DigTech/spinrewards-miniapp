import styles from './LoadingScreen.module.css'

export function LoadingScreen() {
  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <span className="text-gradient">Spin</span>
        <span>Rewards</span>
      </div>
      <div className={styles.spinner} />
    </div>
  )
}
