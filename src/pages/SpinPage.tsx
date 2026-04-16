import { useRef, useState, useEffect, useCallback } from 'react'
import { SpinWheel } from '@/components/SpinWheel/SpinWheel'
import { SpinEngine, type WheelSegment } from '@/components/SpinWheel/spinEngine'
import { spin as spinApi, wallet } from '@/api/endpoints'
import { useWalletStore } from '@/store/walletStore'
import { useTelegram } from '@/hooks/useTelegram'
import { useAuthStore } from '@/store/authStore'
import type { RTPTier } from '@/types'
import styles from './SpinPage.module.css'

type SpinState = 'idle' | 'spinning' | 'result'

export function SpinPage() {
  const engineRef = useRef<SpinEngine | null>(null)
  const { haptic } = useTelegram()
  const { user } = useAuthStore()
  const { coinBalance, cashBalance, setBalance } = useWalletStore()

  const [spinState, setSpinState] = useState<SpinState>('idle')
  const [stake, setStake] = useState(100)
  const [tiers, setTiers] = useState<RTPTier[]>([])
  const [segments, setSegments] = useState<WheelSegment[]>([])
  const [lastResult, setLastResult] = useState<{
    label: string
    multiplier: string
    coinWon: string
    cashWon: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch RTP tiers to build wheel segments
  useEffect(() => {
    spinApi.tiers().then((data) => {
      setTiers(data)
      if (data.length > 0) {
        const activeTier = data[0]
        const mapped: WheelSegment[] = activeTier.outcomes.map((o) => ({
          label: o.label,
          multiplier: o.multiplier + 'x',
          color: o.color,
          probability: parseFloat(o.probability),
        }))
        setSegments(mapped)
      }
    })

    // Fetch current wallet balance
    wallet.balance().then((b) => setBalance(b.coin_balance, b.cash_balance))
  }, [setBalance])

  const handleSpin = useCallback(async () => {
    if (spinState !== 'idle') return
    setError(null)

    const idempotencyKey = `${user?.id}-${Date.now()}`

    try {
      setSpinState('spinning')
      haptic.impactOccurred('medium')

      const result = await spinApi.execute({
        stake_amount: stake,
        idempotency_key: idempotencyKey,
      })

      // Find which segment index matches the outcome label
      const segmentIndex = segments.findIndex(
        (s) => s.label === result.label
      )
      const resolvedIndex = segmentIndex >= 0 ? segmentIndex : 0

      setLastResult({
        label: result.label,
        multiplier: result.multiplier,
        coinWon: result.coin_won,
        cashWon: result.cash_won,
      })

      engineRef.current?.spinTo(resolvedIndex)
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } }
      setError(
        apiErr.response?.data?.message ?? 'Spin failed. Please try again.'
      )
      setSpinState('idle')
      haptic.notificationOccurred('error')
    }
  }, [spinState, user, stake, segments, haptic])

  const handleSpinComplete = useCallback(
    (_index: number) => {
      setSpinState('result')
      wallet
        .balance()
        .then((b) => setBalance(b.coin_balance, b.cash_balance))

      if (lastResult && parseFloat(lastResult.coinWon) > 0) {
        haptic.notificationOccurred('success')
      } else {
        haptic.notificationOccurred('warning')
      }
    },
    [lastResult, haptic, setBalance]
  )

  const handlePlayAgain = () => {
    setSpinState('idle')
    setLastResult(null)
  }

  return (
    <div className={styles.page}>
      {/* Wallet strip */}
      <div className={styles.balanceBar}>
        <div className={styles.balanceItem}>
          <span className={styles.balanceLabel}>Coins</span>
          <span className={styles.balanceValue}>
            {coinBalance
              ? parseFloat(coinBalance).toLocaleString()
              : '—'}
          </span>
        </div>
        <div className={styles.divider} />
        <div className={styles.balanceItem}>
          <span className={styles.balanceLabel}>Cash</span>
          <span className={styles.balanceValue}>
            ₦
            {cashBalance
              ? parseFloat(cashBalance).toLocaleString()
              : '—'}
          </span>
        </div>
      </div>

      {/* Wheel */}
      <div className={styles.wheelWrapper}>
        <SpinWheel
          segments={segments}
          onSpinComplete={handleSpinComplete}
          engineRef={engineRef}
        />
      </div>

      {/* Result overlay */}
      {spinState === 'result' && lastResult && (
        <div className={styles.result}>
          {parseFloat(lastResult.coinWon) > 0 ? (
            <>
              <p className={styles.resultLabel}>You won!</p>
              <p className={styles.resultValue}>
                {parseFloat(lastResult.coinWon).toLocaleString()} coins
              </p>
              {parseFloat(lastResult.cashWon) > 0 && (
                <p className={styles.resultCash}>
                  + ₦{parseFloat(lastResult.cashWon).toLocaleString()}
                </p>
              )}
            </>
          ) : (
            <>
              <p className={styles.resultLabel}>Try again!</p>
              <p className={styles.resultSub}>Better luck next spin</p>
            </>
          )}
          <button className={styles.playAgainBtn} onClick={handlePlayAgain}>
            Spin Again
          </button>
        </div>
      )}

      {/* Stake selector + spin button */}
      {spinState === 'idle' && (
        <div className={styles.controls}>
          <div className={styles.stakeRow}>
            <span className={styles.stakeLabel}>Stake</span>
            <div className={styles.stakeOptions}>
              {[50, 100, 250, 500].map((amount) => (
                <button
                  key={amount}
                  className={`${styles.stakeBtn} ${stake === amount ? styles.stakeActive : ''}`}
                  onClick={() => setStake(amount)}
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.spinBtn} onClick={handleSpin}>
            SPIN
          </button>
        </div>
      )}

      {spinState === 'spinning' && (
        <div className={styles.controls}>
          <p className={styles.spinningText}>Spinning...</p>
        </div>
      )}
    </div>
  )
}
