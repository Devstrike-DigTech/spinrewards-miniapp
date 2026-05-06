import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SpinWheel } from '@/components/SpinWheel/SpinWheel'
import { SpinEngine, DEFAULT_SEGMENTS } from '@/components/SpinWheel/spinEngine'
import { Confetti } from '@/components/Confetti/Confetti'
import { FundWalletModal } from '@/components/FundWalletModal/FundWalletModal'
import { spin as spinApi, wallet, rewards as rewardsApi } from '@/api/endpoints'
import { useWalletStore } from '@/store/walletStore'
import { useTelegram } from '@/hooks/useTelegram'
import { sounds } from '@/lib/sounds'
import { getWheelVisualConfig, deriveStakePresets } from '@/lib/wheelConfig'
import { formatNaira, formatCoins } from '@/lib/format'
import type { WheelRecord, SpinResult, DailyRewardStatus } from '@/types'
import styles from './SpinPage.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function wheelEmoji(type: string) {
  return (
    { standard: '🎡', power: '⚡', mega: '🔥', welcome: '🎁', daily_challenge: '📅' }[type] ??
    '🎰'
  )
}

const DAY_MULTIPLIERS = [100, 200, 300, 400, 500, 600, 1000]

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

// ── Component ─────────────────────────────────────────────────────────────────

export function SpinPage() {
  const engineRef = useRef<SpinEngine | null>(null)
  const navigate = useNavigate()
  const { haptic } = useTelegram()
  const { coinBalance, setBalance } = useWalletStore()

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

  // Daily reward
  const [dailyReward, setDailyReward] = useState<DailyRewardStatus | null>(null)
  const [claimingReward, setClaimingReward] = useState(false)

  // Recent spins
  const [recentSpins, setRecentSpins] = useState<SpinResult[]>([])

  // Fund modal
  const [showFund, setShowFund] = useState(false)

  // Mute
  const [muted, setMuted] = useState(false)

  // ── Load active wheels + supplemental data on mount ───────────────────────
  useEffect(() => {
    Promise.allSettled([
      spinApi.activeWheels(),
      wallet.balance(),
      rewardsApi.status(),
      spinApi.history(1),
    ]).then(([wheelsR, balR, rewardR, histR]) => {
      if (wheelsR.status === 'fulfilled') {
        const list = wheelsR.value
        setActiveWheels(list)
        setWelcomeWheel(list.find((w) => w.is_welcome_only) ?? null)
      }
      if (balR.status === 'fulfilled') {
        const b = balR.value
        setBalance(b.coin_balance, b.cash_balance, b.staked_balance)
      }
      if (rewardR.status === 'fulfilled') setDailyReward(rewardR.value)
      if (histR.status === 'fulfilled') {
        const d = histR.value
        setRecentSpins(Array.isArray(d) ? d.slice(0, 5) : (d?.results ?? []).slice(0, 5))
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

  // ── Segments: derived from the currently resolved wheel ───────────────────
  const segments = useMemo(
    () =>
      resolvedWheel
        ? getWheelVisualConfig(resolvedWheel.wheel_type)
        : DEFAULT_SEGMENTS,
    [resolvedWheel]
  )

  // Re-key the SpinWheel when the wheel type changes so Pixi re-initialises
  const wheelKey = resolvedWheel?.wheel_type ?? 'default'

  // ── Daily reward ──────────────────────────────────────────────────────────
  const claimDailyReward = useCallback(async () => {
    if (!dailyReward?.can_claim || claimingReward) return
    setClaimingReward(true)
    try {
      await rewardsApi.claim()
      const [updated, bal] = await Promise.all([rewardsApi.status(), wallet.balance()])
      setDailyReward(updated)
      setBalance(bal.coin_balance, bal.cash_balance, bal.staked_balance)
      haptic.notificationOccurred('success')
    } catch {
      haptic.notificationOccurred('error')
    } finally {
      setClaimingReward(false)
    }
  }, [dailyReward, claimingReward, haptic, setBalance])

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
  }, [phase, resolvedWheel, stake, haptic])

  // Called by SpinEngine when animation starts
  const handleSpinStart = useCallback(() => {
    sounds.startSpin()
  }, [])

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
      .then((b) => setBalance(b.coin_balance, b.cash_balance, b.staked_balance))
      .catch(() => {})
  }, [spinResult, haptic, setBalance])

  const handlePlayAgain = useCallback(() => {
    setPhase('idle')
    setSpinResult(null)
    setSpinError(null)
  }, [])

  const handleFundSuccess = useCallback(() => {
    setShowFund(false)
    wallet.balance()
      .then((b) => setBalance(b.coin_balance, b.cash_balance, b.staked_balance))
      .catch(() => {})
  }, [setBalance])

  const toggleMute = useCallback(() => {
    const next = !muted
    setMuted(next)
    sounds.setMuted(next)
  }, [muted])

  // ── Derived ───────────────────────────────────────────────────────────────
  const canSpin =
    phase === 'idle' &&
    lookupState === 'found' &&
    !!resolvedWheel &&
    parseFloat(stake) > 0

  // ══════════════════════════════════════════════════════════════════════════
  // RESULT FULL-SCREEN OVERLAY
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'revealing' && spinResult) {
    const isWin  = spinResult.outcome === 'win'
    const isLoss = spinResult.outcome === 'loss'
    const isPush = spinResult.outcome === 'push'

    const shareText = isWin
      ? `🎉 I just won ${formatNaira(spinResult.payout_amount)} on Spin Rewards! Join me 👉 https://t.me/SpinRewardsBot`
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
              <p className={styles.resultAmount}>{formatNaira(spinResult.payout_amount)}</p>
              <p className={styles.resultSub}>Added to your withdrawable balance</p>
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
              <p className={styles.resultAmount}>{formatNaira(spinResult.payout_amount)}</p>
              <p className={styles.resultSub}>
                {isPush
                  ? 'Your full stake has been returned'
                  : `Partial return on ${formatNaira(spinResult.stake_amount)} stake`}
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

  return (
    <>
      <div className={styles.page}>

        {/* ══ FIXED TOP — topBar + welcomeBanner + spinCard ══ */}
        <div className={styles.fixedTop}>

          {/* ── Top bar ── */}
          <div className={styles.topBar}>
            <div className={styles.coinPill}>
              <span>🪙</span>
              <span className={styles.coinPillValue}>{formatCoins(coinBalance)}</span>
            </div>
            <div className={styles.topRight}>
              <button className={styles.iconBtn} onClick={toggleMute}>{muted ? '🔇' : '🔊'}</button>
              <button className={styles.iconBtn}>🔔</button>
              <div className={styles.kycBadge}>KYC <span className={styles.kycCheck}>✓</span></div>
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

          {/* ── Spin card ── */}
          <div className={styles.spinCard}>
            <p className={styles.spinCardTitle}>Enter stake and spin!</p>

            {/* Wheel canvas */}
            <div className={styles.wheelWrapper}>
              <SpinWheel
                key={wheelKey}
                segments={segments}
                onSpinComplete={handleAnimationDone}
                onSpinStart={handleSpinStart}
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

                {/* Horizontally scrollable preset chips */}
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

            {/* ── Error inside card ── */}
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
          </div>

        </div>{/* end .fixedTop */}

        {/* ══ SCROLLABLE AREA — daily reward + recent spins ══ */}
        <div className={styles.scrollArea}>

          {/* ── Daily reward ── */}
          {dailyReward && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Daily Reward</p>
              <div className={styles.dayStrip}>
                {DAY_MULTIPLIERS.map((mult, idx) => {
                  const day = idx + 1
                  const streak = dailyReward.current_streak
                  const claimed = day <= streak
                  const canClaim = day === streak + 1 && dailyReward.can_claim
                  return (
                    <div key={day} className={`${styles.dayCard} ${claimed ? styles.dayCardClaimed : ''} ${canClaim ? styles.dayCardActive : ''}`}>
                      <p className={styles.dayLabel}>Day {day}</p>
                      <span className={styles.dayIcon}>🪙</span>
                      <p className={styles.dayMult}>x{mult}</p>
                      {claimed ? (
                        <span className={styles.dayCheck}>✓</span>
                      ) : (
                        <button
                          className={`${styles.claimBtn} ${!canClaim ? styles.claimBtnLocked : ''}`}
                          onClick={canClaim ? claimDailyReward : undefined}
                          disabled={!canClaim || claimingReward}
                        >
                          {claimingReward && canClaim ? '…' : 'Claim'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Recent spins ── */}
          {recentSpins.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Recent Spins</p>
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

        </div>{/* end .scrollArea */}

      </div>

      {showFund && (
        <FundWalletModal
          onClose={() => setShowFund(false)}
          onSuccess={handleFundSuccess}
        />
      )}
    </>
  )
}
