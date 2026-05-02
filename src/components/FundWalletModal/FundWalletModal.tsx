import { useState, useCallback } from 'react'
import { deposits } from '@/api/endpoints'
import { pollDeposit } from '@/lib/pollDeposit'
import type { DepositRecord } from '@/types'
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
  const [provider, setProvider] = useState<Provider>('paystack')
  const [amount, setAmount] = useState('')
  const [stage, setStage] = useState<Stage>('form')
  const [deposit, setDeposit] = useState<DepositRecord | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = useCallback(async () => {
    const num = parseFloat(amount)
    if (!amount || isNaN(num) || num < 100) {
      setErrorMsg('Minimum deposit is ₦100')
      return
    }

    setErrorMsg('')
    setStage('loading')

    try {
      const record = await deposits.initiate({
        amount: num.toFixed(2),
        provider,
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
  }, [amount, provider, onSuccess])

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

            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              placeholder="Enter Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={100}
            />

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
