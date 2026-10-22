/** One source for the body readings and the copy the S7 sections share: every surface states the same figure and the same cause. */
import { retryCopy } from '../shot-state'

/** Invented readings: lean mass is weight × (1 − body fat), so the strip and the meters agree. */
export const BODY = { weightKg: 72.3, fatPct: 17.8, leanKg: 59.4, measured: '19 Oct' } as const

/** The previous caliper reading (5 Oct), for the change since it. */
export const BODY_PREV = { fatPct: 18.2, leanKg: 59.1 } as const

export const NO_WEIGH_INS = 'No weigh-ins in this window.'
export const WEIGHT_ERROR = retryCopy('weight log')
export const STRENGTH_ERROR = retryCopy('strength log')
export const SKINFOLD_ERROR = retryCopy('skinfold log')
export const CALIPER_NEXT = 'Log a session to start the history.'
export const CALIPER_GAP = 'No caliper session in this window'
export const NO_CALIPER = `${CALIPER_GAP}. ${CALIPER_NEXT}`
export const INOL_GAP = 'No sessions logged in this window'
export const INOL_NEXT = 'INOL needs at least two sessions per lift.'
export const NO_INOL = `${INOL_GAP}. ${INOL_NEXT}`
export const NO_E1RM = 'No estimated 1RM in this window. Log a lift to start the trend.'
