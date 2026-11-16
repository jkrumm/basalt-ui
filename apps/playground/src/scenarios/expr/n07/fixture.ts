/** Ten observing nights, seeded and fixed: dark hours (0 if none), a verdict, one limiting factor per out night. */

export type Verdict = 'go' | 'marginal' | 'out'

export type Night = {
  id: string
  /** Short weekday for the axis tick. */
  weekday: string
  /** The full label of the night, for the list and the readout. */
  label: string
  /** Weekday and day of the month, for a tight footer. */
  short: string
  /** Day of the month, for the axis tick. */
  day: string
  /** Hours with the sun and the moon both below the horizon; 0 when there are none. */
  hours: number
  verdict: Verdict
  /** The one thing that rules the night out; null on a go or marginal night. */
  factor: string | null
  /** One word of the factor, for a label on the bar; null with the factor. */
  reason: string | null
  /** The target's peak altitude, in degrees. */
  altitude: number
}

const shortReason = (factor: string): string =>
  factor.toLowerCase().includes('cloud') ? 'Cloud' : (factor.split(' ')[0] ?? factor)

const night = (
  id: number,
  weekday: string,
  day: number,
  hours: number,
  verdict: Verdict,
  altitude: number,
  factor: string | null = null,
): Night => ({
  id: `n${id}`,
  weekday,
  label: `${weekday} ${day} Nov`,
  short: `${weekday} ${day}`,
  day: String(day),
  hours,
  verdict,
  factor,
  reason: factor === null ? null : shortReason(factor),
  altitude,
})

/** The rest state: the longest night is ruled out, two go, the moon takes the dark from the 22nd. */
const DEFAULT: readonly Night[] = [
  night(1, 'Tue', 17, 5.5, 'out', 54, 'Cloud 100%'),
  night(2, 'Wed', 18, 4.4, 'go', 58),
  night(3, 'Thu', 19, 3.2, 'go', 57),
  night(4, 'Fri', 20, 2.1, 'marginal', 55),
  night(5, 'Sat', 21, 1, 'out', 52, 'Wind 38 km/h'),
  night(6, 'Sun', 22, 0.4, 'out', 50, 'Moon 83% lit'),
  night(7, 'Mon', 23, 0, 'out', 48, 'Moon up all night'),
  night(8, 'Tue', 24, 0, 'out', 46, 'Rain from 18:00'),
  night(9, 'Wed', 25, 0.9, 'out', 45, 'Fog'),
  night(10, 'Thu', 26, 1.9, 'marginal', 44),
]

/** No go night in ten: every night is marginal or out, the answer is "none". */
const WASHOUT: readonly Night[] = [
  night(1, 'Tue', 17, 5.5, 'out', 54, 'Cloud 100%'),
  night(2, 'Wed', 18, 4.4, 'marginal', 58),
  night(3, 'Thu', 19, 3.2, 'out', 57, 'Cloud 85%'),
  night(4, 'Fri', 20, 2.1, 'out', 55, 'Rain from 20:00'),
  night(5, 'Sat', 21, 1, 'out', 52, 'Wind 38 km/h'),
  night(6, 'Sun', 22, 0.4, 'out', 50, 'Moon 83% lit'),
  night(7, 'Mon', 23, 0, 'out', 48, 'Moon up all night'),
  night(8, 'Tue', 24, 0, 'out', 46, 'Rain from 18:00'),
  night(9, 'Wed', 25, 0.9, 'out', 45, 'Fog'),
  night(10, 'Thu', 26, 1.9, 'marginal', 44),
]

/** The extremes: a polar-length night, a low target and the longest factor sentence. */
const EXTREME: readonly Night[] = [
  night(1, 'Tue', 17, 14.6, 'go', 9),
  night(
    2,
    'Wed',
    18,
    13.9,
    'out',
    11,
    'Thin high cloud over the southern horizon from dusk, clearing after 02:00',
  ),
  night(3, 'Thu', 19, 12.2, 'marginal', 8),
  night(4, 'Fri', 20, 9.8, 'go', 12),
  night(5, 'Sat', 21, 6.1, 'out', 10, 'Wind 62 km/h'),
  night(6, 'Sun', 22, 3.3, 'out', 7, 'Moon 91% lit'),
  night(7, 'Mon', 23, 0, 'out', 6, 'Moon up all night'),
  night(8, 'Tue', 24, 0, 'out', 6, 'Fog'),
  night(9, 'Wed', 25, 0.1, 'marginal', 5),
  night(10, 'Thu', 26, 2.6, 'go', 9),
]

/** `?fixture=washout` and `?fixture=extreme`; anything else is the rest state. */
export function nightsFor(fixture: string | undefined): readonly Night[] {
  if (fixture === 'washout') return WASHOUT
  if (fixture === 'extreme') return EXTREME
  return DEFAULT
}

/** The best night: the go night with the most dark hours, the higher target on a tie; null when none is go. */
export function bestNight(nights: readonly Night[]): Night | null {
  const go = nights.filter((n) => n.verdict === 'go')
  return go.reduce<Night | null>(
    (best, n) =>
      best === null ||
      n.hours > best.hours ||
      (n.hours === best.hours && n.altitude > best.altitude)
        ? n
        : best,
    null,
  )
}
