import { useEffect, useRef, useState } from 'react'
import WebApp from '@twa-dev/sdk'
import styles from './ShareSheet.module.css'

export interface ShareData {
  code: string        // e.g. "SPIN-ABC123"
  shareUrl: string    // full deep-link URL
  text: string        // ready-made share message
}

interface Props {
  data: ShareData
  onClose: () => void
}

interface Channel {
  id: string
  icon: string
  label: string
  action: () => void | Promise<void>
}

export function ShareSheet({ data, onClose }: Props) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on backdrop click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  // Haptic + copy helper
  async function copy(str: string, type: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(str)
    } catch {
      // Fallback for older WebViews
      const el = document.createElement('textarea')
      el.value = str
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    WebApp.HapticFeedback?.notificationOccurred('success')
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  function openExternal(url: string) {
    if (WebApp.openLink) {
      WebApp.openLink(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const channels: Channel[] = [
    {
      id: 'telegram',
      icon: '✈️',
      label: 'Telegram',
      action: () => {
        const url = `https://t.me/share/url?url=${encodeURIComponent(data.shareUrl)}&text=${encodeURIComponent(data.text)}`
        WebApp.openTelegramLink(url)
      },
    },
    {
      id: 'whatsapp',
      icon: '💬',
      label: 'WhatsApp',
      action: () => {
        const url = `https://wa.me/?text=${encodeURIComponent(`${data.text}\n${data.shareUrl}`)}`
        openExternal(url)
      },
    },
    {
      id: 'sms',
      icon: '📱',
      label: 'SMS',
      action: () => {
        const body = encodeURIComponent(`${data.text}\n${data.shareUrl}`)
        window.open(`sms:?body=${body}`, '_self')
      },
    },
    {
      id: 'twitter',
      icon: '𝕏',
      label: 'X / Twitter',
      action: () => {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.shareUrl)}`
        openExternal(url)
      },
    },
    {
      id: 'copy-link',
      icon: '🔗',
      label: copied === 'link' ? 'Copied!' : 'Copy Link',
      action: () => copy(data.shareUrl, 'link'),
    },
    {
      id: 'copy-code',
      icon: '📋',
      label: copied === 'code' ? 'Copied!' : 'Copy Code',
      action: () => copy(data.code, 'code'),
    },
  ]

  // Dismiss on Android back gesture / Telegram back button
  useEffect(() => {
    WebApp.BackButton?.show()
    WebApp.BackButton?.onClick(onClose)
    return () => {
      WebApp.BackButton?.offClick(onClose)
      WebApp.BackButton?.hide()
    }
  }, [onClose])

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.sheet}>
        {/* Drag handle */}
        <div className={styles.handle} />

        <p className={styles.title}>Share Referral</p>

        {/* Code preview */}
        <div className={styles.codeBox}>
          <span className={styles.codeText}>{data.code}</span>
        </div>

        {/* Channel grid */}
        <div className={styles.grid}>
          {channels.map((ch) => (
            <button
              key={ch.id}
              className={`${styles.channel} ${ch.id === 'copy-code' && copied === 'code' ? styles.channelDone : ''} ${ch.id === 'copy-link' && copied === 'link' ? styles.channelDone : ''}`}
              onClick={() => ch.action()}
            >
              <span className={styles.channelIcon}>{ch.icon}</span>
              <span className={styles.channelLabel}>{ch.label}</span>
            </button>
          ))}
        </div>

        <button className={styles.cancelBtn} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
