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
  onTick?: () => void   // fires each time pointer crosses a segment boundary
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
  private onTick?: () => void
  private pointerGraphics: Graphics | null = null
  private initialized = false
  private destroyed = false
  private glowTween: gsap.core.Tween | null = null

  constructor(options: SpinEngineOptions) {
    this.segments = options.segments
    this.onSpinComplete = options.onSpinComplete
    this.onSpinStart = options.onSpinStart
    this.onTick = options.onTick
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

    // ── Outer ambient glow (behind everything, add at index 0) ────────────
    const glow = new Graphics()
    glow.circle(0, 0, R + 36).fill({ color: 0x4060c0, alpha: 0.04 })
    glow.circle(0, 0, R + 30).fill({ color: 0x6080d0, alpha: 0.07 })
    glow.circle(0, 0, R + 24).fill({ color: 0x8090c0, alpha: 0.10 })
    this.wheelContainer.addChild(glow)

    // ── Silver metallic ring layers ────────────────────────────────────────
    const outerRing = new Graphics()
    outerRing.circle(0, 0, R + 20).fill({ color: 0x0e0e14 }) // dark shadow outer edge
    outerRing.circle(0, 0, R + 18).fill({ color: 0x404050 }) // dark silver
    outerRing.circle(0, 0, R + 14).fill({ color: 0x808090 }) // mid silver
    outerRing.circle(0, 0, R + 10).fill({ color: 0xc8c8d8 }) // bright silver highlight
    outerRing.circle(0, 0, R +  6).fill({ color: 0x9898a8 }) // cool silver
    outerRing.circle(0, 0, R +  3).fill({ color: 0x2a2a38 }) // dark inner rim
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

      // ── Subtle rim highlight on each segment ──────────────────────────
      const highlight = new Graphics()
      highlight.moveTo(Math.cos(startAngle + 0.05) * (R * 0.78), Math.sin(startAngle + 0.05) * (R * 0.78))
      highlight.arc(0, 0, R * 0.90, startAngle + 0.05, endAngle - 0.05)
      highlight.arc(0, 0, R * 0.78, endAngle - 0.05, startAngle + 0.05, true)
      highlight.closePath()
      highlight.fill({ color: 0xffffff, alpha: 0.07 })
      this.wheelContainer.addChild(highlight)

      // Divider line between segments
      const line = new Graphics()
      line.moveTo(0, 0)
      line.lineTo(Math.cos(startAngle) * R, Math.sin(startAngle) * R)
      line.stroke({ color: 0x00000055, width: 1.5 })
      this.wheelContainer.addChild(line)

      // ── Coin icon on every segment ────────────────────────────────────
      {
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
      const textDist = R * 0.37
      const fontSize = Math.max(R * 0.10, 10)

      const style = new TextStyle({
        fill: isLoss ? 'rgba(255,255,255,0.70)' : '#ffffff',
        fontSize,
        fontWeight: '900',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        dropShadow: { color: '#000000', blur: 4, distance: 1.5, alpha: isLoss ? 0.5 : 0.8 },
        stroke: { color: '#000000', width: 1.5 },
      })
      const lbl = new Text({ text: seg.label, style })
      lbl.anchor.set(0.5)
      lbl.x = Math.cos(midAngle) * textDist
      lbl.y = Math.sin(midAngle) * textDist

      // Compute rotation so text always reads outward from centre.
      let textRot = midAngle + Math.PI / 2
      const normMid = ((midAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      if (normMid > Math.PI / 2 && normMid < Math.PI * 1.5) {
        textRot += Math.PI
      }
      lbl.rotation = textRot
      this.wheelContainer.addChild(lbl)
    })

    // ── White circular pins at segment boundaries ─────────────────────────
    for (let i = 0; i < segCount; i++) {
      const a = i * segAngle - Math.PI / 2
      const px = Math.cos(a) * (R + 10)
      const py = Math.sin(a) * (R + 10)

      const pin = new Graphics()
      // Shadow
      pin.circle(px, py, 6.5).fill({ color: 0x000000, alpha: 0.35 })
      // Silver rim
      pin.circle(px, py, 5.5).fill({ color: 0x9898a8 })
      // Bright white face
      pin.circle(px, py, 4.5).fill({ color: 0xeeeef8 })
      // Glint
      pin.circle(px - 1.2, py - 1.5, 1.8).fill({ color: 0xffffff, alpha: 0.70 })
      this.wheelContainer.addChild(pin)
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
    const cx = this.wheelContainer.x
    const cy = this.wheelContainer.y

    // Soft drop shadow behind pointer
    const shadow = new Graphics()
    shadow.moveTo(2.5, -(R + 2))
    shadow.lineTo(-8, -(R + 30))
    shadow.lineTo(12, -(R + 30))
    shadow.closePath()
    shadow.fill({ color: 0x000000, alpha: 0.35 })
    shadow.x = cx
    shadow.y = cy
    this.app.stage.addChild(shadow)

    // Main pointer body — dark red with highlight edge
    const ptr = new Graphics()
    // Dark shadow side (left)
    ptr.moveTo(-2, -(R + 2))
    ptr.lineTo(-10, -(R + 30))
    ptr.lineTo(0, -(R + 30))
    ptr.closePath()
    ptr.fill({ color: 0x9a1a1a })
    // Bright side (right)
    ptr.moveTo(2, -(R + 2))
    ptr.lineTo(0, -(R + 30))
    ptr.lineTo(10, -(R + 30))
    ptr.closePath()
    ptr.fill({ color: 0xff4444 })
    // White highlight sliver
    ptr.moveTo(1, -(R + 8))
    ptr.lineTo(-1, -(R + 28))
    ptr.lineTo(2, -(R + 28))
    ptr.closePath()
    ptr.fill({ color: 0xffffff, alpha: 0.30 })
    // White tip accent
    ptr.moveTo(-3, -(R + 27))
    ptr.lineTo(3, -(R + 27))
    ptr.lineTo(0, -(R + 31))
    ptr.closePath()
    ptr.fill({ color: 0xffffff, alpha: 0.60 })
    ptr.x = cx
    ptr.y = cy
    this.app.stage.addChild(ptr)
    this.pointerGraphics = ptr   // store for flash effect

    // Gold jewel base where pointer meets ring
    const jewel = new Graphics()
    jewel.circle(0, -(R + 10), 9).fill({ color: 0x000000, alpha: 0.4 })   // shadow
    jewel.circle(0, -(R + 10), 8).fill({ color: 0x6b3d00 })                // dark rim
    jewel.circle(0, -(R + 10), 6.5).fill({ color: 0xf5c322 })              // gold
    jewel.circle(0, -(R + 10), 5).fill({ color: 0xfde88a })                // bright face
    jewel.circle(-1.5, -(R + 11.5), 2).fill({ color: 0xffffff, alpha: 0.7 }) // glint
    jewel.x = cx
    jewel.y = cy
    this.app.stage.addChild(jewel)
  }

  private flashPointer() {
    if (!this.pointerGraphics) return
    this.pointerGraphics.alpha = 0.35
    gsap.to(this.pointerGraphics, { alpha: 1, duration: 0.14, ease: 'power2.out' })
  }

  private drawGlowRing() {
    const ring = new Graphics()
    ring.circle(0, 0, this.radius + 22).stroke({ color: 0xc0c0e0, width: 6, alpha: 0 })
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

    const colors = [0xf5c322, 0xe83d8a, 0x6c3de8, 0x3de8c4, 0xffffff, 0xf59430, 0xff6b35, 0x00e5ff, 0xadff2f, 0xc9961a]
    const count = 40

    for (let i = 0; i < count; i++) {
      // Burst from the winning segment, not uniformly
      const spreadAngle = midAngle + (Math.random() - 0.5) * ((Math.PI * 2) / this.segments.length)
      const startDist = R * 0.55
      const endDist   = R * (1.0 + Math.random() * 0.35)

      const p = new Graphics()
      if (i % 3 === 0) {
        // Rectangle confetti
        const w = 3 + Math.random() * 4
        const h = 5 + Math.random() * 6
        p.rect(-w/2, -h/2, w, h).fill({ color: colors[i % colors.length] })
      } else {
        // Circle spark
        p.circle(0, 0, 2.5 + Math.random() * 3.5).fill({ color: colors[i % colors.length] })
      }
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

      if (i % 3 === 0) {
        gsap.to(p, {
          rotation: Math.PI * 2 * (Math.random() > 0.5 ? 1 : -1),
          duration: 0.65 + Math.random() * 0.45,
          ease: 'none',
        })
      }
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

    let lastTickIndex = -1
    const segAngleRad = (Math.PI * 2) / this.segments.length

    gsap.to(this.wheelContainer, {
      rotation: targetRad,
      duration: MIN_SPIN_SECONDS,
      ease: 'power4.out',
      onUpdate: () => {
        const normalized = ((this.wheelContainer.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        const idx = Math.floor(normalized / segAngleRad) % this.segments.length
        if (idx !== lastTickIndex) {
          lastTickIndex = idx
          this.flashPointer()
          this.onTick?.()
        }
      },
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
