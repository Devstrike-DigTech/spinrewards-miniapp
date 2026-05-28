import { useState, useCallback, useRef } from 'react'
import styles from './MiniToast.module.css'

type ToastType = 'success' | 'error'

interface ToastState {
  key: number
  text: string
  type: ToastType
}

/**
 * Returns a { toast } object. Call `toast.show(text)` to display a
 * bottom-anchored ephemeral notification.
 * Render `<toast.View />` once anywhere in the component tree.
 */
export function useMiniToast() {
  const [state, setState] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyRef = useRef(0)

  const show = useCallback((text: string, type: ToastType = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current)
    keyRef.current += 1
    setState({ key: keyRef.current, text, type })
    timerRef.current = setTimeout(() => setState(null), 3000)
  }, [])

  function View() {
    if (!state) return null
    return (
      <div
        key={state.key}
        className={`${styles.toast} ${state.type === 'success' ? styles.success : styles.error}`}
        role="status"
      >
        <span className={styles.icon}>{state.type === 'success' ? '✓' : '✗'}</span>
        {state.text}
      </div>
    )
  }

  return { show, View }
}
