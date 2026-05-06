import { useEffect, useRef } from 'react'
import { SpinEngine, DEFAULT_SEGMENTS, type WheelSegment } from './spinEngine'
export type { WheelSegment }
import styles from './SpinWheel.module.css'

interface SpinWheelProps {
  segments?: WheelSegment[]
  onSpinComplete?: (segmentIndex: number) => void
  onSpinStart?: () => void
  engineRef?: React.MutableRefObject<SpinEngine | null>
}

export function SpinWheel({
  segments = DEFAULT_SEGMENTS,
  onSpinComplete,
  onSpinStart,
  engineRef,
}: SpinWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const localEngineRef = useRef<SpinEngine | null>(null)
  const activeRef = engineRef ?? localEngineRef

  // ── Stable refs so the engine always calls the LATEST callbacks ──────────
  // The engine is created once (no deps), so without refs it would capture
  // stale closures — spinResult would always be null inside handleAnimationDone.
  const onSpinCompleteRef = useRef(onSpinComplete)
  const onSpinStartRef    = useRef(onSpinStart)
  useEffect(() => { onSpinCompleteRef.current = onSpinComplete }, [onSpinComplete])
  useEffect(() => { onSpinStartRef.current    = onSpinStart    }, [onSpinStart])

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new SpinEngine({
      canvas: canvasRef.current,
      segments,
      onSpinComplete: (idx) => onSpinCompleteRef.current?.(idx),
      onSpinStart:    ()    => onSpinStartRef.current?.(),
    })

    engine.init(canvasRef.current)
    activeRef.current = engine

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      engine.resize(width, height)
    })
    observer.observe(canvasRef.current)

    return () => {
      observer.disconnect()
      engine.destroy()
      activeRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    activeRef.current?.updateSegments(segments)
  }, [segments, activeRef])

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
