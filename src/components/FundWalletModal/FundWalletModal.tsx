import { useState, useCallback, useEffect, useRef } from 'react'
import { deposits } from '@/api/endpoints'
import { pollDeposit } from '@/lib/pollDeposit'
import { useSettingsStore, coinsForNgn, coinsForUsd } from '@/store/settingsStore'
import type { DepositRecord, CryptoCurrency } from '@/types'
import styles from './FundWalletModal.module.css'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

type Provider = 'paystack' | 'nowpayments'
type Stage =
  | 'form'
  | 'loading'
  | 'paystack-pending'   // link opened, waiting for user to return
  | 'crypto-address'     // show USDT address + QR
  | 'success'
  | 'error'

export function FundWalletModal({ onClose, onSuccess }: Props) {
  const settings = useSettingsStore((s) => s.settings)
  const [provider, setProvider] = useState<Provider>('paystack')
  const [amount, setAmount] = useState('')
  const [stage, setStage] = useState<Stage>('form')
  const [deposit, setDeposit] = useState<DepositRecord | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Crypto coin picker (NowPayments)
  const [cryptoCurrencies, setCryptoCurrencies] = useState<CryptoCurrency[]>([])
  const [payCurrency, setPayCurrency] = useState('usdt')

  // Lazily load the crypto coin list when the user switches to the crypto tab
  useEffect(() => {
    if (provider !== 'nowpayments' || cryptoCurrencies.length > 0) return
    deposits.cryptoCurrencies()
      .then((r) => {
        if (r.currencies?.length) {
          setCryptoCurrencies(r.currencies)
          const stable = r.currencies.find((c) => c.is_stable)
          setPayCurrency((stable ?? r.currencies[0]).code)
        }
      })
      .catch(() => {/* fall back to usdt default */})
  }, [provider, cryptoCurrencies.length])

  // Dynamic minimums from public settings (admin-configurable)
  const minNgn = parseFloat(settings?.min_deposit_ngn ?? '1000')
  const minUsd = parseFloat(settings?.min_deposit_usd ?? '20')
  const isCrypto = provider === 'nowpayments'
  const minAmount = isCrypto ? minUsd : minNgn
  const amountNum = parseFloat(amount) || 0
  const coinPreview = isCrypto
    ? coinsForUsd(amountNum)
    : coinsForNgn(amountNum)

  const handleSubmit = useCallback(async () => {
    const num = parseFloat(amount)
    if (!amount || isNaN(num) || num < minAmount) {
      setErrorMsg(
        isCrypto ? `Minimum deposit is $${minUsd}` : `Minimum deposit is ₦${minNgn.toLocaleString()}`
      )
      return
    }

    setErrorMsg('')
    setStage('loading')

    try {
      const record = await deposits.initiate({
        amount: String(num),
        provider,
        ...(isCrypto ? { pay_currency: payCurrency } : {}),
      })
      setDeposit(record)

      if (provider === 'paystack') {
        // Open Paystack checkout in external browser
        const tg = (window as any).Telegram?.WebApp
        if (tg?.openLink) {
          tg.openLink(record.payment_url)
        } else {
          window.open(record.payment_url, '_blank')
        }
        setStage('paystack-pending')
      } else {
        // NOWPayments — show address and start polling
        setStage('crypto-address')
        pollDeposit(record.id, { maxAttempts: 300, intervalMs: 3000 }).then(
          (result) => {
            if (result.success) {
              setStage('success')
              onSuccess()
            }
          }
        )
      }
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.message ?? 'Could not initiate deposit. Try again.'
      )
      setStage('form')
    }
  }, [amount, provider, payCurrency, isCrypto, minAmount, minNgn, minUsd, onSuccess])

  const handleCheckPaystack = useCallback(async () => {
    if (!deposit) return
    setStage('loading')
    const result = await pollDeposit(deposit.id, { maxAttempts: 10, intervalMs: 2000 })
    if (result.success) {
      setStage('success')
      onSuccess()
    } else if (result.reason === 'timeout') {
      setStage('paystack-pending') // still waiting, back to pending state
    } else {
      setErrorMsg('Payment was not completed.')
      setStage('error')
    }
  }, [deposit, onSuccess])

  // Auto-check the moment the user returns to the mini app after visiting
  // the Paystack checkout page. We use both the Page Visibility API and
  // Telegram's own 'activated' event so it works across all platforms.
  // A ref guards against double-firing if both events trigger together.
  const autoCheckFired = useRef(false)

  useEffect(() => {
    if (stage !== 'paystack-pending') return

    autoCheckFired.current = false // reset guard when entering pending state

    function triggerCheck() {
      if (autoCheckFired.current) return
      autoCheckFired.current = true
      // Small delay: gives Paystack's webhook time to hit the backend
      // before we start polling, avoiding a false "still pending" result.
      setTimeout(() => handleCheckPaystack(), 1500)
    }

    // Standard browser visibility event — fires when user switches back
    // from Telegram's in-app browser to the mini app.
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') triggerCheck()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    // Telegram SDK event — more reliable on some platforms
    const tg = (window as { Telegram?: { WebApp?: { onEvent?: (event: string, cb: () => void) => void; offEvent?: (event: string, cb: () => void) => void } } }).Telegram?.WebApp
    tg?.onEvent?.('activated', triggerCheck)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      tg?.offEvent?.('activated', triggerCheck)
    }
  }, [stage, handleCheckPaystack])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    const tg = (window as any).Telegram?.WebApp
    tg?.HapticFeedback?.notificationOccurred('success')
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Fund Wallet</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── Form ── */}
        {(stage === 'form' || stage === 'loading') && (
          <>
            <div className={styles.radioGroup}>
              <label className={`${styles.radio} ${provider === 'paystack' ? styles.radioActive : ''}`}>
                <input
                  type="radio"
                  name="provider"
                  value="paystack"
                  checked={provider === 'paystack'}
                  onChange={() => setProvider('paystack')}
                />
                <span className={styles.radioCircle} />
                Cash
              </label>
              <label className={`${styles.radio} ${provider === 'nowpayments' ? styles.radioActive : ''}`}>
                <input
                  type="radio"
                  name="provider"
                  value="nowpayments"
                  checked={provider === 'nowpayments'}
                  onChange={() => setProvider('nowpayments')}
                />
                <span className={styles.radioCircle} />
                Crypto
              </label>
            </div>

            {/* Crypto coin picker */}
            {isCrypto && cryptoCurrencies.length > 0 && (
              <select
                className={styles.input}
                value={payCurrency}
                onChange={(e) => setPayCurrency(e.target.value)}
              >
                {cryptoCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code.toUpperCase()})
                  </option>
                ))}
              </select>
            )}

            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              placeholder={isCrypto ? 'Enter USD Amount' : 'Enter Amount (₦)'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={minAmount}
            />

            <p className={styles.previewHint}>
              Min {isCrypto ? `$${minUsd}` : `₦${minNgn.toLocaleString()}`}
              {amountNum >= minAmount && (
                <> · You'll get <strong>🪙 {coinPreview.toLocaleString()}</strong> coins</>
              )}
            </p>

            {errorMsg && <p className={styles.error}>{errorMsg}</p>}

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={stage === 'loading'}
            >
              {stage === 'loading' ? 'Processing...' : 'Submit'}
            </button>
          </>
        )}

        {/* ── Paystack pending ── */}
        {stage === 'paystack-pending' && (
          <div className={styles.pendingState}>
            <p className={styles.pendingText}>
              Complete your payment in the browser, then tap below to confirm.
            </p>
            <button className={styles.submitBtn} onClick={handleCheckPaystack}>
              I've Paid — Check Status
            </button>
            <button className={styles.ghostBtn} onClick={onClose}>
              Check Later
            </button>
          </div>
        )}

        {/* ── Crypto address ── */}
        {stage === 'crypto-address' && deposit && (
          <div className={styles.cryptoState}>
            <p className={styles.cryptoLabel}>Send exactly</p>
            <p className={styles.cryptoAmount}>
              {deposit.original_amount} USDT
            </p>
            <p className={styles.cryptoRate}>
              1 USDT = ₦{parseFloat(deposit.conversion_rate ?? '0').toLocaleString()}
            </p>
            <img
              className={styles.qr}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${deposit.payment_address}`}
              alt="USDT address QR"
            />
            <button
              className={styles.addressBox}
              onClick={() => copyToClipboard(deposit.payment_address)}
            >
              <span className={styles.addressText}>{deposit.payment_address}</span>
              <span className={styles.copyHint}>Tap to copy</span>
            </button>
            <p className={styles.warning}>
              ⚠️ TRC-20 network only. Sending other tokens will result in lost funds.
            </p>
            <p className={styles.pendingText}>Checking for payment (2–15 min)…</p>
          </div>
        )}

        {/* ── Success ── */}
        {stage === 'success' && (
          <div className={styles.successState}>
            <p className={styles.successIcon}>🎉</p>
            <p className={styles.successText}>
              ₦{parseFloat(deposit?.amount ?? '0').toLocaleString()} coins added to your wallet!
            </p>
            <button className={styles.submitBtn} onClick={onClose}>
              Spin Now
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {stage === 'error' && (
          <div className={styles.pendingState}>
            <p className={styles.error}>{errorMsg || 'Payment was not completed.'}</p>
            <button className={styles.submitBtn} onClick={() => setStage('form')}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
