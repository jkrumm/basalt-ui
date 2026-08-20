/**
 * `MobileNav` — the eight behaviours that make the bar a NAVIGATION bar rather than a menu.
 *
 * The first three are the user's actual complaint, encoded:
 *  1. tapping a destination navigates through the consumer's anchor and raises NOTHING,
 *  3. a small group opens a content-sized `Menu` — never the full-viewport `Drawer` that used to
 *     appear for a handful of rows,
 *  4. and the `Drawer` still exists, but only past the row count a menu can hold.
 *
 * Harness constraints that shape every selector below (see `tests/setup/dom.ts`): components mount
 * under a BARE `<MantineProvider>` (`BasaltProvider` would drag in the query client and the palette
 * `<style>`, neither of which this component reads); CSS-module class hashes are unavailable under
 * `bun test`, so nothing here selects on `classes.*` — it selects on `data-testid`, the accessible
 * name, or Mantine's stable static classes (`.mantine-Menu-item`, `.mantine-Drawer-content`); and
 * `matchMedia` is pinned to `matches: false`, so `hiddenFrom`/`prefers-reduced-motion` are not
 * assertable here at all (§9.6 leaves those to a real device).
 *
 * Both surfaces mount a frame AFTER the click that opens them — floating-ui positions on an effect
 * — so every open/close assertion is a `waitFor`, never a synchronous `expect` on the next line.
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { MobileNav } from './app-mobile-nav'
import { projectMobileNav } from './mobile-nav-model'
import type { MobileNavConfig, NavAnchorProps, SidebarItem, SidebarSection } from '../nav/types'

// ── fixtures ─────────────────────────────────────────────────────────────────────────────────────

function item(key: string, extra: Partial<SidebarItem> = {}): SidebarItem {
  return { key, label: key[0]?.toUpperCase() + key.slice(1), icon: null, ...extra }
}

/**
 * A stand-in for the consumer's router `Link`. The real seam is exactly this shape — basalt hands
 * it `className`/`onClick`/`aria-*` and hosts whatever it renders — so a test anchor that spreads
 * its props onto an `<a>` proves the hand-off without mounting a router.
 */
function testAnchor(testid: string) {
  // `children` is destructured out and re-placed rather than left in the spread purely so
  // `jsx-a11y(anchor-has-content)` can see the content — the rule cannot follow a spread.
  return function TestAnchor({ children, ...rest }: NavAnchorProps): ReactElement {
    return (
      <a data-testid={testid} {...rest}>
        {children}
      </a>
    )
  }
}

function renderBar(sections: SidebarSection[], config?: MobileNavConfig) {
  const model = projectMobileNav(sections, config ? { config } : undefined)
  return render(
    <MantineProvider>
      <MobileNav model={model} {...(config ? { config } : {})} />
    </MantineProvider>,
  )
}

const menu = (): Element | null => document.querySelector('[role="menu"]')
const drawer = (): Element | null => document.querySelector('.mantine-Drawer-content')

/**
 * Waits for a surface to DISAPPEAR — and does it by throwing a plain `Error`, never by failing an
 * `expect(node).toBeNull()` inside the `waitFor` callback.
 *
 * That is not style. `waitFor` re-runs the callback until it stops throwing, and bun's matcher
 * serializes the received value into the failure message on EVERY attempt: a happy-dom element
 * carries the whole listener map plus its parent chain, so one such message takes multiple seconds
 * to build — longer than `waitFor`'s own 1s timeout, which makes an assertion that WOULD have
 * passed on the next poll fail with a stale error instead. A bare `throw` costs nothing.
 */
async function waitForGone(what: 'menu' | 'drawer'): Promise<void> {
  const find = what === 'menu' ? menu : drawer
  await waitFor(() => {
    if (find() !== null) throw new Error(`the ${what} is still open`)
  })
}

/** A cancelable click, dispatched by hand so the test can read `defaultPrevented` back off it —
 *  which is the only observable difference between "navigated" and "suppressed the navigation". */
function clickCancelable(node: Element): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  fireEvent(node, event)
  return event
}

// ── the behaviours ───────────────────────────────────────────────────────────────────────────────

describe('MobileNav', () => {
  /**
   * THE POINT OF THE REWRITE. A slot is a destination: the consumer's anchor IS the tab, and a tap
   * raises no overlay at all. Both negative assertions are load-bearing — the old bar opened a
   * sheet here, which cost a second tap to reach the same page.
   */
  test('1. a link slot renders item.Anchor with the spread props and opens no overlay', async () => {
    renderBar([
      {
        label: 'Main',
        items: [
          item('home', { mobile: 'tab', Anchor: testAnchor('anchor-home') }),
          item('reports'),
        ],
      },
    ])

    const anchor = screen.getByTestId('anchor-home')
    // The consumer's component received basalt's chrome props, not just its children.
    expect(anchor.tagName).toBe('A')
    expect(anchor.getAttribute('aria-label')).toBe('Home')
    expect(anchor.getAttribute('class')).toBeTruthy()
    expect(anchor.textContent).toContain('Home')

    fireEvent.click(anchor)
    // Give any overlay a frame to mount — the assertion is that none ever does.
    await waitFor(() => expect(screen.getByTestId('anchor-home')).toBeTruthy())
    expect(menu()).toBeNull()
    expect(drawer()).toBeNull()
  })

  /** §2.5 — re-tapping the slot you are already on is a scroll-to-top, not a redundant history
   *  entry. `preventDefault` is what suppresses the router's own click handler. */
  test('2. re-tapping the ACTIVE slot scrolls the configured element and suppresses navigation', () => {
    const scrolled: ScrollToOptions[] = []
    const target = document.createElement('div')
    target.scrollTo = ((options: ScrollToOptions) => {
      scrolled.push(options)
    }) as typeof target.scrollTo
    let asked = 0

    renderBar(
      [
        {
          label: 'Main',
          items: [
            item('home', { mobile: 'tab', active: true, Anchor: testAnchor('anchor-home') }),
            item('activity', { mobile: 'tab', Anchor: testAnchor('anchor-activity') }),
          ],
        },
      ],
      {
        getScrollElement: () => {
          asked += 1
          return target
        },
      },
    )

    const active = clickCancelable(screen.getByTestId('anchor-home'))
    expect(active.defaultPrevented).toBe(true)
    expect(asked).toBe(1)
    expect(scrolled).toHaveLength(1)
    expect(scrolled[0]?.top).toBe(0)

    // The inactive slot is untouched: its click must reach the router.
    const inactive = clickCancelable(screen.getByTestId('anchor-activity'))
    expect(inactive.defaultPrevented).toBe(false)
    expect(scrolled).toHaveLength(1)
  })

  /**
   * §2.2 — three rows is a menu that pops out of the tab. The `Drawer` assertion is the regression
   * guard: a full-viewport sheet for three rows is exactly the behaviour being deleted.
   */
  test('3. a 3-destination group slot opens a menu and NEVER a drawer', async () => {
    renderBar([
      {
        label: 'Reports',
        mobile: { tab: true },
        items: [item('daily'), item('weekly'), item('monthly')],
      },
      { label: 'Main', items: [item('home')] },
    ])

    expect(menu()).toBeNull()
    fireEvent.click(screen.getByLabelText('Reports'))

    await waitFor(() => expect(menu()).not.toBeNull())
    expect(document.querySelectorAll('.mantine-Menu-item')).toHaveLength(3)
    expect(drawer()).toBeNull()
  })

  /** Past `menuMax` the surface flips — the sheet is not deleted, it is confined to the case a
   *  content-sized menu genuinely cannot hold. */
  test('4. a 9-destination group slot opens the bottom sheet', async () => {
    renderBar([
      {
        label: 'Reports',
        mobile: { tab: true },
        items: Array.from({ length: 9 }, (_, i) => item(`row${i + 1}`)),
      },
      { label: 'Main', items: [item('home')] },
    ])

    fireEvent.click(screen.getByLabelText('Reports'))

    await waitFor(() => expect(drawer()).not.toBeNull())
    expect(menu()).toBeNull()
  })

  /** The trigger is a disclosure: the same tap that opened it closes it. */
  test('5. a second tap on the same slot closes the menu', async () => {
    renderBar([
      { label: 'Reports', mobile: { tab: true }, items: [item('daily'), item('weekly')] },
      { label: 'Main', items: [item('home')] },
    ])

    const trigger = screen.getByLabelText('Reports')
    fireEvent.click(trigger)
    await waitFor(() => expect(menu()).not.toBeNull())

    fireEvent.click(trigger)
    await waitForGone('menu')
  })

  /** §2.9 — `closeOnEscape` + `returnFocus` are Mantine props, but "the tab you came from gets
   *  focus back" is the behaviour a keyboard user feels, so it is asserted, not assumed. */
  test('6. Escape closes the menu and returns focus to the slot trigger', async () => {
    renderBar([
      { label: 'Reports', mobile: { tab: true }, items: [item('daily'), item('weekly')] },
      { label: 'Main', items: [item('home')] },
    ])

    const trigger = screen.getByLabelText('Reports')
    // A keyboard user reaches the tab before activating it — and `useFocusReturn` records whatever
    // held focus when the dropdown opened, so this is what makes the return target meaningful.
    trigger.focus()
    fireEvent.click(trigger)
    await waitFor(() => expect(menu()).not.toBeNull())

    const dropdown = menu()
    if (!dropdown) throw new Error('unreachable')
    fireEvent.keyDown(dropdown, { key: 'Escape' })

    await waitForGone('menu')
    await waitFor(() => {
      if (document.activeElement !== trigger) throw new Error('focus did not return to the trigger')
    })
  })

  /** §2.9 — a disabled destination still renders (rule 11), so it must announce itself as
   *  disabled rather than just look dimmed. */
  test('7. a disabled row carries data-disabled and aria-disabled', async () => {
    renderBar([
      {
        label: 'Reports',
        mobile: { tab: true },
        items: [item('daily'), item('weekly', { disabled: true })],
      },
      { label: 'Main', items: [item('home')] },
    ])

    fireEvent.click(screen.getByLabelText('Reports'))
    await waitFor(() => expect(menu()).not.toBeNull())

    const rows = Array.from(document.querySelectorAll('.mantine-Menu-item'))
    const disabled = rows.find((row) => row.textContent?.includes('Weekly'))
    expect(disabled).toBeTruthy()
    expect(disabled?.getAttribute('data-disabled')).toBe('true')
    expect(disabled?.getAttribute('aria-disabled')).toBe('true')

    const enabled = rows.find((row) => row.textContent?.includes('Daily'))
    expect(enabled?.hasAttribute('data-disabled')).toBe(false)
    expect(enabled?.hasAttribute('aria-disabled')).toBe(false)
  })

  /** §2.9 — the landmark and the current-page marker: the two things a screen reader needs to
   *  describe the bar at all. */
  test('8. the bar is a Primary nav landmark and the active slot is aria-current="page"', () => {
    const { container } = renderBar([
      {
        label: 'Main',
        items: [
          item('home', { mobile: 'tab', active: true, Anchor: testAnchor('anchor-home') }),
          item('activity', { mobile: 'tab', Anchor: testAnchor('anchor-activity') }),
        ],
      },
    ])

    const bar = container.querySelector('nav')
    expect(bar).not.toBeNull()
    expect(bar?.getAttribute('aria-label')).toBe('Primary')

    expect(screen.getByTestId('anchor-home').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('anchor-activity').hasAttribute('aria-current')).toBe(false)
  })

  /**
   * §2.9 again, and the half that "looks disabled" hides: a disabled row must be DEAD, not dim.
   * Mantine's `Menu.css` gives `[data-disabled]` a muted color and nothing else, the row is
   * polymorphic (`component="a"`) so the native `disabled` attribute never applies, and
   * `MenuItem` composes the CALLER's `onClick` BEFORE its own `data-disabled` check — so with no
   * guard the consumer's navigation handler fires on a destination the projection rendered dead.
   * The module's `pointer-events: none` covers pointers; this covers everything else.
   */
  test('9. a disabled menu row does not fire its onClick, while its enabled sibling does', async () => {
    let disabledFired = 0
    let enabledFired = 0
    renderBar([
      {
        label: 'Reports',
        mobile: { tab: true },
        items: [
          item('daily', {
            onClick: () => {
              enabledFired += 1
            },
          }),
          item('weekly', {
            disabled: true,
            onClick: () => {
              disabledFired += 1
            },
          }),
        ],
      },
      { label: 'Main', items: [item('home')] },
    ])

    fireEvent.click(screen.getByLabelText('Reports'))
    await waitFor(() => expect(menu()).not.toBeNull())

    const menuRows = Array.from(document.querySelectorAll('.mantine-Menu-item'))
    const disabled = menuRows.find((row) => row.textContent?.includes('Weekly'))
    const enabled = menuRows.find((row) => row.textContent?.includes('Daily'))
    if (!disabled || !enabled) throw new Error('both rows must render — rule 11 keeps them both')

    fireEvent.click(disabled)
    expect(disabledFired).toBe(0)

    // The negative assertion above is only meaningful if the same click path works at all.
    fireEvent.click(enabled)
    expect(enabledFired).toBe(1)
  })

  /**
   * A separator separates. A More slot raised purely by the account/settings rows has no
   * destinations above the divider, so an unguarded one renders as the dropdown's FIRST child —
   * a rule hanging under the top edge with nothing on the other side of it.
   */
  test('10. the More divider never renders as the dropdown first child', async () => {
    const model = projectMobileNav(
      [
        {
          label: 'Main',
          items: [item('home', { mobile: 'tab' }), item('activity', { mobile: 'tab' })],
        },
      ],
      { extraMoreRows: 1 },
    )
    render(
      <MantineProvider>
        <MobileNav
          model={model}
          settingsMenuItems={[{ key: 'theme', label: 'Theme', onClick: () => {} }]}
        />
      </MantineProvider>,
    )

    fireEvent.click(screen.getByLabelText('More'))
    await waitFor(() => expect(menu()).not.toBeNull())

    const dropdown = menu()
    if (!dropdown) throw new Error('unreachable')
    expect(dropdown.querySelectorAll('.mantine-Menu-divider')).toHaveLength(0)
    expect(dropdown.querySelectorAll('.mantine-Menu-item')).toHaveLength(1)
  })

  /**
   * Regression guard for the mobile-sheet-content-height fix. Neither half is pixel-assertable
   * under happy-dom (no layout, and CSS-module class hashes are unavailable under `bun test` per
   * the file header) — so this pins the two DOM-observable facts instead: the sheet is no longer
   * wired through the dead `size="auto"` → `--drawer-size-auto` custom property (see `.sheet` in
   * the CSS module for why that was never wired to anything), and the redundant grabber is gone
   * now that the header's own close button is the sheet's sole dismiss affordance.
   */
  test('11. the sheet drops the no-op size prop and the redundant grabber', async () => {
    renderBar([
      {
        label: 'Reports',
        mobile: { tab: true },
        items: Array.from({ length: 9 }, (_, i) => item(`row${i + 1}`)),
      },
      { label: 'Main', items: [item('home')] },
    ])

    fireEvent.click(screen.getByLabelText('Reports'))
    await waitFor(() => expect(drawer()).not.toBeNull())

    // `size="auto"` resolves to `var(--drawer-size-auto)`, a custom property @mantine/core defines
    // nowhere — its presence anywhere in the tree would be the old bug reappearing.
    expect(document.querySelector('[style*="drawer-size-auto"]')).toBeNull()

    // The header (title + Mantine's own close button) is the ONLY dismiss affordance now — the
    // grabber div that used to precede the scroll area is gone, so the body wraps exactly the
    // `ScrollArea.Autosize` root and nothing else.
    const header = document.querySelector('.mantine-Drawer-header')
    expect(header).not.toBeNull()
    expect(header?.querySelector('.mantine-Drawer-close')).not.toBeNull()
    expect(document.querySelector('.mantine-Drawer-body')?.children).toHaveLength(1)
  })
})
