import { useState, useCallback } from 'react'
import { withdrawals } from '@/api/endpoints'
import { formatNaira } from '@/lib/format'
import styles from './WithdrawModal.module.css'

const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '030', name: 'Heritage Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '50515', name: 'Moniepoint Microfinance Bank' },
  { code: '999992', name: 'OPay Digital Services' },
  { code: '999991', name: 'PalmPay' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '50211', name: 'Kuda Bank' },
]

interface Props {
  cashBalance: string | null
  onClose: () => void
  onSuccess: () => void
}

type Stage = 'form' | 'loading' | 'success' | 'error'

export function WithdrawModal({ cashBalance, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [stage, setStage] = useState<Stage>('form')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = useCallback(async () => {
    const num = parseFloat(amount)
    if (!amount || isNaN(num) || num < 2000) {
      setErrorMsg('Minimum withdrawal is ₦2,000')
      return
    }
    const cashNum = parseFloat(cashBalance ?? '0')
    if (num > cashNum) {
      setErrorMsg('Amount exceeds your available balance')
      return
    }
    if (!bankCode) {
      setErrorMsg('Please select a bank')
      return
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      setErrorMsg('Account number must be exactly 10 digits')
      return
    }

    setErrorMsg('')
    setStage('loading')

    try {
      await withdrawals.request(num.toFixed(2))
      setStage('success')
      onSuccess()
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.message ?? 'Could not process withdrawal. Try again.'
      )
      setStage('error')
    }
  }, [amount, bankCode, accountNumber, cashBalance, onSuccess])

  const balanceDisplay = formatNaira(cashBalance ?? '0')

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Withdraw Earnings</h2>
            <p className={styles.subtitle}>Balance: {balanceDisplay}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── Form ── */}
        {(stage === 'form' || stage === 'loading') && (
          <>
            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              placeholder="Min ₦2,000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={2000}
            />

            <select
              className={styles.select}
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
            >
              <option value="" disabled>Select Bank</option>
              {NIGERIAN_BANKS.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>

            <input
              className={styles.input}
              type="text"
              inputMode="numeric"
              placeholder="Enter 10 digit number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
            />

            <p className={styles.hint}>Name must match KYC name</p>

            {errorMsg && <p className={styles.error}>{errorMsg}</p>}

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={stage === 'loading'}
            >
              {stage === 'loading' ? 'Processing…' : 'Withdraw'}
            </button>
            <button className={styles.ghostBtn} onClick={onClose}>
              Cancel
            </button>
          </>
        )}

        {/* ── Success ── */}
        {stage === 'success' && (
          <div className={styles.successState}>
            <p className={styles.successIcon}>✅</p>
            <p className={styles.successText}>
              Withdrawal submitted! Funds arrive within 1–3 business days.
            </p>
            <button className={styles.submitBtn} onClick={onClose}>
              Done
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {stage === 'error' && (
          <div className={styles.errorState}>
            <p className={styles.error}>{errorMsg || 'Withdrawal failed.'}</p>
            <button className={styles.submitBtn} onClick={() => setStage('form')}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
