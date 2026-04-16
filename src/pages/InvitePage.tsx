import { useEffect, useState } from 'react'
import { referrals } from '@/api/endpoints'
import WebApp from '@twa-dev/sdk'
import type { ReferralInfo } from '@/types'
import styles from './InvitePage.module.css'

export function InvitePage() {
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    referrals.info().then(setInfo).finally(() => setIsLoading(false))
  }, [])

  const handleCopy = () => {
    if (!info) return
    navigator.clipboard.writeText(info.referral_link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = () => {
    if (!info) return
    const text = `Join me on Spin Rewards and get ₦200 in coins when you sign up! ${info.referral_link}`
    WebApp.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(info.referral_link)}&text=${encodeURIComponent(text)}`
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
              <span className={styles.statValue}>{info.total_referrals}</span>
              <span className={styles.statLabel}>Friends invited</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                ₦{parseFloat(info.total_earned).toLocaleString()}
              </span>
              <span className={styles.statLabel}>Total earned</span>
            </div>
          </div>

          <div className={styles.linkBox}>
            <p className={styles.linkLabel}>Your referral link</p>
            <p className={styles.link}>{info.referral_link}</p>
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
