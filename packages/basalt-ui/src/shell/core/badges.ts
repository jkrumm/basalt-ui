/**
 * `NavBadge` rollup: the one place a section header, a collapsed rail row, a tab and the More slot
 * learn what their subtree carries (concept section 1 row "Nav badges").
 *
 * A badge is a count, a dot or nothing. It is neutral unless `attention: true`, which maps to ONE
 * fixed warn colour: attention never escalates with how many badges carry it. Two attention badges
 * lit at once is a "never" (concept section 8, rung 8): attention that marks two places marks none,
 * so the projector raises a dev assertion once.
 */
import type { BadgeMap, NavBadge } from './types'

/** The two colours a badge has. `warn` is the one attention colour. */
export type BadgeTone = 'neutral' | 'warn'

/** Lit: a dot, or a count above zero. `count: 0` renders nothing and rolls up as nothing. */
export function isLit(badge: NavBadge | null | undefined): badge is NavBadge {
  if (badge === null || badge === undefined) return false
  return 'dot' in badge ? badge.dot === true : badge.count > 0
}

export function badgeTone(badge: NavBadge | null | undefined): BadgeTone {
  return isLit(badge) && badge.attention === true ? 'warn' : 'neutral'
}

/**
 * Folds badges into one: the sum of the lit counts, else a dot when only dots are lit, else `null`.
 * `attention` is set when any lit badge carries it, so the rollup shows the one warn colour.
 */
export function rollupBadges(badges: Iterable<NavBadge | null | undefined>): NavBadge | null {
  let count = 0
  let dot = false
  let attention = false
  for (const badge of badges) {
    if (!isLit(badge)) continue
    if (badge.attention === true) attention = true
    if ('dot' in badge) dot = true
    else count += badge.count
  }
  const tint = attention ? { attention: true } : {}
  if (count > 0) return { count, ...tint }
  if (dot) return { dot: true, ...tint }
  return null
}

/** Ids whose badge is lit with `attention: true`, in map order. More than one is the "never". */
export function litAttentionIds(badges: BadgeMap | undefined): string[] {
  if (badges === undefined) return []
  return Object.entries(badges)
    .filter(([, badge]) => isLit(badge) && badge.attention === true)
    .map(([id]) => id)
}

/**
 * A dev-only assertion that raises once per returned function and is silent in production. One per
 * mounted shell, so a re-render never repeats it. `message` builds the text from the call's
 * arguments, so the warning can name what tripped it.
 *
 * A deliberate sibling of `devAssertOnce` in `src/page/core/claims.ts`: the two cores may not
 * import each other (each folder's layering test), so a change to the dev gate lands in both.
 */
export function devAssertOnce<A extends unknown[]>(
  message: (...args: A) => string,
): (...args: A) => void {
  let raised = false
  return (...args) => {
    if (process.env.NODE_ENV === 'production' || raised) return
    raised = true
    // eslint-disable-next-line no-console -- dev-only diagnostic
    console.warn(message(...args))
  }
}
