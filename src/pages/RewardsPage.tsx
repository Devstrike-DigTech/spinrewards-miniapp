import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { challenges as challengesApi, referrals as referralsApi } from '@/api/endpoints'
import type { Challenge, MyReferralEntry, MyCodeData } from '@/types'
import styles from './RewardsPage.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function rewardLabel(reward: Challenge['reward']) {
  switch (reward.type) {
    case 'coins': return `x${reward.amount}`
    case 'cash': return `₦${reward.amount.toLocaleString()}`
    case 'free_spins': return `${reward.amount} spin${reward.amount > 1 ? 's' : ''}`
    case 'multiplier_boost': return `${reward.amount}x`
    default: return `${reward.amount}`
  }
}

function challengeIcon(type: string) {
  switch (type) {
    case 'welcome': return '🎡'
    case 'spin_count':
    case 'spin_streak': return '🌀'
    case 'daily_login':
    case 'login_streak': return '📅'
    case 'referral': return '👥'
    case 'deposit':
    case 'deposit_streak': return '💰'
    case 'win_streak': return '🏆'
    case 'total_staked': return '📊'
    default: return '⭐'
  }
}

function challengeProgressText(challenge: Challenge) {
  const p = challenge.my_progress
  const target = challenge.criteria.target_count as number
  if (!p) return `0 / ${target}`
  return `${p.current_count} / ${target}`
}

function referralStatusLabel(status: MyReferralEntry['status']) {
  switch (status) {
    case 'pending': return 'Waiting for deposit'
    case 'qualified': return 'Reward incoming…'
    case 'rewarded': return 'Reward received'
    case 'rejected': return 'Rejected'
    default: return status
  }
}

// ── Challenge Card ────────────────────────────────────────────────────────────

function ChallengeCard({ challenge, onAction }: {
  challenge: Challenge
  onAction: (c: Challenge) => void
}) {
  const p = challenge.my_progress
  const target = (challenge.criteria.target_count as number) ?? 1
  const current = p?.current_count ?? 0
  const pct = Math.min(p?.progress_pct ?? 0, 100)
  const isCompleted = p?.is_completed ?? false
  const rewardClaimed = p?.reward_claimed ?? false

  // Welcome spin — no progress bar, just a CTA
  if (challenge.type === 'welcome') {
    const used = isCompleted
    return (
      <div className={styles.card}>
        <p className={styles.cardTitle}>{challenge.name}</p>
        <div className={styles.cardRow}>
          <div className={styles.cardIcon}>
            🎡
          </div>
          <div className={styles.cardMeta}>
            <p className={styles.cardDescription}>
              {used ? 'Welcome spin used!' : 'You have one free spin!'}
            </p>
          </div>
          {!used && (
            <button className={styles.btn} onClick={() => onAction(challenge)}>
              Spin Now
            </button>
          )}
          {used && (
            <span className={`${styles.btn} ${styles.btnDone}`}>Done ✓</span>
          )}
        </div>
      </div>
    )
  }

  // Referral challenge — handled separately via referral list
  if (challenge.type === 'referral') {
    return null // rendered by ReferralBonusCard
  }

  // Standard progress challenges
  const btnClass = isCompleted && rewardClaimed
    ? `${styles.btn} ${styles.btnDone}`
    : isCompleted && !rewardClaimed
      ? styles.btn
      : `${styles.btn} ${styles.btnDisabled}`

  const btnLabel = rewardClaimed ? 'Claimed ✓' : isCompleted ? 'Claim' : 'Claim'

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>{challenge.name}</p>
      <div className={styles.cardRow}>
        <div className={styles.cardIcon}>
          {challengeIcon(challenge.type)}
          <span className={styles.coinBadge}>{rewardLabel(challenge.reward)}</span>
        </div>
        <div className={styles.cardMeta}>
          <p className={styles.cardDescription}>
            {challenge.type === 'daily_login' || challenge.type === 'login_streak'
              ? p ? 'Logged in today' : 'Log in to claim'
              : challengeProgressText(challenge)}
          </p>
          <p className={styles.cardSub}>{challenge.description}</p>
        </div>
        <button
          className={btnClass}
          disabled={!isCompleted || rewardClaimed}
          onClick={() => isCompleted && !rewardClaimed && onAction(challenge)}
        >
          {btnLabel}
        </button>
      </div>

      {/* Progress bar */}
      <div className={styles.progressWrap}>
        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill}${isCompleted ? ` ${styles.progressFillDone}` : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className={styles.progressText}>{current} / {target}</p>
      </div>
    </div>
  )
}

// ── Referral Bonus Card ───────────────────────────────────────────────────────

function ReferralBonusCard({
  referralChallenge,
  referrals,
  onShare,
}: {
  referralChallenge: Challenge | null
  referrals: MyReferralEntry[]
  onShare: () => void
}) {
  if (!referralChallenge && referrals.length === 0) return null

  const reward = referralChallenge?.reward ?? { type: 'coins', amount: 500 }

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>Referral Bonus</p>

      {referrals.length === 0 ? (
        <div className={styles.cardRow}>
          <div className={styles.cardIcon}>
            👥
            <span className={styles.coinBadge}>{rewardLabel(reward)}</span>
          </div>
          <div className={styles.cardMeta}>
            <p className={styles.cardDescription}>Invite friends to earn rewards</p>
            <p className={styles.cardSub}>Earn {rewardLabel(reward)} per referral</p>
          </div>
          <button className={styles.btn} onClick={onShare}>
            Invite
          </button>
        </div>
      ) : (
        <div className={styles.referralList}>
          {referrals.map((ref, i) => {
            const isRewarded = ref.status === 'rewarded'
            const isPending = ref.status === 'pending'
            return (
              <div key={ref.id}>
                {i > 0 && <div className={styles.divider} />}
                <div className={styles.cardRow} style={{ paddingTop: i > 0 ? 8 : 0 }}>
                  <div className={styles.cardIcon}>
                    👥
                    <span className={styles.coinBadge}>{rewardLabel(reward)}</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <p className={styles.cardDescription}>{ref.referred_user.name}</p>
                    <p className={styles.cardSub}>{referralStatusLabel(ref.status)}</p>
                  </div>
                  <button
                    className={
                      isRewarded
                        ? `${styles.btn} ${styles.btnDone}`
                        : isPending
                          ? `${styles.btn} ${styles.btnDisabled}`
                          : styles.btn
                    }
                    disabled={isPending || isRewarded}
                  >
                    {isRewarded ? 'Claimed ✓' : 'Pending'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── RewardsPage ───────────────────────────────────────────────────────────────

export function RewardsPage() {
  const navigate = useNavigate()
  const [challengesList, setChallengesList] = useState<Challenge[]>([])
  const [referralList, setReferralList] = useState<MyReferralEntry[]>([])
  const [referralCode, setReferralCode] = useState<MyCodeData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [challengesRes, referralsRes, codeRes] = await Promise.allSettled([
          challengesApi.list(),
          referralsApi.myReferrals(),
          referralsApi.myCode(),
        ])

        if (challengesRes.status === 'fulfilled') {
          setChallengesList(challengesRes.value.challenges ?? [])
        }
        if (referralsRes.status === 'fulfilled') {
          setReferralList(referralsRes.value.referrals ?? [])
        }
        if (codeRes.status === 'fulfilled') {
          setReferralCode(codeRes.value)
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  function handleChallengeAction(challenge: Challenge) {
    // Navigate to the relevant page based on challenge type
    if (challenge.type === 'welcome') {
      navigate('/')
    } else if (challenge.type === 'deposit') {
      navigate('/wallet')
    } else if (challenge.type === 'referral') {
      navigate('/profile')
    } else {
      // spin_count, spin_streak, win_streak → go spin
      navigate('/')
    }
  }

  function handleShare() {
    if (referralCode?.share_url) {
      const text = `Join me on Spin Rewards! ${referralCode.share_url}`
      const tg = (window as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp
      const url = `https://t.me/share/url?url=${encodeURIComponent(referralCode.share_url)}&text=${encodeURIComponent(text)}`
      tg?.openTelegramLink?.(url) ?? window.open(url, '_blank')
    } else {
      navigate('/profile')
    }
  }

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  const referralChallenge = challengesList.find((c) => c.type === 'referral') ?? null
  const otherChallenges = challengesList.filter((c) => c.type !== 'referral')

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Rewards</h1>

      {challengesList.length === 0 && referralList.length === 0 ? (
        <p className={styles.empty}>No rewards available right now.</p>
      ) : (
        <>
          {otherChallenges.map((ch) => (
            <ChallengeCard
              key={ch.id}
              challenge={ch}
              onAction={handleChallengeAction}
            />
          ))}

          <ReferralBonusCard
            referralChallenge={referralChallenge}
            referrals={referralList}
            onShare={handleShare}
          />
        </>
      )}
    </div>
  )
}
