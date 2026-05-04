import { useEffect, useRef, useCallback } from 'react'
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

  const handleSpinComplete = useCallback((idx: number) => onSpinComplete?.(idx), [onSpinComplete])
  const handleSpinStart = useCallback(() => onSpinStart?.(), [onSpinStart])

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new SpinEngine({
      canvas: canvasRef.current,
      segments,
      onSpinComplete: handleSpinComplete,
      onSpinStart: handleSpinStart,
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
