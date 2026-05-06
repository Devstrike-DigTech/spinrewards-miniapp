import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js'
import { gsap } from 'gsap'
import type { VisualSegment } from '@/lib/wheelConfig'

// Re-export so SpinWheel.tsx can import from one place
export type { VisualSegment as WheelSegment }

/** Guaranteed minimum spin animation time in seconds */
const MIN_SPIN_SECONDS = 5

interface SpinEngineOptions {
  canvas: HTMLCanvasElement
  segments: VisualSegment[]
  onSpinComplete?: (segmentIndex: number) => void
  onSpinStart?: () => void
}

export class SpinEngine {
  private app: Application
  private wheelContainer: Container
  private glowRing: Graphics | null = null
  private particles: Container | null = null
  private segments: VisualSegment[]
  private currentRotation = 0   // degrees, cumulative
  private isSpinning = false
  private onSpinComplete?: (idx: number) => void
  private onSpinStart?: () => void
  private initialized = false
  private destroyed = false
  private glowTween: gsap.core.Tween | null = null

  constructor(options: SpinEngineOptions) {
    this.segments = options.segments
    this.onSpinComplete = options.onSpinComplete
    this.onSpinStart = options.onSpinStart
    this.app = new Application()
    this.wheelContainer = new Container()
  }

  async init(canvas: HTMLCanvasElement) {
    await this.app.init({
      canvas,
      width: canvas.clientWidth || 320,
      height: canvas.clientHeight || 320,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    })

    if (this.destroyed) { this.app.destroy(true); return }

    this.initialized = true
    this.app.stage.addChild(this.wheelContainer)
    this.wheelContainer.x = this.app.screen.width / 2
    this.wheelContainer.y = this.app.screen.height / 2

    this.drawWheel()
    this.drawPointer()
    this.drawGlowRing()
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  private get radius() {
    return Math.min(this.app.screen.width, this.app.screen.height) / 2 - 14
  }

  private drawWheel() {
    this.wheelContainer.removeChildren()

    const R = this.radius
    const segCount = this.segments.length
    const segAngle = (Math.PI * 2) / segCount

    // ── Outer metallic ring (5 layers for depth) ───────────────────────────
    const outerRing = new Graphics()
    outerRing.circle(0, 0, R + 18).fill({ color: 0xd4d9e2 }) // lightest silver
    outerRing.circle(0, 0, R + 14).fill({ color: 0xa8b4c0 }) // mid silver
    outerRing.circle(0, 0, R + 10).fill({ color: 0xc8cdd6 }) // highlight band
    outerRing.circle(0, 0, R +  6).fill({ color: 0x7a8fa8 }) // dark inner groove
    outerRing.circle(0, 0, R +  3).fill({ color: 0xb0bcc8 }) // inner lip
    this.wheelContainer.addChild(outerRing)

    // ── Segments ──────────────────────────────────────────────────────────
    this.segments.forEach((seg, i) => {
      const startAngle = i * segAngle - Math.PI / 2
      const endAngle   = startAngle + segAngle
      const midAngle   = startAngle + segAngle / 2

      // Slice
      const slice = new Graphics()
      slice.moveTo(0, 0)
      slice.arc(0, 0, R, startAngle, endAngle)
      slice.closePath()
      slice.fill({ color: seg.color })
      this.wheelContainer.addChild(slice)

      // ── Gloss arc highlight on outer rim of each segment ──────────────
      if (seg.showCoin) {
        // Bright arc at rim for a "shiny" look on win segments
        const gloss = new Graphics()
        gloss.moveTo(Math.cos(startAngle + 0.04) * (R * 0.88), Math.sin(startAngle + 0.04) * (R * 0.88))
        gloss.arc(0, 0, R * 0.92, startAngle + 0.04, endAngle - 0.04)
        gloss.stroke({ color: 0xffffff, width: 2, alpha: 0.22 })
        this.wheelContainer.addChild(gloss)
      }

      // Divider line between segments
      const line = new Graphics()
      line.moveTo(0, 0)
      line.lineTo(Math.cos(startAngle) * R, Math.sin(startAngle) * R)
      line.stroke({ color: 0x00000055, width: 1.5 })
      this.wheelContainer.addChild(line)

      // ── Coin icon (only on win segments) ──────────────────────────────
      if (seg.showCoin) {
        const coinR  = R * 0.115
        const coinD  = R * 0.70
        const cx = Math.cos(midAngle) * coinD
        const cy = Math.sin(midAngle) * coinD

        const coin = new Graphics()
        // Shadow/depth ring
        coin.circle(cx, cy, coinR + 3.5).fill({ color: 0x000000, alpha: 0.35 })
        // Dark gold rim
        coin.circle(cx, cy, coinR + 2).fill({ color: 0x8a5c00 })
        // Mid gold
        coin.circle(cx, cy, coinR).fill({ color: 0xe8a800 })
        // Bright gold face
        coin.circle(cx, cy, coinR * 0.82).fill({ color: 0xf5c322 })
        // Inner highlight (off-centre for 3-D look)
        coin.circle(cx - coinR * 0.18, cy - coinR * 0.22, coinR * 0.38).fill({ color: 0xfde68a, alpha: 0.7 })
        this.wheelContainer.addChild(coin)

        // 5-point star on coin
        const star = this.star(cx, cy, 5, coinR * 0.50, coinR * 0.21)
        star.fill({ color: 0xc47800 })
        this.wheelContainer.addChild(star)

        // Tiny glint dot
        const glint = new Graphics()
        glint.circle(cx - coinR * 0.28, cy - coinR * 0.30, coinR * 0.13)
        glint.fill({ color: 0xffffff, alpha: 0.65 })
        this.wheelContainer.addChild(glint)
      }

      // ── Label text ────────────────────────────────────────────────────
      const isLoss = !seg.showCoin
      const textDist = isLoss ? R * 0.52 : R * 0.37
      const fontSize = Math.max(R * (isLoss ? 0.095 : 0.12), 11)

      const style = new TextStyle({
        fill: isLoss ? '#6a6a7a' : '#ffffff',
        fontSize,
        fontWeight: '900',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        dropShadow: isLoss ? undefined : {
          color: '#000000', blur: 5, distance: 1.5, alpha: 0.8,
        },
        stroke: isLoss ? undefined : { color: '#000000', width: 1.5 },
      })
      const lbl = new Text({ text: seg.label, style })
      lbl.anchor.set(0.5)
      lbl.x = Math.cos(midAngle) * textDist
      lbl.y = Math.sin(midAngle) * textDist

      // Compute rotation so text always reads outward from centre.
      // midAngle + π/2 gives the correct angle for top-half segments, but for
      // bottom-half segments (sin(midAngle) > 0 in Pixi's y-down coords) this
      // pushes past 180° and the label ends up upside-down — so add π to flip it.
      let textRot = midAngle + Math.PI / 2
      const normMid = ((midAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      if (normMid > Math.PI / 2 && normMid < Math.PI * 1.5) {
        textRot += Math.PI
      }
      lbl.rotation = textRot
      this.wheelContainer.addChild(lbl)
    })

    // ── Decorative dots at segment boundaries ──────────────────────────────
    for (let i = 0; i < segCount; i++) {
      const a = i * segAngle - Math.PI / 2
      // Outer gold dot
      const dot = new Graphics()
      dot.circle(Math.cos(a) * (R + 7), Math.sin(a) * (R + 7), 5.5)
      dot.fill({ color: 0xf5c322 })
      this.wheelContainer.addChild(dot)
      // Inner white highlight
      const dotHi = new Graphics()
      dotHi.circle(Math.cos(a) * (R + 7), Math.sin(a) * (R + 7), 2.5)
      dotHi.fill({ color: 0xffffff, alpha: 0.9 })
      this.wheelContainer.addChild(dotHi)
    }

    // ── Inner metallic hub ring ─────────────────────────────────────────────
    const hub = new Graphics()
    hub.circle(0, 0, R * 0.26).fill({ color: 0xd4d9e2 }) // outer silver
    hub.circle(0, 0, R * 0.23).fill({ color: 0x8a9bb0 }) // dark groove
    hub.circle(0, 0, R * 0.21).fill({ color: 0xb8c4d0 }) // lighter face
    this.wheelContainer.addChild(hub)

    // ── Gold centre cap ────────────────────────────────────────────────────
    const cap = new Graphics()
    cap.circle(0, 0, R * 0.195).fill({ color: 0x8a5c00 }) // dark rim
    cap.circle(0, 0, R * 0.175).fill({ color: 0xe8a800 }) // gold base
    cap.circle(0, 0, R * 0.15 ).fill({ color: 0xf5c322 }) // bright gold
    cap.circle(-R * 0.04, -R * 0.05, R * 0.07).fill({ color: 0xfde88a, alpha: 0.65 }) // highlight
    this.wheelContainer.addChild(cap)

    // SPIN text
    const spinStyle = new TextStyle({
      fill: '#1a0800',
      fontSize: Math.max(R * 0.085, 10),
      fontWeight: '900',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      letterSpacing: 1.5,
      stroke: { color: '#c47800', width: 1 },
    })
    const spinText = new Text({ text: 'SPIN', style: spinStyle })
    spinText.anchor.set(0.5)
    this.wheelContainer.addChild(spinText)
  }

  /** Draws an n-pointed star centred at (cx,cy). Call .fill() on the result. */
  private star(cx: number, cy: number, points: number, outer: number, inner: number): Graphics {
    const g = new Graphics()
    const step = Math.PI / points
    g.moveTo(cx + outer * Math.cos(-Math.PI / 2), cy + outer * Math.sin(-Math.PI / 2))
    for (let i = 1; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner
      const a = -Math.PI / 2 + i * step
      g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
    }
    g.closePath()
    return g
  }

  private drawPointer() {
    const R = this.radius

    // Shadow behind pointer
    const shadow = new Graphics()
    shadow.moveTo(2, -(R + 4))
    shadow.lineTo(-9, -(R + 26))
    shadow.lineTo(12, -(R + 26))
    shadow.closePath()
    shadow.fill({ color: 0x000000, alpha: 0.4 })
    this.app.stage.addChild(shadow)
    shadow.x = this.wheelContainer.x
    shadow.y = this.wheelContainer.y

    // Red pointer triangle
    const ptr = new Graphics()
    ptr.moveTo(0, -(R + 3))
    ptr.lineTo(-10, -(R + 27))
    ptr.lineTo(10, -(R + 27))
    ptr.closePath()
    ptr.fill({ color: 0xe83d3d })
    ptr.stroke({ color: 0xffffff, width: 1.5 })
    this.app.stage.addChild(ptr)
    ptr.x = this.wheelContainer.x
    ptr.y = this.wheelContainer.y

    // Gold base circle where pointer meets ring
    const base = new Graphics()
    base.circle(0, -(R + 11), 8).fill({ color: 0xf5c322 })
    base.circle(0, -(R + 11), 5).fill({ color: 0xfde88a })
    this.app.stage.addChild(base)
    base.x = this.wheelContainer.x
    base.y = this.wheelContainer.y
  }

  private drawGlowRing() {
    const ring = new Graphics()
    ring.circle(0, 0, this.radius + 22).stroke({ color: 0xf5c322, width: 6, alpha: 0 })
    this.wheelContainer.addChildAt(ring, 0)
    this.glowRing = ring
  }

  // ── Particles ─────────────────────────────────────────────────────────────

  private spawnParticles(segmentIndex: number) {
    if (!this.initialized) return
    const R = this.radius
    const midAngle =
      segmentIndex * ((Math.PI * 2) / this.segments.length) -
      Math.PI / 2 +
      Math.PI / this.segments.length

    const container = new Container()
    this.wheelContainer.addChild(container)
    this.particles = container

    const colors = [0xf5c322, 0xe83d8a, 0x6c3de8, 0x3de8c4, 0xffffff, 0xf59430]
    const count = 28

    for (let i = 0; i < count; i++) {
      // Burst from the winning segment, not uniformly
      const spreadAngle = midAngle + (Math.random() - 0.5) * ((Math.PI * 2) / this.segments.length)
      const startDist = R * 0.55
      const endDist   = R * (1.0 + Math.random() * 0.35)

      const p = new Graphics()
      p.circle(0, 0, 3 + Math.random() * 4).fill({ color: colors[i % colors.length] })
      p.x = Math.cos(spreadAngle) * startDist
      p.y = Math.sin(spreadAngle) * startDist
      container.addChild(p)

      gsap.to(p, {
        x: Math.cos(spreadAngle) * endDist,
        y: Math.sin(spreadAngle) * endDist,
        alpha: 0,
        duration: 0.65 + Math.random() * 0.45,
        ease: 'power2.out',
        onComplete: () => {
          if (i === count - 1 && this.particles) {
            this.wheelContainer.removeChild(this.particles)
            this.particles = null
          }
        },
      })
    }
  }

  // ── Spinning ───────────────────────────────────────────────────────────────

  /**
   * Spin to targetSegmentIndex (0-indexed, matching server's segment_position).
   * Always takes exactly MIN_SPIN_SECONDS (5s). The onSpinComplete callback
   * is blocked until that full duration has elapsed, even if GSAP fires early.
   */
  spinTo(targetSegmentIndex: number) {
    if (!this.initialized || this.isSpinning) return
    this.isSpinning = true
    const spinStartMs = Date.now()

    // Glow pulse during spin
    if (this.glowRing) {
      this.glowTween = gsap.to(this.glowRing, {
        alpha: 1, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut',
      })
    }

    this.onSpinStart?.()

    const segAngle = 360 / this.segments.length
    // 7–10 full rotations for drama
    const fullSpins = (7 + Math.floor(Math.random() * 3)) * 360
    // Land the pointer (at top/0°) on the mid-point of the target segment
    const targetDeg = fullSpins + (360 - targetSegmentIndex * segAngle) - segAngle / 2
    const targetRad = (this.currentRotation + targetDeg) * (Math.PI / 180)

    gsap.to(this.wheelContainer, {
      rotation: targetRad,
      duration: MIN_SPIN_SECONDS,
      ease: 'power4.out',
      onComplete: () => {
        this.currentRotation = (this.currentRotation + targetDeg) % 360
        this.glowTween?.kill()
        this.glowTween = null
        if (this.glowRing) gsap.to(this.glowRing, { alpha: 0, duration: 0.3 })

        this.spawnParticles(targetSegmentIndex)

        // Belt-and-suspenders: ensure at least MIN_SPIN_SECONDS has elapsed
        const elapsed = Date.now() - spinStartMs
        const remaining = Math.max(0, MIN_SPIN_SECONDS * 1000 - elapsed)

        setTimeout(() => {
          this.isSpinning = false
          this.onSpinComplete?.(targetSegmentIndex)
        }, remaining)
      },
    })
  }

  updateSegments(segs: VisualSegment[]) {
    if (!this.initialized) return
    this.segments = segs
    this.drawWheel()
    this.drawPointer()
    if (!this.glowRing) this.drawGlowRing()
  }

  resize(width: number, height: number) {
    if (!this.initialized) return
    this.app.renderer.resize(width, height)
    this.wheelContainer.x = width / 2
    this.wheelContainer.y = height / 2
    this.drawWheel()
    this.drawPointer()
    this.drawGlowRing()
  }

  destroy() {
    this.destroyed = true
    this.glowTween?.kill()
    if (this.initialized) {
      this.app.destroy(true)
      this.initialized = false
    }
  }
}

// Default segments used while loading (8 neutral slots)
import { WHEEL_VISUAL_CONFIGS } from '@/lib/wheelConfig'
export const DEFAULT_SEGMENTS = WHEEL_VISUAL_CONFIGS.standard
