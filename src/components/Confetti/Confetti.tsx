import { useMemo } from 'react'
import styles from './Confetti.module.css'

const COLORS = [
  '#f5c322', '#e83d8a', '#6c3de8', '#3de8c4',
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
]
const SHAPES = ['rect', 'circle', 'ribbon'] as const
const COUNT = 60

interface Piece {
  id: number
  color: string
  shape: typeof SHAPES[number]
  left: number       // vw %
  delay: number      // s
  duration: number   // s
  size: number       // px
  rotation: number   // deg
  swayAmp: number    // px
}

export function Confetti() {
  const pieces = useMemo<Piece[]>(() => {
    return Array.from({ length: COUNT }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      shape: SHAPES[i % SHAPES.length],
      left: Math.random() * 100,
      delay: Math.random() * 1.4,
      duration: 2.2 + Math.random() * 1.8,
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      swayAmp: 40 + Math.random() * 80,
    }))
  }, [])

  return (
    <div className={styles.container} aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`${styles.piece} ${styles[p.shape]}`}
          style={{
            left: `${p.left}%`,
            width: p.shape === 'ribbon' ? p.size * 0.4 : p.size,
            height: p.shape === 'ribbon' ? p.size * 2.5 : p.size,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--sway': `${p.swayAmp}px`,
            '--rot': `${p.rotation}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
