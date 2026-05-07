import { Routes, Route } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/pages/LoadingScreen'
import { SpinPage } from '@/pages/SpinPage'
import { WalletPage } from '@/pages/WalletPage'
import { InvitePage } from '@/pages/InvitePage'
import { RewardsPage } from '@/pages/RewardsPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { KYCPage } from '@/pages/KYCPage'
import { WithdrawPage } from '@/pages/WithdrawPage'
import { BottomNav } from '@/components/BottomNav/BottomNav'
import styles from './App.module.css'

export function App() {
  const { isLoading, error } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (error) {
    const tg = (window as any).Telegram?.WebApp
    const debug = {
      platform: tg?.platform,
      version: tg?.version,
      hasInitData: !!tg?.initData,
      initDataLen: tg?.initData?.length ?? 0,
      hasTgWebAppData: window.location.hash?.includes('tgWebAppData'),
      hashLen: window.location.hash?.length ?? 0,
    }
    return (
      <div className={styles.errorScreen}>
        <p className={styles.errorText}>{error}</p>
        <pre style={{ fontSize: 10, color: '#888', textAlign: 'left', padding: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {JSON.stringify(debug, null, 2)}
        </pre>
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
          <Route path="/rewards" element={<RewardsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/kyc" element={<KYCPage />} />
          <Route path="/withdraw" element={<WithdrawPage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
