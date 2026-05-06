import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { kyc as kycApi } from '@/api/endpoints'
import { useAuthStore } from '@/store/authStore'
import type { KYCStatusResponse } from '@/types'
import styles from './WalletPage.module.css'
import profileStyles from './ProfilePage.module.css'

function KYCStatusCard({ status }: { status: KYCStatusResponse | null }) {
  const navigate = useNavigate()

  if (!status) return null

  const { overall_status } = status

  if (overall_status === 'approved') {
    return (
      <div className={`${profileStyles.kycCard} ${profileStyles.kycCardApproved}`}>
        <div className={profileStyles.kycCardLeft}>
          <div className={`${profileStyles.kycCardIcon} ${profileStyles.kycCardIconGreen}`}>✓</div>
          <div>
            <p className={profileStyles.kycCardTitle}>Identity Verified</p>
            <p className={profileStyles.kycCardSub}>Withdrawals enabled</p>
          </div>
        </div>
      </div>
    )
  }

  if (overall_status === 'partial') {
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

  if (overall_status === 'rejected') {
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

export function ProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [kycStatus, setKycStatus] = useState<KYCStatusResponse | null>(null)

  useEffect(() => {
    kycApi.status().then(setKycStatus).catch(() => {/* non-critical */})
  }, [])

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ')
    : '—'

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Profile</h1>

      {/* User card */}
      <div className={profileStyles.userCard}>
        <div className={profileStyles.avatar}>
          {(user?.first_name?.[0] ?? '?').toUpperCase()}
        </div>
        <div>
          <p className={profileStyles.userName}>{displayName}</p>
          {user?.username && (
            <p className={profileStyles.userHandle}>@{user.username}</p>
          )}
        </div>
      </div>

      {/* KYC status */}
      <KYCStatusCard status={kycStatus} />

      {/* Referral code */}
      {user?.referral_code && (
        <div className={profileStyles.infoRow}>
          <span className={profileStyles.infoLabel}>Referral Code</span>
          <span className={profileStyles.infoValue}>{user.referral_code}</span>
        </div>
      )}

      {/* Invite link */}
      <button
        className={profileStyles.outlineBtn}
        onClick={() => navigate('/invite')}
      >
        Invite Friends & Earn
      </button>
    </div>
  )
}
