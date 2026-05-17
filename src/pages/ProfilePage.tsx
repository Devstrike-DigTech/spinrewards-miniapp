import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { kyc as kycApi, referrals as referralsApi, wallet as walletApi } from '@/api/endpoints'
import { useAuthStore } from '@/store/authStore'
import type { KYCStatusResponse, WalletBalance, MyCodeData } from '@/types'
import styles from './WalletPage.module.css'
import profileStyles from './ProfilePage.module.css'
import WebApp from '@twa-dev/sdk'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(val: string | undefined) {
  if (!val) return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}k`
  return `₦${n.toLocaleString()}`
}

function formatCoins(val: string | undefined) {
  if (!val) return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k 🪙`
  return `${n.toLocaleString()} 🪙`
}

// ── KYC Status in user card ───────────────────────────────────────────────────

function KYCStatus({
  status,
  onPress,
}: {
  status: KYCStatusResponse | null
  onPress: () => void
}) {
  if (!status) return null

  if (status.overall_status === 'approved') {
    return (
      <div className={profileStyles.kycVerified}>
        <div className={profileStyles.kycVerifiedDot}>✓</div>
        <span>KYC Status: Verified</span>
      </div>
    )
  }

  if (status.overall_status === 'pending') {
    return (
      <div className={`${profileStyles.kycVerified} ${profileStyles.kycPending}`}>
        <div className={`${profileStyles.kycVerifiedDot} ${profileStyles.kycPendingDot}`}>!</div>
        <span>KYC Status: Under Review</span>
      </div>
    )
  }

  return (
    <button
      className={profileStyles.kycUnverified}
      onClick={onPress}
    >
      KYC Status: Not Verified — Tap to verify
    </button>
  )
}

// ── KYC Action Card ───────────────────────────────────────────────────────────

function KYCActionCard({ status }: { status: KYCStatusResponse | null }) {
  const navigate = useNavigate()
  if (!status || status.overall_status === 'approved') return null

  if (status.overall_status === 'partial') {
    return (
      <button className={`${profileStyles.kycCard} ${profileStyles.kycCardWarn}`} onClick={() => navigate('/kyc')}>
        <div className={profileStyles.kycCardLeft}>
          <div className={`${profileStyles.kycCardIcon} ${profileStyles.kycCardIconOrange}`}>!</div>
          <div>
            <p className={profileStyles.kycCardTitle}>Action Required</p>
            <p className={profileStyles.kycCardSub}>Fix errors to enable withdrawals</p>
          </div>
        </div>
        <div className={profileStyles.kycCardArrow}>›</div>
      </button>
    )
  }

  if (status.overall_status === 'rejected') {
    return (
      <button className={`${profileStyles.kycCard} ${profileStyles.kycCardRejected}`} onClick={() => navigate('/kyc')}>
        <div className={profileStyles.kycCardLeft}>
          <div className={`${profileStyles.kycCardIcon} ${profileStyles.kycCardIconRed}`}>✗</div>
          <div>
            <p className={profileStyles.kycCardTitle}>KYC Rejected</p>
            <p className={profileStyles.kycCardSub}>Contact support for help</p>
          </div>
        </div>
        <div className={profileStyles.kycCardArrow}>›</div>
      </button>
    )
  }

  // unverified or pending
  return (
    <button className={profileStyles.kycCard} onClick={() => navigate('/kyc')}>
      <div className={profileStyles.kycCardLeft}>
        <div className={profileStyles.kycCardIcon}>🪪</div>
        <div>
          <p className={profileStyles.kycCardTitle}>Verify Your Identity</p>
          <p className={profileStyles.kycCardSub}>Required to withdraw winnings</p>
        </div>
      </div>
      <div className={profileStyles.kycCardArrow}>›</div>
    </button>
  )
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`${profileStyles.toggle} ${on ? profileStyles.toggleOn : ''}`}
      onClick={() => onChange(!on)}
    >
      <div className={profileStyles.toggleKnob} />
    </button>
  )
}

// ── ProfilePage ───────────────────────────────────────────────────────────────

function loadSetting(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(`sr_setting_${key}`)
    return v !== null ? v === 'true' : def
  } catch { return def }
}

function saveSetting(key: string, val: boolean) {
  try { localStorage.setItem(`sr_setting_${key}`, String(val)) } catch { /* noop */ }
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()

  const [kycStatus, setKycStatus] = useState<KYCStatusResponse | null>(null)
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [referralData, setReferralData] = useState<MyCodeData | null>(null)

  const [notificationsOn, setNotificationsOn] = useState(() => loadSetting('notifications', true))
  const [soundsOn, setSoundsOn] = useState(() => loadSetting('sounds', false))

  useEffect(() => {
    kycApi.status().then(setKycStatus).catch(() => { /* non-critical */ })
    walletApi.balance().then(setBalance).catch(() => { /* non-critical */ })
    referralsApi.myCode().then(setReferralData).catch(() => { /* non-critical */ })
  }, [])

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ')
    : '—'

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  function handleShare() {
    if (!referralData) return
    const text = `Join me on Spin Rewards and get bonus coins when you sign up! Use my code: ${referralData.code}`
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralData.share_url)}&text=${encodeURIComponent(text)}`
    WebApp.openTelegramLink(url)
  }

  function handleLogout() {
    clearAuth()
    // Telegram WebApp close — if not in TG, just reload
    try { WebApp.close() } catch { window.location.reload() }
  }

  function toggleNotifications(val: boolean) {
    setNotificationsOn(val)
    saveSetting('notifications', val)
  }

  function toggleSounds(val: boolean) {
    setSoundsOn(val)
    saveSetting('sounds', val)
  }

  // Referral code — prefer from referralData, fall back to user
  const referralCode = referralData?.code ?? user?.referral_code ?? null

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Profile</h1>

      {/* ── User card ── */}
      <div className={profileStyles.userCard}>
        <div className={profileStyles.avatar}>{initials}</div>
        <p className={profileStyles.userName}>{displayName}</p>
        <KYCStatus
          status={kycStatus}
          onPress={() => navigate('/kyc')}
        />

        {/* Stats row */}
        <div className={profileStyles.statsRow}>
          <div className={profileStyles.statBox}>
            <span className={profileStyles.statValue}>
              {formatAmount(balance?.cash_balance)}
            </span>
            <span className={profileStyles.statLabel}>Cash</span>
          </div>
          <div className={profileStyles.statBox}>
            <span className={profileStyles.statValue}>
              {formatCoins(balance?.coin_balance)}
            </span>
            <span className={profileStyles.statLabel}>Coins</span>
          </div>
          <div className={profileStyles.statBox}>
            <span className={profileStyles.statValue}>
              {formatAmount(balance?.staked_balance)}
            </span>
            <span className={profileStyles.statLabel}>Staked</span>
          </div>
          <div className={profileStyles.statBox}>
            <span className={profileStyles.statValue}>
              {referralData?.stats.total_referrals ?? 0}
            </span>
            <span className={profileStyles.statLabel}>Referrals</span>
          </div>
        </div>
      </div>

      {/* ── KYC action card (only if not verified) ── */}
      <KYCActionCard status={kycStatus} />

      {/* ── Referral Code card ── */}
      {referralCode && (
        <div className={profileStyles.referralCard}>
          <p className={profileStyles.referralCardTitle}>Referral Code</p>
          <p className={profileStyles.referralCode}>{referralCode}</p>
          <div className={profileStyles.referralBullets}>
            <div className={profileStyles.referralBullet}>
              <span className={profileStyles.referralBulletDot}>•</span>
              <span>Share &amp; earn coins per referral</span>
            </div>
            <div className={profileStyles.referralBullet}>
              <span className={profileStyles.referralBulletDot}>•</span>
              <span>Share code via Whatsapp, Instagram or SMS</span>
            </div>
            <div className={profileStyles.referralBullet}>
              <span className={profileStyles.referralBulletDot}>•</span>
              <span>When your friend signs up using your referral code, you both get coins after their first deposit</span>
            </div>
          </div>
          <button className={profileStyles.shareBtn} onClick={handleShare}>
            🔗 Share Referral Link
          </button>
        </div>
      )}

      {/* ── Settings ── */}
      <div className={profileStyles.settingsCard}>
        <p className={profileStyles.settingsTitle}>Settings</p>
        <div className={profileStyles.settingRow}>
          <span className={profileStyles.settingLabel}>Show all notifications</span>
          <Toggle on={notificationsOn} onChange={toggleNotifications} />
        </div>
        <div className={profileStyles.settingRow}>
          <span className={profileStyles.settingLabel}>Sounds</span>
          <Toggle on={soundsOn} onChange={toggleSounds} />
        </div>
      </div>

      {/* ── Log out ── */}
      <button className={profileStyles.logoutBtn} onClick={handleLogout}>
        ↪ Log out
      </button>
    </div>
  )
}
