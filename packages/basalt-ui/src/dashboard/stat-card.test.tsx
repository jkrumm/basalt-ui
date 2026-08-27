/**
 * `StatCard`'s threshold rail — the one behavior in this component that carries information rather
 * than layout, and the one where a regression is silent: a wrong rail colour still renders a
 * perfectly good-looking card.
 *
 * Two invariants, both asserted against real rendered markup:
 *
 *  1. EVERY tone states its verdict in TEXT. The rail is `aria-hidden` decoration; colour alone must
 *     never be the only carrier of a threshold (WCAG 1.4.1), so a `VisuallyHidden` string ships with
 *     it — for `good` no less than for `bad`.
 *  2. OMISSION IS NOT `good`. `tone` undefined means "fine, OR nothing measured", and those two are
 *     the same untinted card on purpose. A card with no reading must not be able to render green by
 *     leaving the prop off, so the absence case asserts no rail and no verdict text at all — which a
 *     future `tone = tone ?? 'good'` style default would immediately fail.
 *
 * A DOM harness now exists (`tests/setup/dom.ts`, preloaded via the root `bunfig.toml`; see
 * `theme/use-basalt-spacing.test.tsx`'s doc) — `renderToStaticMarkup` inside a real `MantineProvider`
 * is used deliberately here instead, since the rail is an inline style on server-rendered markup.
 * Converting to the DOM harness would only be worth it if a future assertion here needed live DOM
 * behavior (e.g. computed styles, focus/hover interaction) rather than the static markup string.
 */
import { MantineProvider } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatCard } from './stat-card'
import type { StatCardTone } from './stat-card'

function render(tone?: StatCardTone) {
  return renderToStaticMarkup(
    <MantineProvider>
      {/* exactOptionalPropertyTypes forbids an explicit tone={undefined} — spread only when set */}
      <StatCard
        title="Downtime · last 24h"
        value="0 min"
        {...(tone !== undefined ? { tone } : {})}
      />
    </MantineProvider>,
  )
}

const TONES: { tone: StatCardTone; token: string; verdict: string }[] = [
  { tone: 'good', token: 'var(--vx-status-good)', verdict: 'Within the good threshold' },
  { tone: 'warn', token: 'var(--vx-status-warn)', verdict: 'Past the warning threshold' },
  { tone: 'bad', token: 'var(--vx-status-bad)', verdict: 'Past the severe threshold' },
]

describe('every tone draws its rail from the per-scheme status token', () => {
  for (const { tone, token } of TONES) {
    test(tone, () => {
      const markup = render(tone)
      // A hex here would be one scheme's colour frozen into both — the rail has to re-resolve with
      // the palette, including under a consumer's `derive` retune.
      expect(markup).toContain(`background:${token}`)
      expect(markup).toContain(`data-tone="${tone}"`)
    })
  }
})

describe('every tone also states its verdict in text', () => {
  for (const { tone, verdict } of TONES) {
    test(tone, () => {
      expect(render(tone)).toContain(verdict)
    })
  }
})

describe('omitting tone is not "good" — it is untinted, and says nothing', () => {
  const markup = render()

  test('no rail is drawn', () => {
    expect(markup).not.toContain('var(--vx-status-')
  })

  test('the card carries no data-tone at all', () => {
    // Part of the same contract, and the half a consumer can style against: `[data-tone]` must not
    // match an unmarked card. A default of any kind — including a placeholder like `tone ?? 'none'`
    // that draws no rail — would put the attribute back and break that selector silently.
    expect(markup).not.toContain('data-tone')
  })

  test('no verdict is announced', () => {
    for (const { verdict } of TONES) expect(markup).not.toContain(verdict)
  })

  test('the value still renders — the card is normal, just unmarked', () => {
    expect(markup).toContain('0 min')
  })
})

describe('the header composes WidgetHeader at the widget tier', () => {
  test('renders an h3 carrying the title', () => {
    const markup = renderToStaticMarkup(
      <MantineProvider>
        <StatCard title="Active Users" value="12,483" />
      </MantineProvider>,
    )
    expect(markup).toContain('<h3')
    expect(markup).toContain('Active Users')
  })
})

describe('info and subtitle reach the composed WidgetHeader', () => {
  function renderHeader(props: { info?: string; subtitle?: string }) {
    return renderToStaticMarkup(
      <MantineProvider>
        <StatCard title="Training load" value="412" {...props} />
      </MantineProvider>,
    )
  }

  test('the subtitle renders as its own line under the hero row', () => {
    expect(renderHeader({ subtitle: 'TSS · 7-day rolling' })).toContain('TSS · 7-day rolling')
  })

  test('the info text ships with the glyph, and never inside the heading', () => {
    const markup = renderHeader({ info: 'Sum of per-session TSS over 7 days.' })
    // `WidgetHeader` renders the bubble only while open, so the closed markup carries the named
    // trigger — what matters here is that the card FORWARDED the prop and that the text stayed OUT
    // of the `<h3>`, which is what an `info` rendered inside the heading would silently do.
    expect(markup).toContain('aria-label="More information"')
    const heading = /<h3[^>]*>(.*?)<\/h3>/.exec(markup)?.[1] ?? ''
    expect(heading).toContain('Training load')
    expect(heading).not.toContain('Sum of')
  })

  test('neither prop renders anything when omitted — no glyph, no empty line', () => {
    expect(renderHeader({})).not.toContain('More information')
  })
})

describe('sparklinePlacement', () => {
  function renderWithSparkline(placement?: 'bleed' | 'right') {
    return renderToStaticMarkup(
      <MantineProvider>
        <StatCard
          title="Active Users"
          value="12,483"
          sparkline={<span data-testid="spark">spark</span>}
          {...(placement !== undefined ? { sparklinePlacement: placement } : {})}
        />
      </MantineProvider>,
    )
  }

  test('defaults to bleed — the full-width row bled to the card edges', () => {
    const markup = renderWithSparkline()
    expect(markup).toContain('data-placement="bleed"')
  })

  test('right sits the sparkline beside the hero-value row', () => {
    const markup = renderWithSparkline('right')
    expect(markup).toContain('data-placement="right"')
  })
})
