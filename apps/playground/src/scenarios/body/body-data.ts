/** One source for the body readings and the copy the S7 sections share: every surface states the same figure and the same cause. */
import { retryCopy } from '../shot-state'

/** Invented readings: lean mass is weight × (1 − body fat), so the strip and the meters agree. */
export const BODY = { weightKg: 72.3, fatPct: 17.8, leanKg: 59.4, measured: '19 Oct' } as const

/** The previous caliper reading (5 Oct), for the change since it. */
export const BODY_PREV = { weightKg: 72.8, fatPct: 18.2, leanKg: 59.1 } as const

export const WEIGH_IN_GAP = 'No weigh-ins in this window'
export const NO_WEIGH_INS = `${WEIGH_IN_GAP}. Log your weight to start the trend.`
export const WEIGHT_ERROR = retryCopy('weight log')
export const STRENGTH_ERROR = retryCopy('strength log')
export const SKINFOLD_ERROR = retryCopy('skinfold log')
export const CALIPER_NEXT = 'Log a session to start the history.'
export const CALIPER_GAP = 'No caliper session in this window'
export const INOL_GAP = 'No sessions logged in this window'
export const INOL_NEXT = 'INOL needs at least two sessions per lift.'
export const NO_INOL = `${INOL_GAP}. ${INOL_NEXT}`
export const NO_E1RM = 'No estimated 1RM in this window. Log a lift to start the trend.'

/** INOL, defined once for every card that shows it. */
export const INOL_DEFINITION =
  "INOL (Intensity-Number of Lifts) weighs a session's volume by how close the sets are to your max. 0.6 to 1.0 is the productive range."

/** The weight goal: drawn on the trend chart, so no surface asks for one. */
export const GOAL_KG = 70
/** Days of weigh-ins behind the trend chart and the range cell. */
export const WEIGHT_DAYS = 60
/** Invented: a slow fall with a daily wobble, ending on the strip's reading. One series feeds the chart and the 60-day range. */
export const WEIGHT_KG: readonly number[] = Array.from({ length: WEIGHT_DAYS }, (_, i) => {
  const trend = 75.6 - i * 0.055
  const wobble = Math.sin(i * 2.1) * 0.6 + Math.cos(i * 0.9) * 0.3
  return i === WEIGHT_DAYS - 1 ? BODY.weightKg : trend + wobble
})
/** The lowest and highest weigh-in of the window, rounded to the 0.1 kg the cells print. */
export const WEIGHT_LOW_KG = Math.round(Math.min(...WEIGHT_KG) * 10) / 10
export const WEIGHT_HIGH_KG = Math.round(Math.max(...WEIGHT_KG) * 10) / 10
/** The reading date: the weigh-in chart, the strips and the skinfold history all end here. */
export const READING_DATE = new Date(Date.UTC(2026, 9, 20, 12))
