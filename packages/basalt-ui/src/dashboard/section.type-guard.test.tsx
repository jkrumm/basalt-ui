/**
 * Compile-time proof that an untitled `Section` cannot carry header-only props: with no heading
 * there is nowhere to draw a count, info glyph, subtitle, icon or hero metric, so each is a tsc
 * error rather than a silently dropped prop. Proven by `tsc --noEmit` (one `@ts-expect-error` per
 * bad line); the runtime test only keeps the file in the suite.
 */
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import type { SectionProps } from './section'

function accept(props: SectionProps): SectionProps {
  return props
}
const children: ReactNode = null
const tabs: ReactNode = null

// ── Valid ───────────────────────────────────────────────────────────────────
accept({ title: 'Usage', count: 3, info: 'i', subtitle: 's', children })
accept({ tabs, 'aria-label': 'Panes', children })
accept({ tabs, children })

// ── Invalid ─────────────────────────────────────────────────────────────────
// @ts-expect-error — an untitled section has no heading to hang a count on
accept({ tabs, count: 3, children })
// @ts-expect-error — nor an info glyph
accept({ tabs, info: 'i', children })
// @ts-expect-error — nor a subtitle
accept({ tabs, subtitle: 's', children })
// @ts-expect-error — nor an icon
accept({ tabs, icon: null, children })
// @ts-expect-error — nor a hero value
accept({ tabs, value: '1', children })
// @ts-expect-error — a titled section takes no aria-label of its own
accept({ title: 'Usage', 'aria-label': 'x', children })
// @ts-expect-error — no title and no tabs names nothing
accept({ children })

describe('Section untitled type guard', () => {
  test('compiles (the assertions are the @ts-expect-error lines)', () => {
    expect(true).toBe(true)
  })
})
