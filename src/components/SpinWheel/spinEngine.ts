import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js'
import { gsap } from 'gsap'

export interface WheelSegment {
  label: string
  multiplier: string
  color: string
  probability?: number
}

interface SpinEngineOptions {
  canvas: HTMLCanvasElement
  segments: WheelSegment[]
  onSpinComplete?: (segmentIndex: number) => void
}

// Default placeholder segments — replaced with real RTP data from backend
export const DEFAULT_SEGMENTS: WheelSegment[] = [
  { label: 'Try Again', multiplier: '0x', color: '#1a1a3e' },
  { label: '2x', multiplier: '2x', color: '#6c3de8' },
  { label: 'Try Again', multiplier: '0x', color: '#1a1a3e' },
  { label: '5x', multiplier: '5x', color: '#e83d8a' },
  { label: 'Try Again', multiplier: '0x', color: '#1a1a3e' },
  { label: '1.5x', multiplier: '1.5x', color: '#3de8c4' },
  { label: 'Try Again', multiplier: '0x', color: '#1a1a3e' },
  { label: '10x', multiplier: '10x', color: '#e8c93d' },
]

export class SpinEngine {
  private app: Application
  private wheelContainer: Container
  private segments: WheelSegment[]
  private currentRotation = 0
  private isSpinning = false
  private onSpinComplete?: (segmentIndex: number) => void

  constructor(options: SpinEngineOptions) {
    this.segments = options.segments
    this.onSpinComplete = options.onSpinComplete

    this.app = new Application()
    this.wheelContainer = new Container()
  }

  async init(canvas: HTMLCanvasElement) {
    await this.app.init({
      canvas,
      width: canvas.clientWidth || 360,
      height: canvas.clientHeight || 360,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    this.app.stage.addChild(this.wheelContainer)
    this.wheelContainer.x = this.app.screen.width / 2
    this.wheelContainer.y = this.app.screen.height / 2

    this.drawWheel()
    this.drawPointer()
  }

  private drawWheel() {
    this.wheelContainer.removeChildren()

    const radius = Math.min(this.app.screen.width, this.app.screen.height) / 2 - 20
    const segmentAngle = (Math.PI * 2) / this.segments.length

    this.segments.forEach((segment, i) => {
      const startAngle = i * segmentAngle - Math.PI / 2
      const endAngle = startAngle + segmentAngle

      // Segment slice
      const slice = new Graphics()
      slice.moveTo(0, 0)
      slice.arc(0, 0, radius, startAngle, endAngle)
      slice.closePath()
      slice.fill({ color: segment.color })
      slice.stroke({ color: '#ffffff22', width: 1 })
      this.wheelContainer.addChild(slice)

      // Glow ring on the edge
      const glowSlice = new Graphics()
      glowSlice.arc(0, 0, radius - 2, startAngle, endAngle)
      glowSlice.stroke({ color: '#ffffff44', width: 2 })
      this.wheelContainer.addChild(glowSlice)

      // Label text
      const midAngle = startAngle + segmentAngle / 2
      const textRadius = radius * 0.65
      const style = new TextStyle({
        fill: '#ffffff',
        fontSize: radius * 0.12,
        fontWeight: 'bold',
        fontFamily: 'system-ui, sans-serif',
        dropShadow: {
          color: '#000000',
          blur: 4,
          distance: 1,
        },
      })
      const label = new Text({ text: segment.multiplier, style })
      label.anchor.set(0.5)
      label.x = Math.cos(midAngle) * textRadius
      label.y = Math.sin(midAngle) * textRadius
      label.rotation = midAngle + Math.PI / 2
      this.wheelContainer.addChild(label)
    })

    // Center cap
    const cap = new Graphics()
    cap.circle(0, 0, 28)
    cap.fill({ color: '#0a0a1a' })
    cap.stroke({ color: '#ffffff44', width: 2 })
    this.wheelContainer.addChild(cap)

    // Center dot
    const dot = new Graphics()
    dot.circle(0, 0, 8)
    dot.fill({ color: '#6c3de8' })
    this.wheelContainer.addChild(dot)

    // Outer ring border
    const ring = new Graphics()
    ring.circle(0, 0, radius + 6)
    ring.stroke({ color: '#6c3de8', width: 4 })
    this.wheelContainer.addChild(ring)
  }

  private drawPointer() {
    const radius = Math.min(this.app.screen.width, this.app.screen.height) / 2 - 20
    const pointer = new Graphics()
    // Triangle pointing down at the top of the wheel
    pointer.moveTo(0, -(radius + 20))
    pointer.lineTo(-10, -(radius + 2))
    pointer.lineTo(10, -(radius + 2))
    pointer.closePath()
    pointer.fill({ color: '#e83d8a' })
    pointer.stroke({ color: '#ffffff', width: 1 })
    this.app.stage.addChild(pointer)
    pointer.x = this.wheelContainer.x
    pointer.y = this.wheelContainer.y
  }

  /**
   * Spin to a specific segment index (determined by backend).
   * The segment index maps to the outcome returned by the API.
   */
  spinTo(targetSegmentIndex: number) {
    if (this.isSpinning) return
    this.isSpinning = true

    const segmentAngle = 360 / this.segments.length

    // Target rotation: land the pointer on the target segment
    // Add multiple full rotations for visual excitement (5–8 full spins)
    const fullSpins = (5 + Math.floor(Math.random() * 3)) * 360
    const targetAngle =
      fullSpins +
      (360 - targetSegmentIndex * segmentAngle) -
      segmentAngle / 2

    gsap.to(this.wheelContainer, {
      rotation: (this.currentRotation + targetAngle) * (Math.PI / 180),
      duration: 5,
      ease: 'power4.out',
      onComplete: () => {
        this.currentRotation =
          (this.currentRotation + targetAngle) % 360
        this.isSpinning = false
        this.onSpinComplete?.(targetSegmentIndex)
      },
    })
  }

  updateSegments(segments: WheelSegment[]) {
    this.segments = segments
    this.drawWheel()
    this.drawPointer()
  }

  resize(width: number, height: number) {
    this.app.renderer.resize(width, height)
    this.wheelContainer.x = width / 2
    this.wheelContainer.y = height / 2
    this.drawWheel()
    this.drawPointer()
  }

  destroy() {
    this.app.destroy()
  }
}
