/**
 * The header without a browser layout: the brand zone with the rail toggle (the frame's cell on the
 * web, the title bar's under native-overlay), the tier data on every
 * global action and the one kebab. Container queries are CSS a unit environment does not evaluate,
 * so which action yields at which width is `tests/layout/shell-chrome.layout.test.ts`'s and
 * `core/header-tiers.test.ts`'s; this file pins what the markup declares.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { GlobalAction } from '../contract'
import { RailControlProvider } from './grid'
import type { RailControl } from './grid'
import { BrandZone, Header } from './header'
import type { HeaderProps } from './header'

afterEach(cleanup)

const Glyph = ({ className }: { className?: string }) => <svg className={className} />

function renderHeader(
  props: Partial<HeaderProps> = {},
  rail: Partial<RailControl> = {},
): { toggles: number } {
  const out = { toggles: 0 }
  const control: RailControl = {
    state: 'auto',
    collapsed: false,
    setCollapsed: () => {},
    toggle: () => {
      out.toggles += 1
    },
    ...rail,
  }
  render(
    <RailControlProvider value={control}>
      <Header
        brand={{ name: 'Argo' }}
        breadcrumb={<span data-slot="page-breadcrumb-leaf">Runs</span>}
        globalControls={undefined}
        globalActions={[]}
        asideTrigger={null}
        sizeClass="expanded"
        {...props}
      />
    </RailControlProvider>,
  )
  return out
}

const CLUSTER: GlobalAction[] = [
  { kind: 'custom', id: 'status', label: 'Status', render: () => <span>3 jobs</span> },
  { kind: 'custom', id: 'progress', label: 'Export', priority: 2, render: () => <span>41%</span> },
  { kind: 'button', id: 'import', label: 'Import', icon: Glyph, priority: 3, onClick: () => {} },
  { kind: 'button', id: 'tag', label: 'Tag', icon: Glyph, priority: 3, onClick: () => {} },
]

function renderZone(
  brand: HeaderProps['brand'] = { name: 'Argo' },
  rail: Partial<RailControl> = {},
): { toggles: number } {
  const out = { toggles: 0 }
  const control: RailControl = {
    state: 'auto',
    collapsed: false,
    setCollapsed: () => {},
    toggle: () => {
      out.toggles += 1
    },
    ...rail,
  }
  render(
    <RailControlProvider value={control}>
      <BrandZone brand={brand} />
    </RailControlProvider>,
  )
  return out
}

describe('brand zone', () => {
  test('the web identity row leads with the logo alone; the zone is the frame cell above the rail', () => {
    renderHeader()
    expect(document.querySelector('[data-slot="shell-brand-zone"]')).toBeNull()
    expect(document.querySelector('[data-slot="shell-brand-mark"]')?.textContent).toBe('A')
  })

  test('under native-overlay the zone sits in the title bar', () => {
    renderHeader({ chrome: 'native-overlay' })
    expect(document.querySelector('[data-slot="shell-brand-zone"]')?.textContent).toContain('Argo')
    expect(document.querySelector('[data-slot="shell-brand-mark"]')).toBeNull()
  })

  test('shows the brand name and, with no logo, an initial mark', () => {
    renderZone()
    const zone = document.querySelector('[data-slot="shell-brand-zone"]')
    expect(zone?.textContent).toContain('Argo')
    expect(zone?.firstElementChild?.textContent).toBe('A')
  })

  test('a supplied logo is the zone first child, so the brand sits on the nav icon column', () => {
    renderZone({ name: 'Argo', logo: ({ className }) => <svg data-logo className={className} /> })
    const zone = document.querySelector('[data-slot="shell-brand-zone"]')
    expect(zone?.firstElementChild?.hasAttribute('data-logo')).toBe(true)
  })

  test('the toggle is named by what it does and calls the rail control', () => {
    const out = renderZone()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(out.toggles).toBe(1)
  })

  test('a collapsed rail offers to expand it', () => {
    renderZone(undefined, { collapsed: true, state: 'collapsed' })
    expect(
      screen.getByRole('button', { name: 'Expand sidebar' }).getAttribute('aria-expanded'),
    ).toBe('false')
  })
})

describe('global controls center', () => {
  const center = (): HTMLElement | null => document.querySelector('[data-slot="shell-center"]')

  test('a slot without a compact form hides the center below md', () => {
    renderHeader({
      globalControls: { kind: 'controls-slot', count: 1, render: () => <span>pills</span> },
    })
    expect(center()?.className).toContain('hidden')
    expect(center()?.className).toContain('md:flex')
  })

  test('a slot with its own compact form stays in the row at every width', () => {
    renderHeader({
      globalControls: {
        kind: 'controls-slot',
        count: 1,
        compact: true,
        render: () => <span>pills</span>,
      },
    })
    expect(center()?.className).not.toContain('hidden')
    expect(center()?.className).toContain('flex')
  })
})

describe('global action tiers', () => {
  test('every action carries its tier and label as data, priority 1 by default', () => {
    renderHeader({ globalActions: CLUSTER })
    const tiers = Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>('[data-item]')].map((node) => [
        node.dataset['item'],
        node.dataset['priority'],
      ]),
    )
    expect(tiers).toEqual({ status: '1', progress: '2', import: '3', tag: '3' })
    expect(document.querySelector('[data-item="import"]')?.getAttribute('data-label')).toBe(
      'Import',
    )
  })

  test('an action that yields is hidden by its tier class, and priority 1 never is', () => {
    renderHeader({ globalActions: CLUSTER })
    expect(document.querySelector('[data-item="status"]')?.className).not.toContain('max-[')
    expect(document.querySelector('[data-item="progress"]')?.className).toContain('859.98px')
    expect(document.querySelector('[data-item="import"]')?.className).toContain('1039.98px')
  })

  test('a native title bar holds the brand zone too, so its tiers yield 240 px of row later', () => {
    renderHeader({ globalActions: CLUSTER, chrome: 'native-overlay' })
    expect(document.querySelector('[data-item="progress"]')?.className).toContain('1099.98px')
    expect(document.querySelector('[data-item="import"]')?.className).toContain('1279.98px')
  })

  test('the actions render in declaration order inside the trail', () => {
    renderHeader({ globalActions: CLUSTER })
    const ids = [...document.querySelectorAll('[data-slot="shell-trail"] [data-item]')].map(
      (node) => node.getAttribute('data-item'),
    )
    expect(ids).toEqual(['status', 'progress', 'import', 'tag'])
  })

  test('a phone-off action is marked and hidden below md', () => {
    renderHeader({
      globalActions: [{ ...CLUSTER[2]!, mobile: 'more' } as GlobalAction],
    })
    const node = document.querySelector('[data-item="import"]')
    expect(node?.hasAttribute('data-phone-off')).toBe(true)
    expect(node?.className).toContain('max-md:hidden')
  })
})

describe('the one kebab', () => {
  test('there is none while every action is priority 1', () => {
    renderHeader({ globalActions: [CLUSTER[0]!] })
    expect(document.querySelector('[data-slot="shell-kebab"]')).toBeNull()
  })

  test('one kebab serves every yielding tier, and only from where its first item yields', () => {
    renderHeader({ globalActions: CLUSTER })
    const kebabs = document.querySelectorAll('[data-slot="shell-kebab"]')
    expect(kebabs).toHaveLength(1)
    expect(kebabs[0]?.className).toContain('1039.98px')
    expect(kebabs[0]?.className).toContain('859.98px')
  })

  test('with only priority 3 items it appears below 1040 of row and never below 860 on its own account', () => {
    renderHeader({ globalActions: [CLUSTER[2]!] })
    const kebab = document.querySelector('[data-slot="shell-kebab"]')
    expect(kebab?.className).toContain('1039.98px')
    expect(kebab?.className).not.toContain('859.98px')
  })
})

describe('regions', () => {
  test('the strip ends on the global actions: no page action has a host in it', () => {
    renderHeader({ globalActions: [CLUSTER[0]!] })
    expect(document.querySelector('[data-slot="shell-page-bar-host"]')).toBeNull()
    const end = document.querySelector('[data-slot="shell-end"]')
    expect(end?.lastElementChild?.getAttribute('data-slot')).toBe('shell-trail')
    expect(end?.querySelector('[data-item="status"]')?.textContent).toBe('3 jobs')
  })

  test('the breadcrumb is claimed content, not derived here', () => {
    renderHeader({ breadcrumb: <span>Custom trail</span> })
    expect(document.querySelector('[data-slot="shell-breadcrumb"]')?.textContent).toBe(
      'Custom trail',
    )
  })
})
