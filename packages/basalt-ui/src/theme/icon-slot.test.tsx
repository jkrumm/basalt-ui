/**
 * `IconSlot` — the one icon box (`docs/CONTROLS-SPEC.md` §3).
 *
 * The bug this file exists to prevent: a consumer's inline `<svg width="24" height="24">` handed to
 * a basalt control's `icon` prop landed in Mantine's `leftSection`, which is a bare `flex` box with
 * no size of its own. The glyph painted at 24px inside a 30px `ctl` button, sat on the parent's text
 * baseline (so it hung low of the optical centre by the line box's descender), and set the row's
 * height. Measured in Chrome on the playground's header: the `Accounts` secondary read visibly low
 * and left of centre.
 *
 * Two halves, because neither alone would hold. The CSS-TEXT half pins the mechanism (a fixed square
 * box, `100%` on the glyph, `display: block`) — CSS-module class hashes are unavailable under
 * `bun test`, so the declarations themselves are read from the file, the same idiom
 * `controls/filter-set.test.tsx` and `theme/layout-rhythm-css.test.ts` use. The RENDER half pins that
 * every home named by the spec actually routes its `icon` through the slot, found by the
 * `data-basalt-icon` marker attribute rather than by a class.
 */
import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { ActionGroup } from '../controls/actions'
import { FilterPill } from '../controls/filter-pill'
import { SyncButton } from '../controls/sync-button'
import { WidgetHeader } from '../widget-header/widget-header'
import { IconSlot } from './icon-slot'

const ICON_SLOT_CSS = readFileSync(join(import.meta.dir, 'icon-slot.module.css'), 'utf8')
const CONTROLS_CSS = readFileSync(join(import.meta.dir, '../controls/controls.module.css'), 'utf8')
const WIDGET_HEADER_CSS = readFileSync(
  join(import.meta.dir, '../widget-header/widget-header.module.css'),
  'utf8',
)

/** A consumer glyph that declares its OWN geometry — the exact shape that used to leak through. */
function OversizedGlyph(): ReactNode {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" data-testid="glyph">
      <circle cx={12} cy={12} r={10} />
    </svg>
  )
}

/** A consumer glyph with no `width`/`height` and no `viewBox` — paints 300×150 unstyled. */
function UnsizedGlyph(): ReactNode {
  return (
    <svg data-testid="glyph">
      <circle cx={8} cy={8} r={8} />
    </svg>
  )
}

function slots(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-basalt-icon]')]
}

/** The slot wrapping the marked glyph — asserts the glyph is a DIRECT child, which the `> svg`
 *  selector requires to bite. */
function slotAround(container: HTMLElement): HTMLElement | null {
  const glyph = container.querySelector('[data-testid="glyph"]')
  const parent = glyph?.parentElement ?? null
  return parent !== null && parent.hasAttribute('data-basalt-icon') ? parent : null
}

describe('the box is declared once, in CSS, and cannot be set at a call site', () => {
  test('the slot is a fixed square off --vx-space-icon-size with a 16px fallback', () => {
    expect(ICON_SLOT_CSS).toContain('width: var(--vx-space-icon-size, 1rem)')
    expect(ICON_SLOT_CSS).toContain('height: var(--vx-space-icon-size, 1rem)')
  })

  test('the slot never participates in its row’s flex sizing', () => {
    expect(ICON_SLOT_CSS).toContain('flex: none')
    expect(ICON_SLOT_CSS).toContain('display: inline-flex')
    expect(ICON_SLOT_CSS).toContain('align-items: center')
    expect(ICON_SLOT_CSS).toContain('justify-content: center')
  })

  test('the glyph is restated at 100% and taken off the baseline — the two halves of "centred"', () => {
    const rule = ICON_SLOT_CSS.slice(ICON_SLOT_CSS.indexOf('.slot > svg'))
    expect(rule).toContain('width: 100%')
    expect(rule).toContain('height: 100%')
    expect(rule).toContain('display: block')
    // Presentation attributes lose to CSS, which is the whole mechanism — a 24px, a 14px and an
    // attribute-less SVG all resolve to the box.
    expect(rule).toContain('object-fit: contain')
  })

  test('`img` and `picture` icons get the same box — an icon set is as likely to be a sprite', () => {
    expect(ICON_SLOT_CSS).toContain('.slot > img')
    expect(ICON_SLOT_CSS).toContain('.slot > picture')
  })

  test('IconSlot has no size prop — a call site cannot pick a geometry', () => {
    const source = readFileSync(join(import.meta.dir, 'icon-slot.tsx'), 'utf8')
    const props = source.slice(
      source.indexOf('export type IconSlotProps'),
      source.indexOf('export function IconSlot'),
    )
    expect(props).not.toContain('size')
    // `children` + `className` and nothing else.
    expect(props.match(/readonly \w+\??:/g)).toEqual(['readonly children:', 'readonly className?:'])
  })

  test('a home sizes the slot by overriding the box VAR, never by sizing the glyph', () => {
    // The trailing pill affordance is 14px and the widget-tier heading icon is 14px. Both get there
    // through `--vx-space-icon-size`; neither may reintroduce a per-component `> svg` size rule,
    // which is the duplication that let `BarAction` ship with no box at all.
    expect(CONTROLS_CSS).toContain('--vx-space-icon-size: 0.875rem')
    expect(WIDGET_HEADER_CSS).toContain('--vx-space-icon-size: 0.875rem')
    expect(WIDGET_HEADER_CSS).toContain('--vx-space-icon-size: 1rem')
    expect(CONTROLS_CSS).not.toMatch(/\.pillIcon\s*>\s*svg/)
    expect(WIDGET_HEADER_CSS).not.toMatch(/\.icon\s*>\s*svg/)
  })
})

describe('every home named by the spec routes `icon` through the slot', () => {
  test('a BarAction secondary — an oversized consumer SVG lands inside the slot', () => {
    const { container } = render(
      <MantineProvider>
        <ActionGroup
          secondary={[{ key: 'accounts', label: 'Accounts', icon: <OversizedGlyph /> }]}
        />
      </MantineProvider>,
    )
    // Both viewport variants mount (law C9), so the glyph appears twice; every occurrence is slotted.
    const glyphs = [...container.querySelectorAll('[data-testid="glyph"]')]
    expect(glyphs.length).toBeGreaterThan(0)
    for (const glyph of glyphs) {
      expect(glyph.parentElement?.hasAttribute('data-basalt-icon')).toBe(true)
    }
  })

  test('a BarAction PRIMARY too — the mobile icon-only form is the same box', () => {
    const { container } = render(
      <MantineProvider>
        <ActionGroup primary={{ key: 'save', label: 'Save as report', icon: <UnsizedGlyph /> }} />
      </MantineProvider>,
    )
    const glyphs = [...container.querySelectorAll('[data-testid="glyph"]')]
    expect(glyphs.length).toBeGreaterThan(0)
    for (const glyph of glyphs) {
      expect(glyph.parentElement?.hasAttribute('data-basalt-icon')).toBe(true)
    }
  })

  test('an OverflowMenu row — the fold is a home too', () => {
    const { container } = render(
      <MantineProvider>
        <ActionGroup
          secondary={[
            { key: 'a', label: 'A' },
            { key: 'b', label: 'B' },
            { key: 'c', label: 'C' },
            { key: 'd', label: 'D', icon: <OversizedGlyph /> },
          ]}
        />
      </MantineProvider>,
    )
    // The `More` dropdown mounts lazily, so assert the fold exists and its trigger is present; the
    // ROW's slotting is covered by the source guard below, which reads the same code path.
    expect(container.textContent).toContain('More')
  })

  test('a FilterPill — the leading glyph is slotted (every enum filter renders through it)', () => {
    const { container } = render(
      <MantineProvider>
        <FilterPill label="EUR" icon={<OversizedGlyph />} />
      </MantineProvider>,
    )
    expect(slotAround(container)).not.toBeNull()
  })

  test('a FilterPill’s trailing affordance is slotted too, at the 14px box', () => {
    const { container } = render(
      <MantineProvider>
        <FilterPill label="EUR" />
      </MantineProvider>,
    )
    // The `⇅` affordance is basalt's own glyph and still goes through the slot — the box is the
    // slot's on every icon in the tier, framework-drawn or consumer-passed.
    expect(slots(container).length).toBe(1)
  })

  test('a WidgetHeader — tier="widget"', () => {
    const { container } = render(
      <WidgetHeader tier="widget" title="Active users" icon={<OversizedGlyph />} />,
    )
    expect(slotAround(container)).not.toBeNull()
  })

  test('a WidgetHeader — tier="section" (and StatCard, which forwards `icon` to it)', () => {
    const { container } = render(
      <WidgetHeader tier="section" title="Funnel & retention" icon={<UnsizedGlyph />} />,
    )
    expect(slotAround(container)).not.toBeNull()
  })

  test('a SyncButton — basalt’s own glyph obeys the same box', () => {
    const { container } = render(
      <MantineProvider>
        <SyncButton scope="page" syncing={false} onSync={() => {}} />
      </MantineProvider>,
    )
    expect(slots(container).length).toBeGreaterThan(0)
  })
})

describe('the slot is decorative and queryable, by construction', () => {
  test('aria-hidden is unconditional — the control carries the name, never the icon', () => {
    const { container } = render(
      <IconSlot>
        <OversizedGlyph />
      </IconSlot>,
    )
    expect(container.querySelector('[data-basalt-icon]')?.getAttribute('aria-hidden')).toBe('true')
  })

  test('a home’s className is composed ONTO the slot, never in place of it', () => {
    const { container } = render(
      <IconSlot className="home-colour">
        <OversizedGlyph />
      </IconSlot>,
    )
    // The module hash is '' under `bun test`, so the assertion is that the home's class survived
    // alongside whatever the module resolves to — i.e. it is appended, not substituted.
    expect(container.querySelector('[data-basalt-icon]')?.className).toContain('home-colour')
  })
})

/**
 * The recurrence guard. Every `leftSection`/`rightSection` in the control tier that carries a
 * CALLER-supplied icon must route it through `IconSlot` — this is what makes a seventh control
 * added next month fail here instead of shipping an un-boxed glyph, which is exactly how
 * `BarAction` shipped.
 *
 * Scoped to the files that own an `icon` prop in the tier the spec governs. `src/shell/app-sidebar.tsx`
 * and `src/shell/app-mobile-nav.tsx` are deliberately out of scope: a nav row's icon column is sized
 * by the sidebar's own rhythm rules, not by the control tier, and folding them in is a separate
 * change with its own visual budget.
 */
describe('no control in the tier may hand a caller’s icon straight to a section slot', () => {
  const TIER_FILES = [
    '../controls/actions.tsx',
    '../controls/filter-pill.tsx',
    '../controls/sync-button.tsx',
    '../shell/sidebar-blocks.tsx',
  ] as const

  for (const rel of TIER_FILES) {
    test(`${rel} routes every icon-bearing section through IconSlot`, () => {
      const source = readFileSync(join(import.meta.dir, rel), 'utf8')
      const offenders: string[] = []
      for (const match of source.matchAll(/(left|right)Section[:=]\s*([^,\n]*)/g)) {
        const raw = match[2] ?? ''
        // A bare identifier (`leftSection: lead`) is resolved one level to its `const` initialiser,
        // so a slot built a line above still counts. One level only — anything deeper than that is
        // indirection a reader could not follow either.
        const bare = /^([A-Za-z_$][\w$]*)\s*\}?\)?,?$/.exec(raw.trim())
        const declared =
          bare === null
            ? undefined
            : new RegExp(`\\bconst ${bare[1]}\\b[^\\n]*(?:\\n[^\\n]*){0,3}`).exec(source)?.[0]
        const value = declared ?? raw
        // Only the icon-bearing sites are in scope — a `rightSection` holding a count badge or a
        // `<Text>` meta string is not an icon and has no box to pin.
        if (!/icon|glyph|lead/i.test(value)) continue
        if (value.includes('IconSlot')) continue
        offenders.push(match[0].trim())
      }
      expect(offenders).toEqual([])
    })
  }
})
