import { useEffect, useState } from 'react'
import { referrals } from '@/api/endpoints'
import WebApp from '@twa-dev/sdk'
import type { MyCodeData } from '@/types'
import styles from './InvitePage.module.css'

export function InvitePage() {
  const [info, setInfo] = useState<MyCodeData | null>(null)
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    referrals.myCode().then(setInfo).finally(() => setIsLoading(false))
  }, [])

  const handleCopy = () => {
    if (!info) return
    navigator.clipboard.writeText(info.share_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = () => {
    if (!info) return
    const text = `Join me on Spin Rewards and get bonus coins when you sign up! Use my code: ${info.referral_code}\n${info.share_url}`
    WebApp.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(info.share_url)}&text=${encodeURIComponent(text)}`
    )
  }

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Invite Friends</h1>

      <div className={styles.rewardBanner}>
        <p className={styles.rewardText}>You earn</p>
        <p className={styles.rewardAmount}>₦500</p>
        <p className={styles.rewardSub}>for every friend who deposits</p>
        <p className={styles.rewardFriend}>Your friend gets ₦200 free coins</p>
      </div>

      {info && (
        <>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{info.total_referred}</span>
              <span className={styles.statLabel}>Friends invited</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                ₦{parseFloat(info.total_earned || '0').toLocaleString()}
              </span>
              <span className={styles.statLabel}>Total earned</span>
            </div>
            {info.pending_count > 0 && (
              <div className={styles.stat}>
                <span className={styles.statValue}>{info.pending_count}</span>
                <span className={styles.statLabel}>Pending</span>
              </div>
            )}
          </div>

          <div className={styles.linkBox}>
            <p className={styles.linkLabel}>Your referral code</p>
            <p className={styles.referralCode}>{info.referral_code}</p>
            <p className={styles.linkLabel} style={{ marginTop: 10 }}>Share link</p>
            <p className={styles.link}>{info.share_url}</p>
          </div>

          <div className={styles.actions}>
            <button className={styles.copyBtn} onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button className={styles.shareBtn} onClick={handleShare}>
              Share on Telegram
            </button>
          </div>
        </>
      )}
    </div>
  )
}
