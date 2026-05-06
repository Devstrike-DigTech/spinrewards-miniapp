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
 * Colour convention (matches design spec):
 *   LOSS / 0×     → dark charcoal  #2a2a2a
 *   Push / 0.5×   → slate          #455A64
 *   1× return     → steel blue     #546E7A
 *   2–3× wins     → navy           #1A237E / #1565C0
 *   5× wins       → deep orange    #E65100
 *   10× wins      → amber          #C9961A
 *   50×+ jackpot  → gold           #F5A623
 */

export interface VisualSegment {
  /** Text drawn on the wheel segment */
  label: string
  /** Background fill colour */
  color: string
  /** Whether to show the coin icon (false for loss segments) */
  showCoin: boolean
}

const LOSS: VisualSegment = { label: 'LOSS',  color: '#2a2a2a', showCoin: false }
const PUSH: VisualSegment = { label: '0.5×',  color: '#374151', showCoin: false }

export const WHEEL_VISUAL_CONFIGS: Record<string, VisualSegment[]> = {
  /**
   * Standard [₦200, ₦500)
   * Multipliers: 0×, 0.5×, 1×, 2×, 3×, 5×
   * 8-slot distribution — losses are most common
   */
  standard: [
    LOSS,
    { label: '2×',  color: '#1A237E', showCoin: true  },
    LOSS,
    { label: '3×',  color: '#1565C0', showCoin: true  },
    LOSS,
    { label: '1×',  color: '#455A64', showCoin: true  },
    PUSH,
    { label: '5×',  color: '#E65100', showCoin: true  },
  ],

  /**
   * Power [₦500, ₦2000)
   * Multipliers: 0×, 1×, 3×, 5×, 10×
   */
  power: [
    LOSS,
    { label: '3×',  color: '#E86D1F', showCoin: true  },
    LOSS,
    { label: '5×',  color: '#F5A623', showCoin: true  },
    LOSS,
    { label: '1×',  color: '#B84010', showCoin: true  },
    { label: '10×', color: '#C9961A', showCoin: true  },
    LOSS,
  ],

  /**
   * Mega [₦2000, ₦100001)
   * Multipliers: 0×, 2×, 5×, 10×, 50×
   */
  mega: [
    LOSS,
    { label: '2×',  color: '#1558BF', showCoin: true  },
    LOSS,
    { label: '5×',  color: '#1E73E8', showCoin: true  },
    { label: '10×', color: '#0D47A1', showCoin: true  },
    LOSS,
    { label: '50×', color: '#F5A623', showCoin: true  },
    LOSS,
  ],

  /**
   * Welcome (free spin) — flat ₦ amounts
   */
  welcome: [
    { label: '₦100',  color: '#1A2870', showCoin: true },
    { label: '₦500',  color: '#C9961A', showCoin: true },
    { label: '₦200',  color: '#2E5CE6', showCoin: true },
    { label: '₦1K',   color: '#D4308A', showCoin: true },
    { label: '₦200',  color: '#1A2870', showCoin: true },
    { label: '₦5K',   color: '#F5A623', showCoin: true },
    { label: '₦100',  color: '#2E5CE6', showCoin: true },
    { label: '₦500',  color: '#C9961A', showCoin: true },
  ],

  /**
   * Daily Challenge — configurable; show generic high multipliers
   */
  daily_challenge: [
    LOSS,
    { label: '×200', color: '#1B7A40', showCoin: true },
    { label: '×100', color: '#0A3020', showCoin: true },
    { label: '×500', color: '#3DC878', showCoin: true },
    LOSS,
    { label: '×300', color: '#1B7A40', showCoin: true },
    { label: '×1K',  color: '#C9961A', showCoin: true },
    { label: '×200', color: '#0A3020', showCoin: true },
  ],
}

/** Returns the 8-slot visual config for a given wheel type. Falls back to standard. */
export function getWheelVisualConfig(wheelType: string): VisualSegment[] {
  return WHEEL_VISUAL_CONFIGS[wheelType] ?? WHEEL_VISUAL_CONFIGS.standard
}

/**
 * Converts backend WheelSegmentAPI[] → VisualSegment[].
 * Segments are sorted by position so index === position.
 * showCoin is true for any segment whose multiplier >= 1 (i.e. the player
 * gets at least their stake back — losses and partial losses don't show a coin).
 */
export function segmentsFromApi(
  apiSegments: import('@/types').WheelSegmentAPI[]
): VisualSegment[] {
  return [...apiSegments]
    .sort((a, b) => a.position - b.position)
    .map((seg) => ({
      label: seg.label,
      color: seg.color,
      showCoin: parseFloat(seg.multiplier) >= 1,
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
