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
