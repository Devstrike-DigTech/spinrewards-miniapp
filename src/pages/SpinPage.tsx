import { useRef, useState, useEffect, useCallback } from 'react'
import { SpinWheel } from '@/components/SpinWheel/SpinWheel'
import { SpinEngine, type WheelSegment } from '@/components/SpinWheel/spinEngine'
import { FundWalletModal } from '@/components/FundWalletModal/FundWalletModal'
import { spin as spinApi, wallet } from '@/api/endpoints'
import { useWalletStore } from '@/store/walletStore'
import { useTelegram } from '@/hooks/useTelegram'
import { formatNaira, formatCoins } from '@/lib/format'
import type { WheelRecord, SpinResult } from '@/types'
import styles from './SpinPage.module.css'

// ── Visual segments per wheel type ───────────────────────────────────────────
// We always render 8 placeholder segments. segment_position from the API
// lands the pointer on the correct visual slot.

function makeSegments(wheelType: WheelRecord['wheel_type']): WheelSegment[] {
  const palettes: Record<WheelRecord['wheel_type'], string[]> = {
    welcome:         ['#1a2e5a','#2a3f7a','#1a2e5a','#c9a028','#1a2e5a','#2a3f7a','#1a2e5a','#c9a028'],
    standard:        ['#1a1a3e','#6c3de8','#1a1a3e','#e83d8a','#1a1a3e','#6c3de8','#1a1a3e','#e83d8a'],
    power:           ['#1a1a1a','#e87d3d','#1a1a1a','#e8c93d','#1a1a1a','#e87d3d','#1a1a1a','#e8c93d'],
    mega:            ['#0d0d2e','#0d3a6e','#0d0d2e','#1a237e','#0d0d2e','#0d3a6e','#0d0d2e','#c9a028'],
    daily_challenge: ['#0a2a1a','#1e5c3a','#0a2a1a','#3de88a','#0a2a1a','#1e5c3a','#0a2a1a','#3de88a'],
  }
  const colors = palettes[wheelType] ?? palettes.standard
  const labels = ['✦','✦','✦','✦','✦','✦','✦','✦']
  return colors.map((color, i) => ({
    label: labels[i],
    multiplier: labels[i],
    color,
  }))
}

// Quick-stake amounts per wheel
function stakeOptions(wheel: WheelRecord): number[] {
  const min = parseFloat(wheel.min_stake)
  const max = parseFloat(wheel.max_stake)
  if (min === 0) return []
  // 4 sensible round amounts within [min, max]
  const step = (max - min) / 4
  return [min, min + step, min + step * 2, max / 2]
    .map((v) => Math.round(v / 100) * 100)
    .filter((v, i, a) => v >= min && v <= max && a.indexOf(v) === i)
    .slice(0, 4)
}

// ── State types ───────────────────────────────────────────────────────────────

type SpinPhase = 'idle' | 'preparing' | 'spinning' | 'revealing' | 'error'

interface SpinError {
  code?: string
  message: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SpinPage() {
  const engineRef = useRef<SpinEngine | null>(null)
  const { haptic } = useTelegram()
  const { coinBalance, cashBalance, setBalance } = useWalletStore()

  // Wheels
  const [wheels, setWheels] = useState<WheelRecord[]>([])
  const [selectedWheel, setSelectedWheel] = useState<WheelRecord | null>(null)
  const [loadingWheels, setLoadingWheels] = useState(true)

  // Spin state machine
  const [phase, setPhase] = useState<SpinPhase>('idle')
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null)
  const [spinError, setSpinError] = useState<SpinError | null>(null)

  // Stake
  const [stake, setStake] = useState<string>('')
  const [stakeError, setStakeError] = useState<string>('')

  // Fund modal (open when INSUFFICIENT_FUNDS)
  const [showFund, setShowFund] = useState(false)

  // ── Load wheels on mount ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.allSettled([spinApi.wheels(), wallet.balance()]).then(
      ([wheelsResult, balanceResult]) => {
        if (wheelsResult.status === 'fulfilled') {
          const list = wheelsResult.value
          setWheels(list)
          // Default to first non-welcome wheel, fallback to welcome
          const defaultWheel =
            list.find((w) => !w.is_welcome_only) ?? list[0] ?? null
          setSelectedWheel(defaultWheel)
          if (defaultWheel && !defaultWheel.is_welcome_only) {
            const opts = stakeOptions(defaultWheel)
            setStake(opts[0]?.toString() ?? defaultWheel.min_stake)
          }
        }
        if (balanceResult.status === 'fulfilled') {
          const b = balanceResult.value
          setBalance(b.coin_balance, b.cash_balance, b.staked_balance)
        }
        setLoadingWheels(false)
      }
    )
  }, [setBalance])

  // Update stake default when user switches wheels
  const selectWheel = useCallback((wheel: WheelRecord) => {
    setSelectedWheel(wheel)
    setStakeError('')
    if (!wheel.is_welcome_only) {
      const opts = stakeOptions(wheel)
      setStake(opts[0]?.toString() ?? wheel.min_stake)
    } else {
      setStake('')
    }
  }, [])

  // ── Spin handler ──────────────────────────────────────────────────────────
  const handleSpin = useCallback(async () => {
    if (!selectedWheel || phase !== 'idle') return

    // Validate stake for paid wheels
    if (!selectedWheel.is_welcome_only) {
      const num = parseFloat(stake)
      const min = parseFloat(selectedWheel.min_stake)
      const max = parseFloat(selectedWheel.max_stake)
      if (!stake || isNaN(num)) {
        setStakeError('Enter a stake amount')
        return
      }
      if (num < min || num > max) {
        setStakeError(`Stake must be ₦${min.toLocaleString()}–₦${max.toLocaleString()}`)
        return
      }
    }
    setStakeError('')
    setSpinError(null)
    setPhase('preparing')
    haptic.impactOccurred('medium')

    try {
      let result: SpinResult

      if (selectedWheel.is_welcome_only) {
        result = await spinApi.welcome()
      } else {
        const stakeNum = parseFloat(stake)
        result = await spinApi.execute({
          wheel_id: selectedWheel.id,
          stake_amount: stakeNum.toFixed(2),
        })
      }

      // Outcome is locked — start animation
      setSpinResult(result)
      setPhase('spinning')
      engineRef.current?.spinTo(result.segment_position)
      // onSpinComplete callback (handleAnimationDone) will advance to 'revealing'
    } catch (err: any) {
      const code = err?.response?.data?.code as string | undefined
      const message =
        err?.response?.data?.message ?? 'Spin failed. Please try again.'
      setSpinError({ code, message })
      setPhase('error')
      haptic.notificationOccurred('error')
    }
  }, [selectedWheel, phase, stake, haptic])

  // Called by SpinWheel when animation finishes
  const handleAnimationDone = useCallback(() => {
    setPhase('revealing')

    if (spinResult?.outcome === 'win') {
      haptic.notificationOccurred('success')
    } else {
      haptic.notificationOccurred('warning')
    }

    // Refresh wallet in background
    wallet
      .balance()
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
    wallet
      .balance()
      .then((b) => setBalance(b.coin_balance, b.cash_balance, b.staked_balance))
      .catch(() => {})
  }, [setBalance])

  // ── Derived ───────────────────────────────────────────────────────────────
  const welcomeWheel = wheels.find((w) => w.is_welcome_only) ?? null
  const paidWheels = wheels.filter((w) => !w.is_welcome_only)
  const segments = selectedWheel ? makeSegments(selectedWheel.wheel_type) : []
  const isFreeSpin = !!selectedWheel?.is_welcome_only
  const canSpin =
    phase === 'idle' &&
    !!selectedWheel &&
    (isFreeSpin || (!!stake && !stakeError))

  if (loadingWheels) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Loading wheels…</p>
      </div>
    )
  }

  return (
    <>
      <div className={styles.page}>
        {/* ── Balance bar ── */}
        <div className={styles.balanceBar}>
          <div className={styles.balanceItem}>
            <span className={styles.balanceIcon}>🪙</span>
            <div>
              <p className={styles.balanceLabel}>Coins</p>
              <p className={styles.balanceValue}>{formatCoins(coinBalance)}</p>
            </div>
          </div>
          <div className={styles.balanceDivider} />
          <div className={styles.balanceItem}>
            <span className={styles.balanceIcon}>💵</span>
            <div>
              <p className={styles.balanceLabel}>Cash</p>
              <p className={styles.balanceValue}>{formatNaira(cashBalance)}</p>
            </div>
          </div>
        </div>

        {/* ── Welcome spin banner ── */}
        {welcomeWheel && phase === 'idle' && (
          <button
            className={styles.welcomeBanner}
            onClick={() => selectWheel(welcomeWheel)}
          >
            <span className={styles.welcomeIcon}>🎁</span>
            <div className={styles.welcomeText}>
              <p className={styles.welcomeTitle}>You have a FREE spin!</p>
              <p className={styles.welcomeSub}>Tap to claim your welcome spin</p>
            </div>
            <span className={styles.welcomeArrow}>›</span>
          </button>
        )}

        {/* ── Wheel selector tabs ── */}
        {paidWheels.length > 1 && (
          <div className={styles.wheelTabs}>
            {paidWheels.map((w) => (
              <button
                key={w.id}
                className={`${styles.wheelTab} ${selectedWheel?.id === w.id ? styles.wheelTabActive : ''}`}
                onClick={() => selectWheel(w)}
                disabled={phase !== 'idle'}
              >
                {wheelEmoji(w.wheel_type)} {w.name}
              </button>
            ))}
          </div>
        )}

        {/* ── Wheel canvas ── */}
        <div className={styles.wheelWrapper}>
          <SpinWheel
            key={selectedWheel?.id ?? 'default'}
            segments={segments}
            onSpinComplete={handleAnimationDone}
            engineRef={engineRef}
          />

          {/* Preparing overlay */}
          {phase === 'preparing' && (
            <div className={styles.wheelOverlay}>
              <div className={styles.spinner} />
              <p className={styles.overlayText}>Locking in your spin…</p>
            </div>
          )}
        </div>

        {/* ── Controls / Result ── */}
        <div className={styles.controlsArea}>

          {/* IDLE: stake + spin button */}
          {phase === 'idle' && selectedWheel && (
            <div className={styles.controls}>
              {/* Wheel name heading */}
              <p className={styles.wheelName}>
                {isFreeSpin ? '🎁 Welcome Spin — FREE' : selectedWheel.name}
              </p>

              {/* Stake row for paid wheels */}
              {!isFreeSpin && (
                <>
                  <div className={styles.stakeQuickRow}>
                    {stakeOptions(selectedWheel).map((amt) => (
                      <button
                        key={amt}
                        className={`${styles.stakeChip} ${parseFloat(stake) === amt ? styles.stakeChipActive : ''}`}
                        onClick={() => { setStake(amt.toString()); setStakeError('') }}
                      >
                        ₦{amt >= 1000 ? `${amt / 1000}K` : amt}
                      </button>
                    ))}
                  </div>
                  <input
                    className={styles.stakeInput}
                    type="number"
                    inputMode="numeric"
                    placeholder={`₦${parseFloat(selectedWheel.min_stake).toLocaleString()} – ₦${parseFloat(selectedWheel.max_stake).toLocaleString()}`}
                    value={stake}
                    onChange={(e) => { setStake(e.target.value); setStakeError('') }}
                  />
                  {stakeError && <p className={styles.stakeError}>{stakeError}</p>}
                </>
              )}

              <button
                className={`${styles.spinBtn} ${isFreeSpin ? styles.spinBtnFree : ''}`}
                onClick={handleSpin}
                disabled={!canSpin}
              >
                {isFreeSpin ? '🎁 Claim Free Spin' : '🎡 SPIN'}
              </button>
            </div>
          )}

          {/* SPINNING: locked */}
          {phase === 'spinning' && (
            <div className={styles.spinningMsg}>
              <p>Spinning…</p>
            </div>
          )}

          {/* REVEALING: result panel */}
          {phase === 'revealing' && spinResult && (
            <ResultPanel result={spinResult} onContinue={handlePlayAgain} />
          )}

          {/* ERROR */}
          {phase === 'error' && spinError && (
            <div className={styles.errorPanel}>
              {spinError.code === 'INSUFFICIENT_FUNDS' ? (
                <>
                  <p className={styles.errorTitle}>Not enough coins</p>
                  <p className={styles.errorSub}>Top up your wallet to keep playing.</p>
                  <button className={styles.spinBtn} onClick={() => setShowFund(true)}>
                    Deposit Coins
                  </button>
                </>
              ) : spinError.code === 'RATE_LIMITED' ? (
                <>
                  <p className={styles.errorTitle}>Slow down! 😅</p>
                  <p className={styles.errorSub}>Max 60 spins per hour. Try again in a minute.</p>
                  <button className={styles.ghostBtn} onClick={handlePlayAgain}>OK</button>
                </>
              ) : (
                <>
                  <p className={styles.errorSub}>{spinError.message}</p>
                  <button className={styles.ghostBtn} onClick={handlePlayAgain}>Try Again</button>
                </>
              )}
            </div>
          )}

        </div>
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

// ── Result panel ──────────────────────────────────────────────────────────────

function ResultPanel({
  result,
  onContinue,
}: {
  result: SpinResult
  onContinue: () => void
}) {
  const { outcome, payout_amount, stake_amount, segment_label, is_welcome_spin } = result

  const isWin = outcome === 'win'
  const isPush = outcome === 'push'
  const isPartial = outcome === 'partial_loss'

  return (
    <div className={`${styles.resultPanel} ${isWin ? styles.resultWin : ''}`}>
      {isWin && <p className={styles.resultEmoji}>🎉</p>}
      {isPush && <p className={styles.resultEmoji}>↩️</p>}
      {isPartial && <p className={styles.resultEmoji}>💸</p>}
      {outcome === 'loss' && <p className={styles.resultEmoji}>😔</p>}

      <p className={styles.resultLabel}>{segment_label}</p>

      {isWin && (
        <>
          <p className={styles.resultAmount}>+{formatNaira(payout_amount)}</p>
          <p className={styles.resultSub}>
            {is_welcome_spin
              ? 'Added to your cash balance — no stake required!'
              : 'Added to your withdrawable cash balance'}
          </p>
        </>
      )}
      {isPush && (
        <>
          <p className={styles.resultAmountNeutral}>{formatNaira(payout_amount)}</p>
          <p className={styles.resultSub}>Your stake was returned</p>
        </>
      )}
      {isPartial && (
        <>
          <p className={styles.resultAmountNeutral}>{formatNaira(payout_amount)}</p>
          <p className={styles.resultSub}>
            Partial return of {formatNaira(stake_amount)} stake
          </p>
        </>
      )}
      {outcome === 'loss' && (
        <p className={styles.resultSub}>Better luck next time</p>
      )}

      <button className={styles.spinBtn} onClick={onContinue}>
        Spin Again
      </button>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function wheelEmoji(type: WheelRecord['wheel_type']): string {
  switch (type) {
    case 'standard':        return '🎡'
    case 'power':           return '⚡'
    case 'mega':            return '🔥'
    case 'welcome':         return '🎁'
    case 'daily_challenge': return '📅'
    default:                return '🎰'
  }
}
