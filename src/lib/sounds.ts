/**
 * Web Audio API sound engine — no external files needed.
 * Generates all sounds synthetically so the app works fully offline.
 */

class SoundEngine {
  private ctx: AudioContext | null = null
  private spinTimerId: ReturnType<typeof setTimeout> | null = null
  private muted = false

  // ── Context management ────────────────────────────────────────────────────

  private get audio(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext()
    }
    return this.ctx
  }

  private resume() {
    if (this.ctx?.state === 'suspended') void this.ctx.resume()
  }

  // ── Primitives ────────────────────────────────────────────────────────────

  private note(
    freq: number,
    duration: number,
    opts: {
      type?: OscillatorType
      gain?: number
      delay?: number
      attack?: number
    } = {}
  ) {
    if (this.muted) return
    const { type = 'sine', gain = 0.25, delay = 0, attack = 0.01 } = opts
    const ctx = this.audio
    this.resume()
    const osc = ctx.createOscillator()
    const vol = ctx.createGain()
    osc.connect(vol)
    vol.connect(ctx.destination)
    osc.type = type
    osc.frequency.value = freq
    vol.gain.setValueAtTime(0, ctx.currentTime + delay)
    vol.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + attack)
    vol.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + delay + duration
    )
    osc.start(ctx.currentTime + delay)
    osc.stop(ctx.currentTime + delay + duration + 0.05)
  }

  private click(baseFreq = 900) {
    if (this.muted) return
    const ctx = this.audio
    this.resume()
    const osc = ctx.createOscillator()
    const vol = ctx.createGain()
    osc.connect(vol)
    vol.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.value = baseFreq + Math.random() * 120
    vol.gain.setValueAtTime(0.1, ctx.currentTime)
    vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.05)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Start the deceleration tick loop that mirrors the GSAP power4.out
   * easing (~5 s total). Ticks start fast (~40 ms) and slow to ~400 ms.
   */
  startSpin() {
    this.stopSpin()
    let elapsed = 0
    const totalMs = 4800

    const tick = () => {
      this.click()
      // quartic ease-in → interval grows from 40 ms to 400 ms
      const t = Math.min(elapsed / totalMs, 1)
      const interval = 40 + t * t * t * t * 360
      elapsed += interval
      if (elapsed < totalMs - 350) {
        this.spinTimerId = setTimeout(tick, interval)
      }
    }

    this.spinTimerId = setTimeout(tick, 40)
  }

  stopSpin() {
    if (this.spinTimerId !== null) {
      clearTimeout(this.spinTimerId)
      this.spinTimerId = null
    }
  }

  /** Short thud when the wheel lands */
  playLand() {
    this.note(180, 0.18, { type: 'sine', gain: 0.45 })
    this.note(90, 0.28, { type: 'sine', gain: 0.22, delay: 0.05 })
  }

  /** Ascending win fanfare with a second flourish */
  playWin() {
    // First run: C5-E5-G5-C6
    ;([
      [523, 0.18, 0],
      [659, 0.18, 0.13],
      [784, 0.18, 0.26],
      [1047, 0.38, 0.39],
    ] as [number, number, number][]).forEach(([f, d, delay]) =>
      this.note(f, d, { gain: 0.28, delay })
    )
    // Second flourish at 700 ms
    setTimeout(() => {
      ;[659, 784, 1047, 1319].forEach((f, i) =>
        this.note(f, 0.25, { gain: 0.2, delay: i * 0.09 })
      )
    }, 700)
  }

  /**
   * Jackpot bell — triggered when multiplier is 10× or higher.
   * Harmonic bell tones with long decay.
   */
  playJackpot() {
    if (this.muted) return
    const ctx = this.audio
    this.resume()
    const bells = [880, 1108, 1760, 2217]
    bells.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const vol = ctx.createGain()
      osc.connect(vol)
      vol.connect(ctx.destination)
      osc.type = 'sine'
      const t = ctx.currentTime + i * 0.18
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 1.4)
      vol.gain.setValueAtTime(0.38, t)
      vol.gain.exponentialRampToValueAtTime(0.0001, t + 1.8)
      osc.start(t)
      osc.stop(t + 1.9)
    })
  }

  /** Gentle descending loss sound — not punishing */
  playLoss() {
    ;[392, 349, 311, 262].forEach((freq, i) =>
      this.note(freq, 0.5, { gain: 0.16, delay: i * 0.2, attack: 0.06 })
    )
  }

  setMuted(v: boolean) {
    this.muted = v
  }

  get isMuted() {
    return this.muted
  }
}

export const sounds = new SoundEngine()
