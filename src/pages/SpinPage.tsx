import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SpinWheel } from '@/components/SpinWheel/SpinWheel'
import { SpinEngine, DEFAULT_SEGMENTS } from '@/components/SpinWheel/spinEngine'
import { Confetti } from '@/components/Confetti/Confetti'
import { FundWalletModal } from '@/components/FundWalletModal/FundWalletModal'
import { useMiniToast } from '@/components/MiniToast/MiniToast'
import { spin as spinApi, wallet, kyc as kycApi, challenges as challengesApi } from '@/api/endpoints'
import { useWalletStore } from '@/store/walletStore'
import { useSettingsStore, bonusPayoutLabel } from '@/store/settingsStore'
import { useTelegram } from '@/hooks/useTelegram'
import { sounds } from '@/lib/sounds'
import { getWheelVisualConfig, deriveStakePresets, segmentsFromApi } from '@/lib/wheelConfig'
import { formatNaira, formatCoins, formatUsdt } from '@/lib/format'
import type { WheelRecord, SpinResult, KYCOverallStatus, Challenge, SpinSource, BonusDestination } from '@/types'
import styles from './SpinPage.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function wheelEmoji(type: string) {
  return (
    { standard: '🎡', power: '⚡', mega: '🔥', welcome: '🎁', daily_challenge: '📅' }[type] ??
    '🎰'
  )
}

/** Simple debounce hook */
function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState<T>(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

// ── State types ───────────────────────────────────────────────────────────────

type SpinPhase = 'idle' | 'preparing' | 'spinning' | 'revealing' | 'error'
type WheelLookup = 'idle' | 'searching' | 'found' | 'not_found' | 'error'

// ── Login Streak Card ─────────────────────────────────────────────────────────

function LoginStreakCard({
  challenge,
  onClaim,
  claiming,
}: {
  challenge: Challenge
  onClaim: () => void
  claiming: boolean
}) {
  const p = challenge.my_progress
  const isClaimable = p?.claimable ?? false
  const isClaimed   = p?.reward_claimed ?? (!isClaimable && p?.is_completed)
  const streak      = p?.current_count ?? 0
  const target      = (challenge.criteria?.target_count as number) ?? 1

  const rewardLabel = (() => {
    const r = challenge.reward
    if (r.type === 'coins')   return `${r.amount} coins`
    if (r.type === 'cash')    return `₦${r.amount.toLocaleString()}`
    if (r.type === 'free_spins') return `${r.amount} spin${r.amount > 1 ? 's' : ''}`
    return `${r.amount}`
  })()

  return (
    <div className={styles.streakCard}>
      {/* Left: icon + streak count */}
      <div className={styles.streakIcon}>
        <span className={styles.streakEmoji}>🔥</span>
        <span className={styles.streakCount}>{streak}</span>
      </div>

      {/* Middle: name + description */}
      <div className={styles.streakMeta}>
        <p className={styles.streakName}>{challenge.name}</p>
        <p className={styles.streakSub}>
          {isClaimed
            ? `Day ${streak} — See you tomorrow!`
            : isClaimable
              ? `Day ${streak} — Ready to collect!`
              : `${streak} / ${target} days`}
        </p>
      </div>

      {/* Right: CTA */}
      {isClaimable ? (
        <button
          className={styles.streakClaimBtn}
          onClick={onClaim}
          disabled={claiming}
        >
          {claiming ? '…' : `Claim ${rewardLabel}!`}
        </button>
      ) : isClaimed ? (
        <span className={styles.streakDoneBtn}>Claimed ✓</span>
      ) : (
        <span className={styles.streakLockedBtn}>Locked</span>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SpinPage() {
  const engineRef = useRef<SpinEngine | null>(null)
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { cryptoCoins, nairaCoins, bonusCoins, setBalance } = useWalletStore()
  const settings = useSettingsStore((s) => s.settings)
  const [sourceWallet, setSourceWallet] = useState<SpinSource>('naira_coins')
  const [bonusDestination, setBonusDestination] = useState<BonusDestination>('naira')
  const [showBonusDest, setShowBonusDest] = useState(false)
  const toast = useMiniToast()

  // All active wheels — used to derive stake presets
  const [activeWheels, setActiveWheels] = useState<WheelRecord[]>([])
  const [loadingWheels, setLoadingWheels] = useState(true)

  // Stake input (always a string to allow free-typing)
  const [stake, setStake] = useState('500')
  const debouncedStake = useDebounce(stake, 300)

  // Live wheel lookup state
  const [lookupState, setLookupState] = useState<WheelLookup>('idle')
  const [resolvedWheel, setResolvedWheel] = useState<WheelRecord | null>(null)
  const [lookupError, setLookupError] = useState('')

  // Spin state machine
  const [phase, setPhase] = useState<SpinPhase>('idle')
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null)
  const [spinError, setSpinError] = useState<{ code?: string; message: string } | null>(null)

  // Welcome wheel (separate flow)
  const [welcomeWheel, setWelcomeWheel] = useState<WheelRecord | null>(null)

  // Login / daily streak challenge (shown below the wheel)
  const [loginChallenge, setLoginChallenge] = useState<Challenge | null>(null)
  const [claimingChallenge, setClaimingChallenge] = useState(false)

  // Recent spins
  const [recentSpins, setRecentSpins] = useState<SpinResult[]>([])

  // Fund modal
  const [showFund, setShowFund] = useState(false)

  // KYC status for top-bar badge
  const [kycOverall, setKycOverall] = useState<KYCOverallStatus | null>(null)

  // Mute
  const [muted, setMuted] = useState(false)

  // ── Rewards sheet (FAB-triggered; scales out of the FAB corner) ─────────────
  const [sheetOpen, setSheetOpen] = useState(false)

  // ── Load active wheels + supplemental data on mount ───────────────────────
  useEffect(() => {
    Promise.allSettled([
      spinApi.activeWheels(),
      wallet.balance(),
      spinApi.history(1),
      kycApi.status(),
      challengesApi.list(),
    ]).then(([wheelsR, balR, histR, kycR, challengesR]) => {
      if (wheelsR.status === 'fulfilled') {
        const list = wheelsR.value
        setActiveWheels(list)
        setWelcomeWheel(list.find((w) => w.is_welcome_only) ?? null)
      }
      if (balR.status === 'fulfilled') {
        setBalance(balR.value)
      }
      if (histR.status === 'fulfilled') {
        const d = histR.value
        setRecentSpins(Array.isArray(d) ? d.slice(0, 5) : (d?.results ?? []).slice(0, 5))
      }
      if (kycR.status === 'fulfilled') setKycOverall(kycR.value.overall_status)
      if (challengesR.status === 'fulfilled') {
        const all = challengesR.value.challenges ?? []
        const streakChallenge = all.find(
          (c) => c.type === 'daily_login' || c.type === 'login_streak'
        ) ?? null
        setLoginChallenge(streakChallenge)
      }
      setLoadingWheels(false)
    })
  }, [setBalance])

  // ── Derive stake presets from wheel ranges ────────────────────────────────
  const stakePresets = useMemo(() => deriveStakePresets(activeWheels), [activeWheels])

  // ── Live stake → wheel lookup (debounced) ─────────────────────────────────
  useEffect(() => {
    const amount = parseFloat(debouncedStake)
    if (!debouncedStake || isNaN(amount) || amount <= 0) {
      setLookupState('idle')
      setResolvedWheel(null)
      setLookupError('')
      return
    }

    let cancelled = false
    setLookupState('searching')

    spinApi
      .forStake(amount)
      .then((wheel) => {
        if (cancelled) return
        setResolvedWheel(wheel)
        setLookupState('found')
        setLookupError('')
      })
      .catch((err: any) => {
        if (cancelled) return
        const status = err?.response?.status
        if (status === 404) {
          setResolvedWheel(null)
          setLookupState('not_found')
          setLookupError(
            err?.response?.data?.message ??
              'No wheel matches this amount. Try ₦200, ₦500 or ₦2,000.'
          )
        } else {
          setResolvedWheel(null)
          setLookupState('error')
          setLookupError('Could not check wheel. Check your connection.')
        }
      })

    return () => { cancelled = true }
  }, [debouncedStake])

  // ── Segments: prefer backend-provided segments, fall back to local config ──
  const segments = useMemo(() => {
    if (!resolvedWheel) return DEFAULT_SEGMENTS
    if (resolvedWheel.segments && resolvedWheel.segments.length > 0) {
      return segmentsFromApi(resolvedWheel.segments)
    }
    return getWheelVisualConfig(resolvedWheel.wheel_type)
  }, [resolvedWheel])

  // Re-key the SpinWheel by wheel ID so Pixi re-initialises whenever the
  // wheel (and therefore its segments) change — even across the same type.
  const wheelKey = resolvedWheel?.id ?? 'default'

  // ── Login streak challenge claim ─────────────────────────────────────────
  const claimLoginChallenge = useCallback(async () => {
    if (!loginChallenge || claimingChallenge) return
    setClaimingChallenge(true)
    try {
      const res = await challengesApi.claim(loginChallenge.id)
      const claimMsg = res.credited_to_label
        ? `You earned ${res.amount} ${res.credited_to_label}!`
        : res.message ?? 'Reward claimed!'
      toast.show(claimMsg, 'success')
      haptic.notificationOccurred('success')
      // Refetch wallet balance + updated challenge state
      const [updated, bal] = await Promise.allSettled([
        challengesApi.list(),
        wallet.balance(),
      ])
      if (updated.status === 'fulfilled') {
        const all = updated.value.challenges ?? []
        const refreshed = all.find(
          (c) => c.type === 'daily_login' || c.type === 'login_streak'
        ) ?? null
        setLoginChallenge(refreshed)
      }
      if (bal.status === 'fulfilled') {
        setBalance(bal.value)
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        'Failed to claim reward.'
      toast.show(msg, 'error')
      haptic.notificationOccurred('error')
    } finally {
      setClaimingChallenge(false)
    }
  }, [loginChallenge, claimingChallenge, haptic, setBalance, toast])

  // ── Welcome spin ──────────────────────────────────────────────────────────
  const handleWelcomeSpin = useCallback(async () => {
    if (phase !== 'idle') return
    setSpinError(null)
    setPhase('preparing')
    haptic.impactOccurred('medium')
    try {
      const result = await spinApi.welcome()
      setSpinResult(result)
      setPhase('spinning')
      engineRef.current?.spinTo(result.segment_position)
    } catch (err: any) {
      setSpinError({
        code: err?.response?.data?.code,
        message: err?.response?.data?.message ?? 'Welcome spin failed.',
      })
      setPhase('error')
      haptic.notificationOccurred('error')
    }
  }, [phase, haptic])

  // ── Main spin ─────────────────────────────────────────────────────────────
  const handleSpin = useCallback(async () => {
    if (phase !== 'idle' || !resolvedWheel) return

    const num = parseFloat(stake)
    if (!stake || isNaN(num) || num <= 0) return

    setSpinError(null)
    setPhase('preparing')
    haptic.impactOccurred('medium')

    try {
      const result = await spinApi.execute({
        wheel_id: resolvedWheel.id,
        stake_amount: num.toFixed(2),
        source_wallet: sourceWallet,
        ...(sourceWallet === 'bonus_coins' ? { bonus_destination: bonusDestination } : {}),
      })
      setSpinResult(result)
      setPhase('spinning')
      engineRef.current?.spinTo(result.segment_position)
    } catch (err: any) {
      setSpinError({
        code: err?.response?.data?.code,
        message: err?.response?.data?.message ?? 'Spin failed. Please try again.',
      })
      setPhase('error')
      haptic.notificationOccurred('error')
    }
  }, [phase, resolvedWheel, stake, sourceWallet, bonusDestination, haptic])

  // Called by SpinEngine when animation starts
  const handleSpinStart = useCallback(() => {
    sounds.startSpin()
  }, [])

  // Called by SpinEngine each time the pointer crosses a segment boundary
  const handleTick = useCallback(() => {
    haptic.impactOccurred('light')
  }, [haptic])

  // Called by SpinEngine after animation fully completes (min 5 s)
  const handleAnimationDone = useCallback(() => {
    sounds.stopSpin()
    sounds.playLand()

    if (!spinResult) return
    const mult = parseFloat(spinResult.multiplier)

    setTimeout(() => {
      if (spinResult.outcome === 'win') {
        mult >= 10 ? sounds.playJackpot() : sounds.playWin()
        haptic.notificationOccurred('success')
      } else if (spinResult.outcome === 'loss') {
        sounds.playLoss()
        haptic.notificationOccurred('warning')
      } else {
        haptic.notificationOccurred('success')
      }
      setPhase('revealing')
    }, 150)

    wallet.balance()
      .then((b) => setBalance(b))
      .catch(() => {})
  }, [spinResult, haptic, setBalance])

  const handlePlayAgain = useCallback(() => {
    setPhase('idle')
    setSpinResult(null)
    setSpinError(null)
  }, [])

  const handleFundSuccess = useCallback(() => {
    setShowFund(false)
    wallet.balance().then((b) => setBalance(b)).catch(() => {})
  }, [setBalance])

  const toggleMute = useCallback(() => {
    const next = !muted
    setMuted(next)
    sounds.setMuted(next)
  }, [muted])

  const openSheet = useCallback(() => {
    haptic.impactOccurred('light')
    setSheetOpen(true)
  }, [haptic])

  const closeSheet = useCallback(() => setSheetOpen(false), [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const nairaNum  = parseFloat(nairaCoins ?? '0')
  const cryptoNum = parseFloat(cryptoCoins ?? '0')
  const bonusNum  = parseFloat(bonusCoins ?? '0')

  // Auto-select a funded bucket if the current one is empty
  useEffect(() => {
    const bal = sourceWallet === 'crypto_coins' ? cryptoNum : sourceWallet === 'bonus_coins' ? bonusNum : nairaNum
    if (bal > 0) return
    if (nairaNum > 0) setSourceWallet('naira_coins')
    else if (cryptoNum > 0) setSourceWallet('crypto_coins')
    else if (bonusNum > 0) setSourceWallet('bonus_coins')
  }, [sourceWallet, nairaNum, cryptoNum, bonusNum])

  // Check the selected wallet has enough balance for the stake
  const selectedBalance =
    sourceWallet === 'crypto_coins' ? cryptoNum : sourceWallet === 'bonus_coins' ? bonusNum : nairaNum
  const canSpin =
    phase === 'idle' &&
    lookupState === 'found' &&
    !!resolvedWheel &&
    parseFloat(stake) > 0 &&
    selectedBalance >= parseFloat(stake)

  // ══════════════════════════════════════════════════════════════════════════
  // RESULT FULL-SCREEN OVERLAY
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'revealing' && spinResult) {
    const isWin  = spinResult.outcome === 'win'
    const isLoss = spinResult.outcome === 'loss'
    const isPush = spinResult.outcome === 'push'

    // Currency-aware payout: prefer net_credited (esp. for bonus spins)
    const payCurrency = spinResult.payout_currency
    const fmtPay = (v?: string) => (payCurrency === 'USDT' ? formatUsdt(v) : formatNaira(v))
    const winRaw = spinResult.net_credited ?? spinResult.payout_amount

    const shareText = isWin
      ? `🎉 I just won ${fmtPay(winRaw)} on Spin Rewards! Join me 👉 https://t.me/SpinRewardsBot`
      : `🎡 I'm spinning on Spin Rewards — come join! 👉 https://t.me/SpinRewardsBot`

    const handleShare = () => {
      const tg = (window as any).Telegram?.WebApp
      tg?.switchInlineQuery?.(shareText) ?? navigator.clipboard?.writeText?.(shareText)
      haptic.notificationOccurred('success')
    }

    return (
      <div className={`${styles.resultScreen} ${isWin ? styles.resultScreenWin : isLoss ? styles.resultScreenLoss : styles.resultScreenPush}`}>

        {/* Confetti burst — sits behind content (z-index 0), covers full screen */}
        {isWin && <Confetti />}

        <div className={styles.resultContent}>

          {/* ── Illustration ── */}
          {isWin ? (
            <>
              <div className={styles.resultIllustration}>🎉</div>
              <p className={styles.resultHeading}>Congratulations!</p>
              <p className={styles.resultWinSub}>You won</p>
              <p className={styles.resultAmount}>{fmtPay(winRaw)}</p>
              <p className={styles.resultSub}>
                Added to your {payCurrency === 'USDT' ? 'Crypto' : 'Naira'} balance
              </p>
            </>
          ) : isLoss ? (
            <>
              <div className={styles.resultIllustration}>
                <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
                  <circle cx="55" cy="55" r="48" stroke="#6c7cbf" strokeWidth="5" strokeOpacity="0.9"/>
                  <circle cx="38" cy="46" r="6.5" fill="#6c7cbf"/>
                  <circle cx="72" cy="46" r="6.5" fill="#6c7cbf"/>
                  <path d="M36 76 Q55 62 74 76" stroke="#6c7cbf" strokeWidth="5.5" strokeLinecap="round" fill="none"/>
                </svg>
              </div>
              <p className={styles.resultHeading}>So Close!</p>
              <p className={styles.resultSub}>Give it another spin</p>
            </>
          ) : (
            <>
              <div className={styles.resultIllustration} style={{ fontSize: 100 }}>↩️</div>
              <p className={styles.resultHeading}>{isPush ? 'Stake Returned!' : 'Partial Return'}</p>
              <p className={styles.resultAmount}>
                {isPush ? `${formatCoins(spinResult.payout_amount)} coins` : fmtPay(winRaw)}
              </p>
              <p className={styles.resultSub}>
                {isPush
                  ? 'Your full stake has been returned to your coins'
                  : `Partial return on ${formatCoins(spinResult.stake_amount)} coin stake`}
              </p>
            </>
          )}

          {/* ── Buttons ── */}
          <div className={styles.resultActions}>
            <button className={styles.resultPrimaryBtn} onClick={handlePlayAgain}>
              {isLoss ? 'Try Again' : 'Spin Again'}
            </button>
            <div className={styles.resultSecondaryRow}>
              <button className={styles.resultSecondaryBtn} onClick={() => navigate('/wallet')}>
                Withdraw
              </button>
              <button className={styles.resultSecondaryBtn} onClick={handleShare}>
                Share Result
              </button>
            </div>
            <button className={styles.resultBackBtn} onClick={handlePlayAgain}>
              ‹ Back
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN SCREEN
  // ══════════════════════════════════════════════════════════════════════════

  if (loadingWheels) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Loading…</p>
      </div>
    )
  }

  // ── Peek summary derived values ───────────────────────────────────────────
  const loginClaimable  = loginChallenge?.my_progress?.claimable ?? false
  const hasClaimable    = loginClaimable
  const loginStreak     = loginChallenge?.my_progress?.current_count ?? 0

  return (
    <>
      <div className={styles.page}>

        {/* ══ FULL-SCREEN SPIN CONTENT ══ */}
        <div className={styles.spinContent}>

          {/* ── Top bar ── */}
          <div className={styles.topBar}>
            <div className={styles.coinPill}>
              <span>🪙</span>
              <span className={styles.coinPillValue}>🪙 {formatCoins(nairaCoins)}</span>
            </div>
            <div className={styles.topRight}>
              <button className={styles.iconBtn} onClick={toggleMute}>{muted ? '🔇' : '🔊'}</button>
              <button
                className={`${styles.kycBadge} ${kycOverall === 'approved' ? styles.kycBadgeVerified : kycOverall === 'partial' || kycOverall === 'rejected' ? styles.kycBadgeWarn : ''}`}
                onClick={() => navigate('/kyc')}
              >
                KYC{' '}
                {kycOverall === 'approved'
                  ? <span className={styles.kycIconGreen}>✓</span>
                  : kycOverall === 'partial' || kycOverall === 'rejected'
                    ? <span className={styles.kycIconOrange}>!</span>
                    : <span className={styles.kycIconDim}>›</span>
                }
              </button>
            </div>
          </div>

          {/* ── Welcome spin banner ── */}
          {welcomeWheel && phase === 'idle' && (
            <button
              className={styles.welcomeBanner}
              onClick={handleWelcomeSpin}
              disabled={phase !== 'idle'}
            >
              <span className={styles.welcomeIcon}>🎁</span>
              <div>
                <p className={styles.welcomeTitle}>Free Welcome Spin!</p>
                <p className={styles.welcomeSub}>Tap to claim — no stake needed</p>
              </div>
              <span className={styles.welcomeArrow}>›</span>
            </button>
          )}

          {/* ── Spin area (fills remaining space) ── */}
          <div className={styles.spinArea}>

            {/* Wheel canvas */}
            <div className={styles.wheelWrapper}>
              <div className={styles.wheelAmbient} />
              <SpinWheel
                key={wheelKey}
                segments={segments}
                onSpinComplete={handleAnimationDone}
                onSpinStart={handleSpinStart}
                onTick={handleTick}
                engineRef={engineRef}
              />
              {phase === 'preparing' && (
                <div className={styles.wheelOverlay}>
                  <div className={styles.spinner} />
                  <p>Locking in your spin…</p>
                </div>
              )}
              {phase === 'spinning' && <div className={styles.wheelBlock} />}
            </div>

            {/* ── Active wheel indicator ── */}
            <div className={styles.wheelBadgeRow}>
              {lookupState === 'searching' && (
                <span className={styles.wheelBadgeSearching}>
                  <span className={styles.spinnerInline} /> Finding wheel…
                </span>
              )}
              {lookupState === 'found' && resolvedWheel && (
                <span className={styles.wheelBadgeFound}>
                  {wheelEmoji(resolvedWheel.wheel_type)} {resolvedWheel.name}
                  <span className={styles.wheelBadgeRange}>
                    {' '}· ₦{parseFloat(resolvedWheel.min_stake).toLocaleString()}–
                    ₦{parseFloat(resolvedWheel.max_stake).toLocaleString()}
                  </span>
                </span>
              )}
              {(lookupState === 'not_found' || lookupState === 'error') && (
                <span className={styles.wheelBadgeError}>⚠ {lookupError}</span>
              )}
            </div>

            {/* ── Source wallet picker (3 buckets) ── */}
            {phase === 'idle' && (
              <div className={styles.walletPicker}>
                <button
                  className={`${styles.walletPickerOption} ${sourceWallet === 'naira_coins' ? styles.walletPickerSelected : ''}`}
                  onClick={() => setSourceWallet('naira_coins')}
                  disabled={nairaNum <= 0}
                >
                  <span className={styles.walletPickerIcon}>🪙</span>
                  <span className={styles.walletPickerLabel}>
                    Naira <span className={styles.walletPickerBal}>{formatCoins(nairaCoins)}</span>
                  </span>
                </button>
                <button
                  className={`${styles.walletPickerOption} ${sourceWallet === 'crypto_coins' ? styles.walletPickerSelected : ''}`}
                  onClick={() => setSourceWallet('crypto_coins')}
                  disabled={cryptoNum <= 0}
                >
                  <span className={styles.walletPickerIcon}>💎</span>
                  <span className={styles.walletPickerLabel}>
                    Crypto <span className={styles.walletPickerBal}>{formatUsdt(cryptoCoins)}</span>
                  </span>
                </button>
                <button
                  className={`${styles.walletPickerOption} ${sourceWallet === 'bonus_coins' ? styles.walletPickerSelected : ''}`}
                  onClick={() => { setSourceWallet('bonus_coins'); setShowBonusDest(true) }}
                  disabled={bonusNum <= 0}
                >
                  <span className={styles.walletPickerIcon}>🎁</span>
                  <span className={styles.walletPickerLabel}>
                    Bonus <span className={styles.walletPickerBal}>{formatCoins(bonusCoins)}</span>
                  </span>
                </button>
              </div>
            )}

            {/* ── Bonus destination summary (tap to change — full picker is a modal) ── */}
            {phase === 'idle' && sourceWallet === 'bonus_coins' && (
              <button className={styles.destSummary} onClick={() => setShowBonusDest(true)}>
                🎁 Winnings → <strong>{bonusDestination === 'crypto' ? '$ Crypto' : '₦ Naira'}</strong>
                <span className={styles.destSummaryChange}>Change</span>
              </button>
            )}

            {/* ── Stake section ── */}
            {phase !== 'error' && (
              <div className={styles.stakeSection}>
                <p className={styles.stakeLabel}>
                  Stake (Min ₦{parseFloat(activeWheels.find(w => !w.is_welcome_only)?.min_stake ?? '200').toLocaleString()})
                </p>
                <div className={styles.stakeInputRow}>
                  <span className={styles.stakeInputIcon}>🪙</span>
                  <input
                    className={styles.stakeInput}
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    disabled={phase !== 'idle'}
                  />
                </div>
                <div className={styles.quickRow}>
                  {stakePresets.slice(0, 8).map((amt) => (
                    <button
                      key={amt}
                      className={`${styles.quickChip} ${parseFloat(stake) === amt ? styles.quickChipActive : ''}`}
                      onClick={() => setStake(String(amt))}
                      disabled={phase !== 'idle'}
                    >
                      <span className={styles.quickChipIcon}>🪙</span>
                      {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Error ── */}
            {phase === 'error' && spinError && (
              <div className={styles.errorBox}>
                {spinError.code === 'INSUFFICIENT_FUNDS' ? (
                  <>
                    <p className={styles.errorMsg}>Not enough coins to spin</p>
                    <button
                      className={styles.errorDepositBtn}
                      onClick={() => { setShowFund(true); setPhase('idle') }}
                    >
                      Deposit Coins
                    </button>
                  </>
                ) : spinError.code === 'RATE_LIMITED' ? (
                  <p className={styles.errorMsg}>Max 60 spins/hour. Take a breather 😅</p>
                ) : (
                  <p className={styles.errorMsg}>{spinError.message}</p>
                )}
                <button className={styles.errorRetryBtn} onClick={handlePlayAgain}>Dismiss</button>
              </div>
            )}

            {/* ── Spin button ── */}
            <button
              className={styles.spinBtn}
              onClick={handleSpin}
              disabled={!canSpin || phase !== 'idle'}
            >
              {phase === 'preparing' ? 'Preparing…' :
               phase === 'spinning'  ? 'Spinning…'  : 'SPIN'}
            </button>

          </div>{/* end .spinArea */}

        </div>{/* end .spinContent */}

        {/* ══ FLOATING ACTION BUTTON — opens the rewards sheet ══ */}
        {!sheetOpen && (
          <button className={styles.fab} onClick={openSheet} aria-label="Rewards & recent spins">
            🎁{hasClaimable && <span className={styles.fabDot} />}
          </button>
        )}

        {/* ══ DIM OVERLAY — tap to close sheet ══ */}
        {sheetOpen && (
          <div className={styles.dimOverlay} onClick={closeSheet} />
        )}

        {/* ══ REWARDS SHEET (scales out of the FAB corner) ══ */}
        <div className={`${styles.sheet} ${sheetOpen ? styles.sheetOpen : ''}`}>
          {/* ── Header ── */}
          <div className={styles.sheetPeek}>
            <div className={styles.sheetHandleBar} />
            <div className={styles.sheetPeekRow}>
              <span className={styles.sheetPeekTitle}>
                🎁 Rewards
                {hasClaimable && <span className={styles.sheetPeekDot} />}
              </span>
              <div className={styles.sheetPeekChips}>
                {loginChallenge && (
                  <span className={`${styles.sheetPeekChip} ${loginClaimable ? styles.sheetPeekChipGlow : ''}`}>
                    🔥 Day {loginStreak}
                  </span>
                )}
              </div>
              <button className={styles.sheetClose} onClick={closeSheet} aria-label="Close">✕</button>
            </div>
          </div>

          {/* ── Scrollable sheet content ── */}
          <div className={styles.sheetScroll}>

            {/* Login streak */}
            {loginChallenge && (
              <div className={styles.sheetSection}>
                <p className={styles.sheetSectionTitle}>📅 Login Streak</p>
                <LoginStreakCard
                  challenge={loginChallenge}
                  onClaim={claimLoginChallenge}
                  claiming={claimingChallenge}
                />
              </div>
            )}

            {/* Recent spins */}
            {recentSpins.length > 0 && (
              <div className={styles.sheetSection}>
                <p className={styles.sheetSectionTitle}>Recent Spins</p>
                <div className={styles.recentList}>
                  {recentSpins.map((s) => (
                    <div key={s.id} className={styles.recentRow}>
                      <div>
                        <p className={styles.recentStake}>
                          Stake: <strong>{formatCoins(s.stake_amount)} coins</strong>
                        </p>
                        <p className={styles.recentMult}>{s.segment_label} Multiplier</p>
                      </div>
                      <span className={`${styles.recentOutcome} ${styles[`oc_${s.outcome}`]}`}>
                        {s.outcome === 'win'
                          ? `+${formatNaira(s.payout_amount)}`
                          : s.outcome === 'loss'
                            ? 'LOSS'
                            : formatNaira(s.payout_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>{/* end .sheetScroll */}
        </div>{/* end .sheet */}

      </div>

      {showFund && (
        <FundWalletModal
          onClose={() => setShowFund(false)}
          onSuccess={handleFundSuccess}
        />
      )}

      {/* ── Bonus destination dialog ── */}
      {showBonusDest && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setShowBonusDest(false)}
        >
          <div className={styles.modalCard}>
            <p className={styles.modalTitle}>Where should your winnings go?</p>
            <p className={styles.modalSub}>
              Bonus spins pay out {bonusPayoutLabel(settings)} of the win. Choose the balance it lands in.
            </p>
            <div className={styles.modalChoices}>
              <button
                className={`${styles.modalChoice} ${bonusDestination === 'naira' ? styles.modalChoiceSel : ''}`}
                onClick={() => { setBonusDestination('naira'); setShowBonusDest(false) }}
              >
                <span className={styles.modalChoiceIcon}>₦</span>
                <span className={styles.modalChoiceName}>Naira balance</span>
                <span className={styles.modalChoiceHint}>Withdraw to bank</span>
              </button>
              <button
                className={`${styles.modalChoice} ${bonusDestination === 'crypto' ? styles.modalChoiceSel : ''}`}
                onClick={() => { setBonusDestination('crypto'); setShowBonusDest(false) }}
              >
                <span className={styles.modalChoiceIcon}>$</span>
                <span className={styles.modalChoiceName}>Crypto balance</span>
                <span className={styles.modalChoiceHint}>Withdraw to wallet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <toast.View />
    </>
  )
}
