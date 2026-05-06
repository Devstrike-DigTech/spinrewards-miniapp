import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { kyc as kycApi } from '@/api/endpoints'
import { useTelegram } from '@/hooks/useTelegram'
import type {
  KYCStatusResponse,
  KYCBank,
  KYCDocumentUploadResponse,
  KYCSectionStatus,
} from '@/types'
import styles from './KYCPage.module.css'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Section badge ──────────────────────────────────────────────────────────────

function SectionBadge({ number, status }: { number: number; status: KYCSectionStatus }) {
  if (status === 'verified') {
    return (
      <div className={`${styles.sectionBadge} ${styles.sectionBadgeVerified}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    )
  }
  if (status === 'requires_correction') {
    return (
      <div className={`${styles.sectionBadge} ${styles.sectionBadgeError}`}>
        !
      </div>
    )
  }
  if (status === 'rejected') {
    return (
      <div className={`${styles.sectionBadge} ${styles.sectionBadgeRejected}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
    )
  }
  return <div className={styles.sectionBadge}>{number}</div>
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  number,
  title,
  status,
  reason,
  children,
}: {
  number: number
  title: string
  status: KYCSectionStatus
  reason: string
  children: React.ReactNode
}) {
  const sectionClass = [
    styles.section,
    status === 'verified'             ? styles.sectionVerified  : '',
    status === 'requires_correction'  ? styles.sectionError     : '',
    status === 'rejected'             ? styles.sectionRejected  : '',
  ].join(' ')

  return (
    <div className={sectionClass}>
      <div className={styles.sectionHeader}>
        <SectionBadge number={number} status={status} />
        <span className={styles.sectionTitle}>{title}</span>
      </div>

      {(status === 'requires_correction' || status === 'rejected') && reason && (
        <div className={`${styles.sectionReason} ${status === 'rejected' ? styles.sectionRejectedReason : ''}`}>
          <span>⚠</span>
          <span>{reason}</span>
        </div>
      )}

      {children}
    </div>
  )
}

// ── Sensitive input with show/hide toggle ──────────────────────────────────────

function SensitiveInput({
  value,
  onChange,
  maxLength,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  maxLength: number
  placeholder: string
}) {
  const [show, setShow] = useState(false)
  const len = value.length
  const done = len === maxLength

  return (
    <div className={styles.formGroup}>
      <div className={styles.inputWrap}>
        <input
          className={`${styles.input} ${styles.inputWithSuffix}`}
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button type="button" className={styles.inputEye} onClick={() => setShow((s) => !s)}>
          {show ? '🙈' : '👁️'}
        </button>
      </div>
      <p className={`${styles.inputCounter} ${done ? styles.inputCounterDone : ''}`}>
        {len}/{maxLength}
      </p>
    </div>
  )
}

// ── Success screen ─────────────────────────────────────────────────────────────

function SuccessScreen({ onOkay }: { onOkay: () => void }) {
  return (
    <div className={styles.successScreen}>
      <div className={styles.successIcon}>
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
          {/* Person body */}
          <circle cx="42" cy="32" r="14" stroke="#6c7cbf" strokeWidth="3.5" fill="none" />
          <path d="M14 80 Q14 58 42 58 Q64 58 70 68" stroke="#6c7cbf" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          {/* Verified badge (bottom-right) */}
          <circle cx="72" cy="72" r="20" fill="#0f1527" />
          <circle cx="72" cy="72" r="18" stroke="#3de88a" strokeWidth="2.5" fill="rgba(61,232,138,0.08)" />
          <polyline points="63 72 70 79 82 65" stroke="#3de88a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
      <p className={styles.successTitle}>KYC Successful</p>
      <p className={styles.successSub}>Your identity is verified. You can now withdraw your winnings.</p>
      <button className={styles.successOkBtn} onClick={onOkay}>Okay</button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function KYCPage() {
  const navigate = useNavigate()
  const { haptic } = useTelegram()

  // Remote state
  const [kycStatus, setKycStatus]   = useState<KYCStatusResponse | null>(null)
  const [banks, setBanks]           = useState<KYCBank[]>([])
  const [loadError, setLoadError]   = useState('')
  const [loadingInit, setLoadingInit] = useState(true)

  // Post-submit success flash (before navigating away)
  const [showSuccess, setShowSuccess] = useState(false)

  // Form fields
  const [fullName, setFullName]     = useState('')
  const [nin, setNin]               = useState('')
  const [bvn, setBvn]               = useState('')
  const [dob, setDob]               = useState('')
  const [phone, setPhone]           = useState('')
  const [bankCode, setBankCode]     = useState('')
  const [accountNo, setAccountNo]   = useState('')
  const [docType, setDocType]       = useState<'utility_bill' | 'bank_statement'>('utility_bill')

  // Document upload state
  const [uploadedDoc, setUploadedDoc]         = useState<KYCDocumentUploadResponse | null>(null)
  const [uploading, setUploading]             = useState(false)
  const [uploadError, setUploadError]         = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Bank account resolution
  const [resolvedName, setResolvedName]       = useState('')
  const [resolvingBank, setResolvingBank]     = useState(false)
  const [resolveError, setResolveError]       = useState('')

  // Submit state
  const [submitting, setSubmitting]           = useState(false)
  const [submitError, setSubmitError]         = useState('')

  // ── Initial load ──────────────────────────────────────────────────────────
  const loadInit = useCallback(async () => {
    setLoadingInit(true)
    setLoadError('')
    try {
      const [statusRes, banksRes] = await Promise.all([kycApi.status(), kycApi.banks()])
      setKycStatus(statusRes)
      setBanks(banksRes)
    } catch {
      setLoadError('Failed to load KYC data. Check your connection and try again.')
    } finally {
      setLoadingInit(false)
    }
  }, [])

  useEffect(() => { loadInit() }, [loadInit])

  // ── Live bank account resolution ──────────────────────────────────────────
  useEffect(() => {
    if (!bankCode || accountNo.length !== 10) {
      setResolvedName('')
      setResolveError('')
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setResolvingBank(true)
      setResolveError('')
      try {
        const name = await kycApi.resolveBank(bankCode, accountNo)
        if (!cancelled) setResolvedName(name)
      } catch (err: any) {
        if (!cancelled) {
          setResolvedName('')
          setResolveError(err?.response?.data?.message ?? 'Account not found — check the number.')
        }
      } finally {
        if (!cancelled) setResolvingBank(false)
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [bankCode, accountNo])

  // ── Document upload ───────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side validations
    const ALLOWED = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!ALLOWED.includes(file.type)) {
      setUploadError('Only PDF, JPG, or PNG files are allowed.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(`File too large (${fmtBytes(file.size)}). Maximum is 5 MB.`)
      return
    }

    setUploading(true)
    setUploadError('')
    setUploadedDoc(null)

    try {
      const doc = await kycApi.uploadDocument(file, docType)
      setUploadedDoc(doc)
      haptic.notificationOccurred('success')
    } catch (err: any) {
      setUploadError(err?.response?.data?.message ?? 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      // Reset so re-picking same file triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Form readiness ────────────────────────────────────────────────────────
  const isReady =
    fullName.trim().length >= 2 &&
    nin.length === 11 &&
    bvn.length === 11 &&
    dob !== '' &&
    bankCode !== '' &&
    accountNo.length === 10 &&
    resolvedName !== '' &&
    !resolvingBank &&
    uploadedDoc !== null

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!isReady || submitting || !uploadedDoc) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const newStatus = await kycApi.submit({
        full_name: fullName.trim(),
        nin,
        bvn,
        date_of_birth: dob,
        phone_number: phone.trim() || undefined,
        bank_code: bankCode,
        account_number: accountNo,
        document_id: uploadedDoc.id,
      })
      setKycStatus(newStatus)
      haptic.notificationOccurred('success')

      if (newStatus.overall_status === 'approved') {
        setShowSuccess(true)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Submission failed. Please try again.'
      setSubmitError(msg)
      haptic.notificationOccurred('error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render: loading ───────────────────────────────────────────────────────
  if (loadingInit) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={styles.loadError}>
        <p>{loadError}</p>
        <button className={styles.retryBtn} onClick={loadInit}>Try Again</button>
      </div>
    )
  }

  // ── Render: success flash after first approval ────────────────────────────
  if (showSuccess) {
    return <SuccessScreen onOkay={() => navigate('/profile')} />
  }

  // ── Render: already approved ──────────────────────────────────────────────
  if (kycStatus?.overall_status === 'approved') {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>KYC Verification</h1>
        </div>
        <div className={styles.verifiedCard}>
          <div className={styles.verifiedCardIcon}>✅</div>
          <div>
            <p className={styles.verifiedCardTitle}>Identity Verified</p>
            <p className={styles.verifiedCardSub}>Your account is fully verified. Withdrawals are enabled.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Derive section statuses ───────────────────────────────────────────────
  const ps = kycStatus?.personal_info_status  ?? 'pending'
  const bs = kycStatus?.bank_account_status   ?? 'pending'
  const ds = kycStatus?.document_status       ?? 'pending'

  // ── Render: main form ─────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>KYC Verification</h1>
        <p className={styles.pageSubtitle}>Verify your identity to enable cash withdrawals</p>
      </div>

      {/* ── Section 1: Personal Information ── */}
      <Section
        number={1}
        title="Personal Information"
        status={ps}
        reason={kycStatus?.personal_info_reason ?? ''}
      >
        {/* Full Name */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Full Name</label>
          <input
            className={styles.input}
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Must match account name"
            autoComplete="off"
          />
        </div>

        {/* NIN */}
        <div className={styles.formGroup}>
          <label className={styles.label}>NIN</label>
          <SensitiveInput
            value={nin}
            onChange={setNin}
            maxLength={11}
            placeholder="Enter your 11-digit NIN"
          />
        </div>

        {/* BVN */}
        <div className={styles.formGroup}>
          <label className={styles.label}>BVN</label>
          <SensitiveInput
            value={bvn}
            onChange={setBvn}
            maxLength={11}
            placeholder="Enter your 11-digit BVN"
          />
        </div>

        {/* Date of Birth */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Date of Birth</label>
          <input
            className={styles.input}
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0]}
          />
        </div>

        {/* Phone Number */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Phone Number <span style={{ color: '#60607a', fontWeight: 400 }}>(optional)</span></label>
          <input
            className={styles.input}
            type="tel"
            inputMode="tel"
            maxLength={11}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter your 11-digit number"
          />
        </div>
      </Section>

      {/* ── Section 2: Account Details ── */}
      <Section
        number={2}
        title="Account Details"
        status={bs}
        reason={kycStatus?.bank_account_reason ?? ''}
      >
        {/* Bank */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Bank Name</label>
          <select
            className={styles.select}
            value={bankCode}
            onChange={(e) => {
              setBankCode(e.target.value)
              setResolvedName('')
              setResolveError('')
            }}
          >
            <option value="">Select Bank</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Account Number */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Account Number</label>
          <input
            className={styles.input}
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={accountNo}
            onChange={(e) => {
              setAccountNo(e.target.value.replace(/\D/g, ''))
              setResolvedName('')
              setResolveError('')
            }}
            placeholder="Enter your 10-digit number"
          />
          {resolveError && (
            <p style={{ fontSize: 12, color: '#e83d3d', marginTop: 4 }}>• {resolveError}</p>
          )}
        </div>

        {/* Account Name — read-only, resolved */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Account Name</label>
          <div className={`${styles.resolvedName} ${resolvedName ? styles.resolvedNameFilled : ''} ${resolveError ? styles.resolvedNameError : ''}`}>
            {resolvingBank && <div className={styles.resolveSpinner} />}
            {resolvingBank
              ? 'Looking up…'
              : resolvedName
                ? resolvedName
                : resolveError
                  ? 'Account not found'
                  : 'Must match legal name'}
          </div>
          {resolvedName && (
            <p className={styles.inputHint}>✓ Please confirm this is your name</p>
          )}
        </div>
      </Section>

      {/* ── Section 3: Upload Document ── */}
      <Section
        number={3}
        title="Upload Document"
        status={ds}
        reason={kycStatus?.document_reason ?? ''}
      >
        <p className={styles.uploadHint}>
          Upload a recent utility bill or bank statement (PDF, JPG, or PNG · max 5 MB)
        </p>

        {/* Document type toggle */}
        <div className={styles.docTypeRow}>
          <button
            type="button"
            className={`${styles.docTypeBtn} ${docType === 'utility_bill' ? styles.docTypeBtnActive : ''}`}
            onClick={() => setDocType('utility_bill')}
          >
            Utility Bill
          </button>
          <button
            type="button"
            className={`${styles.docTypeBtn} ${docType === 'bank_statement' ? styles.docTypeBtnActive : ''}`}
            onClick={() => setDocType('bank_statement')}
          >
            Bank Statement
          </button>
        </div>

        {/* File picker */}
        <div className={`${styles.uploadArea} ${uploadedDoc ? styles.uploadAreaDone : ''} ${uploadError ? styles.uploadAreaError : ''}`}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className={styles.uploadInput}
            onChange={handleFileChange}
            disabled={uploading}
          />
          {uploading ? (
            <>
              <div className={styles.resolveSpinner} />
              <span>Uploading…</span>
            </>
          ) : uploadedDoc ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className={styles.uploadFilename}>{uploadedDoc.original_filename}</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Select file</span>
            </>
          )}
        </div>

        {/* Upload details */}
        {uploadedDoc && (
          <p className={styles.uploadFilename}>
            ✓ {uploadedDoc.original_filename} · {fmtBytes(uploadedDoc.file_size_bytes)}
          </p>
        )}
        {uploadError && (
          <p className={styles.uploadErrorMsg}>⚠ {uploadError}</p>
        )}
      </Section>

      {/* Submit error */}
      {submitError && (
        <p style={{ fontSize: 13, color: '#e83d3d', textAlign: 'center' }}>⚠ {submitError}</p>
      )}

      {/* Submit button */}
      <button
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={!isReady || submitting}
      >
        {submitting ? 'Submitting…' : 'Submit'}
      </button>
    </div>
  )
}
