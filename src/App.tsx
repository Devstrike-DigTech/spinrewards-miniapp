import { Routes, Route } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/pages/LoadingScreen'
import { SpinPage } from '@/pages/SpinPage'
import { WalletPage } from '@/pages/WalletPage'
import { InvitePage } from '@/pages/InvitePage'
import { BottomNav } from '@/components/BottomNav/BottomNav'
import styles from './App.module.css'

export function App() {
  const { isLoading, error } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (error) {
    return (
      <div className={styles.errorScreen}>
        <p className={styles.errorText}>{error}</p>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <main className={styles.content}>
        <Routes>
          <Route path="/" element={<SpinPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/invite" element={<InvitePage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
