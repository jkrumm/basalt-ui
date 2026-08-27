/**
 * `ControlGroup` — the joined-control primitive (`docs/CONTROLS-SPEC.md` §3), and `ActionGroup`'s
 * derived use of it.
 *
 * The gap it closes: every consumer that wanted a `‹ Today ›` stepper hand-built one — a `Group
 * gap={0}` plus per-child `radius` and `style={{ marginLeft: -1 }}`, restated on each page, each
 * getting the focus-ring z-index wrong in its own way. `basalt/shadow-basalt-export` now names the
 * three words that fork tends to arrive under (`ButtonGroup`, `ButtonRow`, `JoinedButtons`).
 *
 * The GEOMETRY is CSS, and CSS-module hashes are unavailable under `bun test`, so it is asserted
 * from the module text (the idiom `filter-set.test.tsx` and `theme/layout-rhythm-css.test.ts` use).
 * The PARTITION — which adjacent actions get joined — is real logic and is rendered.
 */
import { ActionIcon, Button, MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { ActionGroup } from './actions'
import type { BarAction } from './actions'
import { ControlGroup } from './control-group'

const CSS = readFileSync(join(import.meta.dir, 'controls.module.css'), 'utf8')
const JOINED = CSS.slice(CSS.indexOf('/* ── ControlGroup'))

function mount(node: ReactNode) {
  return render(<MantineProvider>{node}</MantineProvider>)
}

const desktop = () => document.querySelector('.mantine-visible-from-sm')
const mobile = () => document.querySelector('.mantine-hidden-from-sm')

/** The joined boxes inside one variant of the row. */
function groups(root: Element | null): Element[] {
  return [...(root?.querySelectorAll('[data-gap]') ?? [])]
}

function Glyph(): ReactNode {
  return <svg viewBox="0 0 24 24" />
}

describe('the joined box', () => {
  test('renders one element carrying the gap mode, defaulting to "none"', () => {
    const { container } = mount(
      <ControlGroup>
        <Button variant="default">Today</Button>
      </ControlGroup>,
    )
    expect(container.querySelector('[data-gap]')?.getAttribute('data-gap')).toBe('none')
  })

  test('gap="tight" is the un-joined mode, for a set that must stay separately pressable', () => {
    const { container } = mount(
      <ControlGroup gap="tight">
        <Button variant="default">A</Button>
        <Button variant="default">B</Button>
      </ControlGroup>,
    )
    expect(container.querySelector('[data-gap]')?.getAttribute('data-gap')).toBe('tight')
    expect(JOINED).toContain("[data-gap='tight'] {\n  gap: var(--vx-space-control-gap")
  })

  test('joined children collapse their two adjacent borders into one', () => {
    // 2px down the middle reads as a gap someone forgot to close, not as a divider.
    expect(JOINED).toContain("[data-gap='none'] > * + * {\n  margin-inline-start: -1px;")
  })

  test('the radius lives on the outer ends only — that is what makes three boxes one box', () => {
    expect(JOINED).toContain("[data-gap='none'] > *:not(:first-child):not(:last-child) {")
    expect(JOINED).toContain('border-radius: 0;')
    expect(JOINED).toContain("[data-gap='none'] > *:first-child:not(:only-child) {")
    expect(JOINED).toContain("[data-gap='none'] > *:last-child:not(:only-child) {")
  })

  test('a one-child group keeps its normal shape — :only-child is excluded on both ends', () => {
    // A conditional render that dropped two of three children must not lose half its corners.
    expect(JOINED).toContain(':first-child:not(:only-child)')
    expect(JOINED).toContain(':last-child:not(:only-child)')
  })

  test('the internal hairline is drawn here, because the default border is transparent', () => {
    // `cssVariablesResolver` points `--mantine-color-default-border` at transparent on purpose
    // (DESIGN-SPEC §8). The 12%-ink value is `.pill`'s, so a joined pill row and a joined button row
    // read as one family.
    expect(JOINED).toContain("[data-gap='none'] > [data-variant='default'] {")
    expect(JOINED).toContain('color-mix(in srgb, var(--vx-ink) 12%, transparent)')
  })

  test('a filled child keeps its fill edge — the border rule is scoped to the default variant', () => {
    expect(JOINED).not.toMatch(/\[data-gap='none'\] > \* \{\s*border-color/)
  })

  test('hover/focus/active raise the child so its shared edge paints whole', () => {
    expect(JOINED).toContain("[data-gap='none'] > *:focus-visible,")
    expect(JOINED).toContain('z-index: 1;')
    expect(JOINED).toContain('position: relative;')
  })

  test('the group never wraps — a joined set that broke mid-box is worse than an overflow', () => {
    const rule = JOINED.slice(
      JOINED.indexOf('.group {'),
      JOINED.indexOf('}', JOINED.indexOf('.group {')),
    )
    expect(rule).toContain('flex-wrap: nowrap')
    expect(rule).toContain('flex: none')
  })

  test('it adds no role and no label — a joined LOOK is not a semantic group', () => {
    const { container } = mount(
      <ControlGroup>
        <ActionIcon variant="default" aria-label="Previous">
          <Glyph />
        </ActionIcon>
        <Button variant="default">Today</Button>
      </ControlGroup>,
    )
    const box = container.querySelector('[data-gap]')
    expect(box?.hasAttribute('role')).toBe(false)
    expect(box?.hasAttribute('aria-label')).toBe(false)
  })
})

describe('ActionGroup joins what belongs together, and nothing else', () => {
  const stepper: BarAction[] = [
    { key: 'prev', label: 'Previous period', icon: <Glyph />, group: true },
    { key: 'today', label: 'Today', group: true },
    { key: 'next', label: 'Next period', icon: <Glyph />, group: true },
  ]

  test('a run of group:true secondaries becomes ONE joined box on desktop', () => {
    mount(<ActionGroup secondary={stepper} />)
    const joined = groups(desktop())
    expect(joined.length).toBe(1)
    expect(joined[0]?.querySelectorAll('button').length).toBe(3)
  })

  test('a joined member with an icon renders icon-only, its label demoted to the a11y name', () => {
    // `‹ Today ›` is ONE control whose middle segment names it; the arrows' content is their
    // direction. Labelled, the same three actions measured 304px against 118px in Chrome.
    mount(<ActionGroup secondary={stepper} />)
    const row = desktop()
    const prev = row?.querySelector('[aria-label="Previous period"]')
    expect(prev).not.toBeNull()
    expect(prev?.textContent).toBe('')
    // The one member with no icon keeps its label — the rule reads what the caller supplied.
    expect(row?.textContent).toBe('Today')
  })

  test('a joined set with NO icons keeps every label — the icon-only rule is not a width policy', () => {
    mount(
      <ActionGroup
        secondary={[
          { key: 'abs', label: 'Absolute', group: true },
          { key: 'rate', label: 'Rate', group: true },
        ]}
      />,
    )
    expect(groups(desktop()).length).toBe(1)
    expect(desktop()?.textContent).toBe('AbsoluteRate')
  })

  test('independent secondaries are NOT joined — the default row is unchanged', () => {
    mount(
      <ActionGroup
        secondary={[
          { key: 'export', label: 'Export CSV' },
          { key: 'accounts', label: 'Accounts', icon: <Glyph /> },
        ]}
      />,
    )
    expect(groups(desktop()).length).toBe(0)
  })

  test('a non-group action between two group ones splits the run in two', () => {
    // Two runs of one is the same row it was before — the group flag is per-member on purpose, so a
    // set that forgets one member degrades to the old row instead of joining the wrong things.
    mount(
      <ActionGroup
        secondary={[
          { key: 'prev', label: 'Prev', group: true },
          { key: 'loose', label: 'Loose' },
          { key: 'next', label: 'Next', group: true },
        ]}
      />,
    )
    expect(groups(desktop()).length).toBe(0)
  })

  test('adjacent ICON-ONLY entries join on the MOBILE bar without any flag', () => {
    // Below `sm` an icon-bearing action renders as an `ActionIcon` and nothing else, so two in a row
    // are two 30px squares with a gap — three boxes' worth of border for two actions, exactly where
    // width is scarcest.
    mount(
      <ActionGroup
        secondary={[
          { key: 'a', label: 'Filter', icon: <Glyph />, mobile: 'bar' },
          { key: 'b', label: 'Sort', icon: <Glyph />, mobile: 'bar' },
        ]}
      />,
    )
    expect(groups(mobile()).length).toBe(1)
    // …and NOT on desktop, where the same two actions are labelled buttons that are not related.
    expect(groups(desktop()).length).toBe(0)
  })

  test('the mobile PRIMARY is never joined to a sibling — a fill edge against a border edge', () => {
    mount(
      <ActionGroup
        primary={{ key: 'save', label: 'Save', icon: <Glyph /> }}
        secondary={[{ key: 'a', label: 'Filter', icon: <Glyph />, mobile: 'bar' }]}
      />,
    )
    expect(groups(mobile()).length).toBe(0)
  })

  test('a kind:"custom" entry breaks the run — basalt does not draw that node', () => {
    mount(
      <ActionGroup
        secondary={[
          { key: 'prev', label: 'Prev', group: true },
          { key: 'chip', kind: 'custom', node: <span>live</span> },
          { key: 'next', label: 'Next', group: true },
        ]}
      />,
    )
    expect(groups(desktop()).length).toBe(0)
  })
})
