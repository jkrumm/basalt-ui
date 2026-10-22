/**
 * `EmptyState` — the `'page'` vs `'section'` padding, both expressed as the density-tracking
 * `calc(--vx-space-stack-xs * N)` rhythm step rather than a frozen px literal (`empty-state.tsx`'s
 * `PAGE_PADDING_Y`/`PAGE_PADDING_X`/`SECTION_PADDING_Y`/`SECTION_PADDING_X`), so a non-zero density
 * level moves this padding along with every other `--vx-space-*` token instead of staying frozen at
 * today's px value.
 *
 * `renderToStaticMarkup` is used deliberately, the same reason `stat-card.test.tsx` gives: happy-dom
 * does not merely fail to COMPUTE `calc()` (`use-basalt-spacing.test.tsx`'s doc), it rejects a
 * `padding`/`paddingBlock`/`paddingTop` inline style whose value nests `var()` inside `calc()` at
 * `style` set-time — the property is silently dropped from the DOM entirely, not just uncomputed.
 * A real render therefore asserts nothing here; the string React serializes into server-rendered
 * markup is what these tests read.
 */
import { MantineProvider } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { VX } from '../tokens'
import { EmptyState } from './empty-state'

function markup(tier: 'page' | 'section') {
  return renderToStaticMarkup(
    <MantineProvider>
      <EmptyState title="No results" tier={tier} />
    </MantineProvider>,
  )
}

describe('EmptyState padding', () => {
  test('"page" padding is a var()-based calc expression, never a frozen px literal', () => {
    const html = markup('page')
    expect(html).toContain('var(--vx-space-stack-xs')
    expect(html).toContain('calc(')
    // 64px/24px are what the expression resolves to at density 0 — the point is the EXPRESSION
    // ships, not a frozen resolved value.
    expect(html).not.toMatch(/padding:\s*64px\s+24px/)
  })

  test('"section" padding is also a var()-based calc expression', () => {
    const html = markup('section')
    expect(html).toContain('var(--vx-space-stack-xs')
    expect(html).toContain('calc(')
    expect(html).not.toMatch(/padding:\s*32px\s+20px/)
  })

  test('"page" and "section" resolve to different calc multipliers', () => {
    const pageHtml = markup('page')
    const sectionHtml = markup('section')
    // Page is the 16x/6x rhythm step, section is 8x/5x — different expressions entirely.
    expect(pageHtml).toContain('* 16)')
    expect(sectionHtml).toContain('* 8)')
    expect(pageHtml).not.toBe(sectionHtml)
  })
})

describe('common props (`common/props.ts`)', () => {
  test('className reaches the root', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <EmptyState title="No results" className="my-empty-state" />
      </MantineProvider>,
    )
    expect(html).toContain('my-empty-state')
  })
})

describe('EmptyState anatomy (SPEC § 6.11)', () => {
  const html = (tier: 'page' | 'section') =>
    renderToStaticMarkup(
      <MantineProvider>
        <EmptyState title="No results" description="Widen the range." tier={tier} />
      </MantineProvider>,
    )

  test('the title is md at weight 500 in the body font, never the old head-font xl 550', () => {
    for (const tier of ['page', 'section'] as const) {
      const out = html(tier)
      expect(out).toContain('var(--basalt-state-title-size, var(--vx-text-md))')
      expect(out).toContain('font-weight:500')
      expect(out).not.toContain('font-weight:550')
      expect(out).not.toContain('--basalt-font-head')
    }
  })

  test('the description is sm: the component uses two font sizes', () => {
    const out = html('section')
    expect(out).toContain(`font-size:${VX.text.sm}px`)
    expect(out.match(/font-size:[^;"]+/g)).toHaveLength(2)
  })

  test('the section tier is a ring-edged tile at card radius; the page tier is not', () => {
    const section = html('section')
    expect(section).toContain('--basalt-state-ring')
    expect(section).toContain('var(--vx-radius-card)')
    expect(section).not.toContain('border:')
    expect(html('page')).not.toContain('--basalt-state-ring')
  })
})
