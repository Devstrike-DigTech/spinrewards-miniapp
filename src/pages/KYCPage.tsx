import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { kyc as kycApi } from '@/api/endpoints'
import { useTelegram } from '@/hooks/useTelegram'
import type {
  KYCStatusResponse,
  KYCDocumentUploadResponse,
  KYCSectionStatus,
  KYCSubmitPayload,
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
    return <div className={`${styles.sectionBadge} ${styles.sectionBadgeError}`}>!</div>
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
    status === 'verified'            ? styles.sectionVerified : '',
    status === 'requires_correction' ? styles.sectionError    : '',
    status === 'rejected'            ? styles.sectionRejected : '',
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

      {status === 'verified' ? (
        <div className={styles.sectionVerifiedContent}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>This section has been verified</span>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

// ── Sensitive input with show/hide ─────────────────────────────────────────────

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

// ── Locked "NIN Verified" card ─────────────────────────────────────────────────

function NINVerifiedCard({ fullName }: { fullName: string }) {
  return (
    <div className={styles.ninVerifiedCard}>
      <div className={styles.ninVerifiedIcon}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3de88a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      </div>
      <div className={styles.ninVerifiedContent}>
        <p className={styles.ninVerifiedTitle}>Identity Verified ✓</p>
        {fullName && (
          <p className={styles.ninVerifiedName}>{fullName}</p>
        )}
        <p className={styles.ninVerifiedSub}>✓ You can now withdraw your earnings</p>
      </div>
    </div>
  )
}

// ── Success screen ─────────────────────────────────────────────────────────────

function SuccessScreen({ onOkay }: { onOkay: () => void }) {
  return (
    <div className={styles.successScreen}>
      <div className={styles.successIcon}>
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
          <circle cx="42" cy="32" r="14" stroke="#6c7cbf" strokeWidth="3.5" fill="none" />
          <path d="M14 80 Q14 58 42 58 Q64 58 70 68" stroke="#6c7cbf" strokeWidth="3.5" strokeLinecap="round" fill="none" />
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

  const [kycStatus, setKycStatus]     = useState<KYCStatusResponse | null>(null)
  const [loadError, setLoadError]     = useState('')
  const [loadingInit, setLoadingInit] = useState(true)
  const [showSuccess, setShowSuccess] = useState(false)

  // Form fields — NIN-only (BVN and bank account removed)
  const [fullName, setFullName] = useState('')
  const [nin, setNin]           = useState('')
  const [dob, setDob]           = useState('')
  const [phone, setPhone]       = useState('')

  // Document upload
  const [docType, setDocType]             = useState<'utility_bill' | 'bank_statement'>('utility_bill')
  const [uploadedDoc, setUploadedDoc]     = useState<KYCDocumentUploadResponse | null>(null)
  const [uploading, setUploading]         = useState(false)
  const [uploadError, setUploadError]     = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ── Initial load ──────────────────────────────────────────────────────────
  const loadInit = useCallback(async () => {
    setLoadingInit(true)
    setLoadError('')
    try {
      const statusRes = await kycApi.status()
      setKycStatus(statusRes)
    } catch {
      setLoadError('Failed to load KYC status. Check your connection and try again.')
    } finally {
      setLoadingInit(false)
    }
  }, [])

  useEffect(() => { loadInit() }, [loadInit])

  // ── Document upload ───────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

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
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Section statuses ──────────────────────────────────────────────────────
  const ps = kycStatus?.personal_info_status ?? 'pending'
  const ds = kycStatus?.document_status      ?? 'pending'

  // ── Form readiness ────────────────────────────────────────────────────────
  const personalInfoReady = ps === 'verified' || (
    fullName.trim().length >= 2 &&
    nin.length === 11 &&
    dob !== ''
  )
  // Document section is optional — NIN submission alone is sufficient
  const isReady = personalInfoReady

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!isReady || submitting) return
    setSubmitting(true)
    setSubmitError('')

    const payload: KYCSubmitPayload = {} as KYCSubmitPayload

    if (ps !== 'verified') {
      payload.full_name = fullName.trim()
      payload.nin = nin
      payload.date_of_birth = dob
      if (phone.trim()) payload.phone_number = phone.trim()
    }
    if (ds !== 'verified' && uploadedDoc) {
      payload.document_id = uploadedDoc.id
    }

    try {
      const newStatus = await kycApi.submit(payload)
      setKycStatus(newStatus)
      haptic.notificationOccurred('success')

      if (newStatus.nin_verified || newStatus.overall_status === 'approved') {
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

  // ── Render: success flash ─────────────────────────────────────────────────
  if (showSuccess) {
    return <SuccessScreen onOkay={() => navigate('/profile')} />
  }

  // ── Render: NIN already verified — locked read-only view ──────────────────
  if (kycStatus?.nin_verified) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>KYC Verification</h1>
        </div>
        <NINVerifiedCard fullName={kycStatus.nin_full_name ?? ''} />

        {/* Document section still available even after NIN verification */}
        {ds !== 'verified' && (
          <Section
            number={2}
            title="Upload Document"
            status={ds}
            reason={kycStatus?.document_reason ?? ''}
          >
            <p className={styles.uploadHint}>
              Upload a recent utility bill or bank statement (PDF, JPG, or PNG · max 5 MB)
            </p>
            <div className={styles.docTypeRow}>
              <button type="button" className={`${styles.docTypeBtn} ${docType === 'utility_bill' ? styles.docTypeBtnActive : ''}`} onClick={() => setDocType('utility_bill')}>
                Utility Bill
              </button>
              <button type="button" className={`${styles.docTypeBtn} ${docType === 'bank_statement' ? styles.docTypeBtnActive : ''}`} onClick={() => setDocType('bank_statement')}>
                Bank Statement
              </button>
            </div>
            <div className={`${styles.uploadArea} ${uploadedDoc ? styles.uploadAreaDone : ''} ${uploadError ? styles.uploadAreaError : ''}`}>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className={styles.uploadInput} onChange={handleFileChange} disabled={uploading} />
              {uploading ? (
                <><div className={styles.resolveSpinner} /><span>Uploading…</span></>
              ) : uploadedDoc ? (
                <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg><span>{uploadedDoc.original_filename}</span></>
              ) : (
                <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg><span>Select file</span></>
              )}
            </div>
            {uploadError && <p className={styles.uploadErrorMsg}>⚠ {uploadError}</p>}
          </Section>
        )}
      </div>
    )
  }

  // ── Render: main form ─────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>KYC Verification</h1>
        <p className={styles.pageSubtitle}>Verify your identity to enable cash withdrawals</p>
      </div>

      {/* ── Section 1: Personal Information (NIN only) ── */}
      <Section
        number={1}
        title="Personal Information"
        status={ps}
        reason={kycStatus?.personal_info_reason ?? ''}
      >
        <div className={styles.formGroup}>
          <label className={styles.label}>Full Name</label>
          <input
            className={styles.input}
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="As it appears on your NIN"
            autoComplete="off"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>NIN</label>
          <SensitiveInput
            value={nin}
            onChange={setNin}
            maxLength={11}
            placeholder="Enter your 11-digit NIN"
          />
        </div>

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

        <div className={styles.formGroup}>
          <label className={styles.label}>
            Phone Number{' '}
            <span style={{ color: '#60607a', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            className={styles.input}
            type="tel"
            inputMode="tel"
            maxLength={14}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
            placeholder="+234XXXXXXXXXX"
          />
        </div>
      </Section>

      {/* ── Section 2: Document Upload (optional) ── */}
      <Section
        number={2}
        title="Upload Document"
        status={ds}
        reason={kycStatus?.document_reason ?? ''}
      >
        <p className={styles.uploadHint}>
          Optional — upload a utility bill or bank statement for faster verification (PDF, JPG, or PNG · max 5 MB)
        </p>

        <div className={styles.docTypeRow}>
          <button type="button" className={`${styles.docTypeBtn} ${docType === 'utility_bill' ? styles.docTypeBtnActive : ''}`} onClick={() => setDocType('utility_bill')}>
            Utility Bill
          </button>
          <button type="button" className={`${styles.docTypeBtn} ${docType === 'bank_statement' ? styles.docTypeBtnActive : ''}`} onClick={() => setDocType('bank_statement')}>
            Bank Statement
          </button>
        </div>

        <div className={`${styles.uploadArea} ${uploadedDoc ? styles.uploadAreaDone : ''} ${uploadError ? styles.uploadAreaError : ''}`}>
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className={styles.uploadInput} onChange={handleFileChange} disabled={uploading} />
          {uploading ? (
            <><div className={styles.resolveSpinner} /><span>Uploading…</span></>
          ) : uploadedDoc ? (
            <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg><span className={styles.uploadFilename}>{uploadedDoc.original_filename}</span></>
          ) : (
            <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg><span>Select file (optional)</span></>
          )}
        </div>

        {uploadedDoc && (
          <p className={styles.uploadFilename}>
            ✓ {uploadedDoc.original_filename} · {fmtBytes(uploadedDoc.file_size_bytes)}
          </p>
        )}
        {uploadError && <p className={styles.uploadErrorMsg}>⚠ {uploadError}</p>}
      </Section>

      {submitError && (
        <p style={{ fontSize: 13, color: '#e83d3d', textAlign: 'center' }}>⚠ {submitError}</p>
      )}

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
