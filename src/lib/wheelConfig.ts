/**
 * Visual segment configuration for each wheel type.
 *
 * These define what the wheel LOOKS LIKE — labels and colours.
 * The server's `segment_position` (0-indexed) maps directly to
 * these arrays, so the count MUST stay at 8 per wheel type.
 *
 * The actual outcome label shown to the user comes from the
 * server's `segment_label` field — these are only for the visual.
 *
 * Colour palette (matches screenshot aesthetic):
 *   LOSS / 0×     → dark navy      #1a2e5c
 *   Push / 0.5×   → dark-mid blue  #2a3f7c
 *   1× return     → orange         #e87a35
 *   2–3× wins     → royal blue     #3d72d4  /  #4a7fe8
 *   5× wins       → pink/magenta   #cc3381
 *   10× wins      → amber orange   #e8a030
 *   50×+ jackpot  → bright gold    #f5a623
 */

export interface VisualSegment {
  /** Text drawn on the wheel segment */
  label: string
  /** Background fill colour */
  color: string
  /** Whether the segment represents a net-win (used by SpinPage result logic) */
  showCoin: boolean
}

// Base loss/push colours — still with showCoin: true so every segment has a coin (matches design)
const LOSS: VisualSegment = { label: 'LOSS',  color: '#1a2e5c', showCoin: true  }
const PUSH: VisualSegment = { label: '0.5×',  color: '#2a3f7c', showCoin: true  }

export const WHEEL_VISUAL_CONFIGS: Record<string, VisualSegment[]> = {
  /**
   * Standard [₦200, ₦500)
   * Multipliers: 0×, 0.5×, 1×, 2×, 3×, 5×
   * 8-slot distribution — losses are most common
   */
  standard: [
    LOSS,
    { label: '2×',  color: '#3d72d4', showCoin: true  },
    LOSS,
    { label: '3×',  color: '#e87a35', showCoin: true  },
    LOSS,
    { label: '1×',  color: '#4a7fe8', showCoin: true  },
    PUSH,
    { label: '5×',  color: '#cc3381', showCoin: true  },
  ],

  /**
   * Power [₦500, ₦2000)
   * Multipliers: 0×, 1×, 3×, 5×, 10×
   */
  power: [
    LOSS,
    { label: '3×',  color: '#e87a35', showCoin: true  },
    LOSS,
    { label: '5×',  color: '#cc3381', showCoin: true  },
    LOSS,
    { label: '1×',  color: '#3d72d4', showCoin: true  },
    { label: '10×', color: '#e8a030', showCoin: true  },
    LOSS,
  ],

  /**
   * Mega [₦2000, ₦100001)
   * Multipliers: 0×, 2×, 5×, 10×, 50×
   */
  mega: [
    LOSS,
    { label: '2×',  color: '#3d72d4', showCoin: true  },
    LOSS,
    { label: '5×',  color: '#e87a35', showCoin: true  },
    { label: '10×', color: '#cc3381', showCoin: true  },
    LOSS,
    { label: '50×', color: '#f5a623', showCoin: true  },
    LOSS,
  ],

  /**
   * Welcome (free spin) — flat ₦ amounts, all colorful
   */
  welcome: [
    { label: '₦100',  color: '#1e3a8c', showCoin: true },
    { label: '₦500',  color: '#e87a35', showCoin: true },
    { label: '₦200',  color: '#3d72d4', showCoin: true },
    { label: '₦1K',   color: '#cc3381', showCoin: true },
    { label: '₦200',  color: '#2a3f7c', showCoin: true },
    { label: '₦5K',   color: '#f5a623', showCoin: true },
    { label: '₦100',  color: '#4a7fe8', showCoin: true },
    { label: '₦500',  color: '#e87a35', showCoin: true },
  ],

  /**
   * Daily Challenge — configurable high multipliers
   */
  daily_challenge: [
    LOSS,
    { label: '×200', color: '#3d72d4', showCoin: true },
    { label: '×100', color: '#2a3f7c', showCoin: true },
    { label: '×500', color: '#cc3381', showCoin: true },
    LOSS,
    { label: '×300', color: '#e87a35', showCoin: true },
    { label: '×1K',  color: '#f5a623', showCoin: true },
    { label: '×200', color: '#4a7fe8', showCoin: true },
  ],
}

/** Returns the 8-slot visual config for a given wheel type. Falls back to standard. */
export function getWheelVisualConfig(wheelType: string): VisualSegment[] {
  return WHEEL_VISUAL_CONFIGS[wheelType] ?? WHEEL_VISUAL_CONFIGS.standard
}

/**
 * Converts backend WheelSegmentAPI[] → VisualSegment[].
 * Segments are sorted by position so index === position.
 * showCoin is true for any segment whose multiplier >= 0.5 (partial return or better).
 */
export function segmentsFromApi(
  apiSegments: import('@/types').WheelSegmentAPI[]
): VisualSegment[] {
  return [...apiSegments]
    .sort((a, b) => a.position - b.position)
    .map((seg) => ({
      label: seg.label,
      color: seg.color,
      showCoin: parseFloat(seg.multiplier) >= 0,  // always true — coins on all segments
    }))
}

/**
 * Derives stake preset chips from the list of active wheels.
 * Returns a sorted, de-duped list of suggested amounts.
 */
export function deriveStakePresets(wheels: { min_stake: string; is_welcome_only: boolean }[]): number[] {
  const paid = wheels.filter((w) => !w.is_welcome_only)
  const raw: number[] = []
  for (const w of paid) {
    raw.push(parseFloat(w.min_stake))
  }
  // Supplement with common round amounts
  const supplements = [200, 500, 1000, 2000, 5000, 10000]
  return [...new Set([...raw, ...supplements])].sort((a, b) => a - b)
}
