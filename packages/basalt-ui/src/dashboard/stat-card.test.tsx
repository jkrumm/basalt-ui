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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

/**
 * `unit` and `breakdown` — the two props that existed as hand-rolled cards in three consumers
 * before they existed here. Both are asserted through the same static markup as the rail above; the
 * CSS half (which cannot resolve under `bun test`, where a `.module.css` import is `undefined`) is
 * pinned against the shipped stylesheet TEXT at the bottom of this file, the pattern
 * `page-bar.test.tsx` uses.
 */
describe('unit — the hero value is a number and a unit, not one string', () => {
  function renderUnit(props: { unit?: string; value?: string }) {
    return renderToStaticMarkup(
      <MantineProvider>
        <StatCard title="Training load" value="412" {...props} />
      </MantineProvider>,
    )
  }

  test('renders after the value, and both are present', () => {
    const markup = renderUnit({ unit: 'TSS' })
    expect(markup).toContain('412')
    expect(markup).toContain('TSS')
    // Order matters — a unit BEFORE the numeral reads as a currency prefix, which it is not.
    expect(markup.indexOf('412')).toBeLessThan(markup.indexOf('TSS'))
  })

  test('omitting it renders nothing extra', () => {
    expect(renderUnit({})).not.toContain('TSS')
  })

  test('it is not the same channel as `subtitle` — a card may carry both', () => {
    const markup = renderToStaticMarkup(
      <MantineProvider>
        <StatCard title="Training load" value="412" unit="TSS" subtitle="7-day rolling" />
      </MantineProvider>,
    )
    expect(markup).toContain('TSS')
    expect(markup).toContain('7-day rolling')
  })
})

/**
 * `deltaFormat` — because not every delta is a percentage, and the default said it was.
 *
 * A pace card's trend is `0:12 /km` and a speed card's is `0.3 km/h`; both rendered as `0.3%`, which
 * is a wrong unit on a KPI — the failure worse than showing no chip at all, and the reason the
 * consumer that needed one kept its card hand-rolled (the `HeroCard` fork `shadow-basalt-export`
 * reports). The prop is a FUNCTION over the signed number, not a label string: `delta` still drives
 * the tone and the glyph, so there is one place the sign is decided.
 */
describe('deltaFormat — a delta that is not a percentage', () => {
  function renderDelta(props: {
    delta?: number
    deltaFormat?: (delta: number) => string
    deltaGlyph?: boolean
    deltaPeriod?: string
  }) {
    return renderToStaticMarkup(
      <MantineProvider>
        <StatCard title="Pace" value="5:31" unit="/km" {...props} />
      </MantineProvider>,
    )
  }

  test('the default is still a one-decimal percentage — no existing card moves', () => {
    const markup = renderDelta({ delta: 0.3 })
    expect(markup).toContain('0.3%')
  })

  test('a formatter replaces the label and the percent is gone', () => {
    const markup = renderDelta({ delta: 0.3, deltaFormat: (v) => `${v.toFixed(1)} km/h` })
    expect(markup).toContain('0.3 km/h')
    expect(markup).not.toContain('0.3%')
  })

  test('the formatter receives the SIGNED value, so it can print an absolute delta itself', () => {
    // argo's walking-pad pace card: the delta is seconds per km, faster is a negative number, and
    // the sign belongs in the string. `deltaGlyph={false}` stops the ▼ saying it a second time.
    const markup = renderDelta({
      delta: -12,
      deltaFormat: (s) => `${s < 0 ? '−' : '+'}0:${String(Math.abs(s)).padStart(2, '0')} /km`,
      deltaGlyph: false,
    })
    // The chip's whole text, so nothing survives beside it — the glyph, or a stray `12.0%`.
    expect(markup).toContain('>−0:12 /km</span>')
    expect(markup).not.toContain('▼')
  })

  test('the glyph and the tone still come off the number, not the label', () => {
    const markup = renderDelta({ delta: -12, deltaFormat: (s) => `${Math.abs(s)} s` })
    // Negative reads as danger and keeps its ▼ — the formatter only owns the magnitude string.
    expect(markup).toContain('▼')
    expect(markup).toContain('var(--vx-status-bad)')
  })

  test('deltaPeriod still rides beside a formatted delta', () => {
    const markup = renderDelta({
      delta: 0.3,
      deltaFormat: (v) => `${v.toFixed(1)} km/h`,
      deltaPeriod: 'WoW',
    })
    expect(markup).toContain('0.3 km/h')
    expect(markup).toContain('WoW')
  })

  test('a formatter with no delta renders no chip at all', () => {
    expect(renderDelta({ deltaFormat: (v) => `${v} km/h` })).not.toContain('km/h')
  })
})

describe('deltaPolarity — an up-is-bad metric never paints the good tone on a rise', () => {
  test('deltaPolarity="up-bad" never carries the good status token', () => {
    // No `tone` — StatCard paints `VX.status[tone]` on its rail regardless of the delta chip, so a
    // `tone="bad"` render would pass this assertion even if the chip's own polarity were dropped.
    const markup = renderToStaticMarkup(
      <MantineProvider>
        <StatCard title="Confidence" value="35.9%" delta={12} deltaPolarity="up-bad" />
      </MantineProvider>,
    )
    expect(markup).not.toContain('var(--vx-status-good)')
    expect(markup).toContain('var(--vx-status-bad)')
  })

  test('omitting deltaPolarity keeps every existing badge byte-identical (default up-good)', () => {
    const markup = renderToStaticMarkup(
      <MantineProvider>
        <StatCard title="Active Users" value="12,483" delta={4.2} />
      </MantineProvider>,
    )
    expect(markup).toContain('var(--vx-status-good)')
    expect(markup).not.toContain('var(--vx-status-bad)')
  })
})

describe('breakdown — the parts the hero number is made of', () => {
  const ROWS = [
    { label: 'Paid', value: '1,204' },
    { label: 'Organic', value: '842' },
    { label: 'Referral', value: '31', tone: 'bad' as const },
  ]

  function renderBreakdown(breakdown?: readonly { label: string; value: string }[]) {
    return renderToStaticMarkup(
      <MantineProvider>
        <StatCard
          title="Orders"
          value="2,077"
          {...(breakdown !== undefined ? { breakdown } : {})}
        />
      </MantineProvider>,
    )
  }

  test('every row renders its label and its value', () => {
    const markup = renderBreakdown(ROWS)
    for (const row of ROWS) {
      expect(markup).toContain(row.label)
      expect(markup).toContain(row.value)
    }
  })

  test('the rows are a description list — each row IS a term and its value', () => {
    const markup = renderBreakdown(ROWS)
    expect(markup).toContain('<dl')
    expect((markup.match(/<dt/g) ?? []).length).toBe(3)
    expect((markup.match(/<dd/g) ?? []).length).toBe(3)
  })

  test('a toned row carries data-tone; an untoned one carries nothing', () => {
    const markup = renderBreakdown(ROWS)
    expect(markup).toContain('data-tone="bad"')
    // Omission is not `good`, exactly as it is not on the card itself.
    expect(markup).not.toContain('data-tone="good"')
  })

  test('omitted, and an empty array, render no list at all', () => {
    expect(renderBreakdown()).not.toContain('<dl')
    expect(renderBreakdown([])).not.toContain('<dl')
  })

  // The reason the rows live INSIDE the header block rather than beside it: with
  // `sparklinePlacement="right"` the card body is a flex ROW, so a third child there would sit next
  // to the trend instead of under the number it splits.
  test('the list sits inside the header block, before the sparkline slot', () => {
    const markup = renderToStaticMarkup(
      <MantineProvider>
        <StatCard
          title="Orders"
          value="2,077"
          breakdown={ROWS}
          sparklinePlacement="right"
          sparkline={<span>spark</span>}
        />
      </MantineProvider>,
    )
    expect(markup.indexOf('<dl')).toBeLessThan(markup.indexOf('spark'))
  })
})

/**
 * The CSS half, pinned against the shipped module text. A `.module.css` resolves to `undefined`
 * under `bun test` (no bundler in the loop), so the class names never reach the markup and the only
 * checkable thing is the stylesheet itself.
 */
describe('stat-card.module.css — the breakdown block', () => {
  const css = readFileSync(resolve(import.meta.dirname, 'stat-card.module.css'), 'utf8')
  /** Declarations only — the comments above them discuss hairlines and borders by name. */
  const decls = css.replace(/\/\*[\s\S]*?\*\//g, '')

  function rule(selector: string): string {
    const start = decls.indexOf(`${selector} {`)
    expect(start).toBeGreaterThan(-1)
    return decls.slice(start, decls.indexOf('}', start))
  }

  test('a row is one line at the TAG tier, from the token and never a literal', () => {
    expect(rule('.breakdownRow')).toContain('min-height: var(--vx-space-control-height-tag)')
  })

  // THE law this block had to not break: `theme/divider-law.test.ts` inventories every horizontal
  // hairline basalt draws, and §2.1 puts one between OPTION rows and nowhere else. Three rules
  // inside a KPI card would read as a table wearing a card's clothes — and would fail that test.
  test('no row draws a hairline — not a border, not a rule, not a divider', () => {
    expect(decls).not.toMatch(/\.breakdown[^{]*\{[^}]*border/)
    expect(decls).not.toContain('--vx-surface-hairline')
  })

  test('the label is muted prose and the value is mono ink — the separation is weight, not a line', () => {
    expect(rule('.breakdownLabel')).toContain('color: var(--vx-muted)')
    expect(rule('.breakdownValue')).toContain('font-family: var(--basalt-font-mono)')
    expect(rule('.breakdownValue')).toContain('color: var(--vx-ink)')
  })

  test('a toned row reads the per-scheme status solid, never a hex', () => {
    for (const tone of ['good', 'warn', 'bad']) {
      expect(rule(`.breakdownRow[data-tone='${tone}'] .breakdownValue`)).toContain(
        `color: var(--vx-status-${tone})`,
      )
    }
  })

  test('the unit beside the hero value is mono, muted and small — in widget-header, its owner', () => {
    const headerCss = readFileSync(
      resolve(import.meta.dirname, '..', 'widget-header', 'widget-header.module.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    const start = headerCss.indexOf('.unit {')
    expect(start).toBeGreaterThan(-1)
    const unit = headerCss.slice(start, headerCss.indexOf('}', start))
    expect(unit).toContain('font-family: var(--basalt-font-mono)')
    expect(unit).toContain('font-size: var(--vx-text-sm)')
    expect(unit).toContain('color: var(--vx-muted)')
  })
})
