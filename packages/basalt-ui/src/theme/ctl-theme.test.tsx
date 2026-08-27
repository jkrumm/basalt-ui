/**
 * `CtlSlot`/`CTL_THEME` — proves the `size="ctl"` default reaches a bare `<Button>` dropped into
 * the slot with NO prop at the call site, and that the tier stays scoped to the slot (a sibling
 * `<Button>` outside `<CtlSlot>` never resolves the `-ctl` var).
 *
 * `data-size`/the inline `style` custom-property string are Mantine's own render output — verified
 * directly against a real render (`@testing-library/react`, `tests/setup/dom.ts`'s jsdom harness),
 * not asserted from memory. jsdom does not compute the CSS cascade, so this can only prove the
 * INLINE var REFERENCE Mantine's `varsResolver` emits (`--button-height: var(--button-height-ctl)`)
 * — not the resolved pixel value, which is `cssVariablesResolver`'s and `spaceDecls`'s job
 * (covered by `spacing.test.ts`/`density.test.ts`).
 *
 * Outside `<CtlSlot>`, `<Button>` resolves to Mantine's own native default, NOT basalt's `md` —
 * verified against `theme/index.ts`'s `Button.extend`: unlike Input/TextInput/NumberInput/
 * PasswordInput/Select/Textarea, basalt sets no `defaultProps.size` for Button/ActionIcon at all,
 * so an un-sized Button carries no `data-size` attribute and no `--button-height` inline var
 * (Mantine's own CSS stylesheet default takes over). The test below asserts the accurate,
 * verified claim — the tier does not leak past the slot — rather than a `size="md"` claim Button
 * was never given.
 */
import { ActionIcon, Button, Checkbox, MantineProvider, Radio, Switch } from '@mantine/core'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { FilterPill } from '../controls/filter-pill'
import { StatCard } from '../dashboard/stat-card'
import { baseTheme } from './index'
import { CTL_THEME, CtlSlot } from './ctl-theme'

describe('CtlSlot', () => {
  test('a bare Button inside CtlSlot resolves the ctl tier with no size prop', () => {
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <CtlSlot>
          <Button>Save</Button>
        </CtlSlot>
      </MantineProvider>,
    )
    const button = container.querySelector('button')
    expect(button?.getAttribute('data-size')).toBe('ctl')
    expect(button?.style.getPropertyValue('--button-height')).toBe('var(--button-height-ctl)')
    expect(button?.style.getPropertyValue('--button-padding-x')).toBe('var(--button-padding-x-ctl)')
  })

  test('the wrapper carries the data-basalt-tier marker and stays out of flow', () => {
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <CtlSlot>
          <Button>Save</Button>
        </CtlSlot>
      </MantineProvider>,
    )
    const wrapper = container.querySelector('[data-basalt-tier]')
    expect(wrapper?.getAttribute('data-basalt-tier')).toBe('ctl')
    expect((wrapper as HTMLElement | null)?.style.display).toBe('contents')
  })

  test('a Button outside CtlSlot never resolves the ctl tier', () => {
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <Button>Save</Button>
      </MantineProvider>,
    )
    const button = container.querySelector('button')
    expect(button?.getAttribute('data-size')).not.toBe('ctl')
    expect(button?.style.getPropertyValue('--button-height')).not.toBe('var(--button-height-ctl)')
  })

  test('CTL_THEME sets defaultProps.size "ctl" for every documented component', () => {
    const names = [
      'Button',
      'ActionIcon',
      'Input',
      'TextInput',
      'Select',
      'MultiSelect',
      'SegmentedControl',
      'NativeSelect',
      'Radio',
      'RadioGroup',
      'Checkbox',
      'CheckboxGroup',
      'Switch',
      'SwitchGroup',
    ] as const
    for (const name of names) {
      expect(CTL_THEME.components?.[name]?.defaultProps?.['size']).toBe('ctl')
    }
  })
})

/**
 * Radio/Checkbox/Switch at the tier, and the portal question that had to be settled before the
 * defaults could be trusted: a filter's popover body and the mobile sheet are rendered
 * `withinPortal`, so they are NOT DOM descendants of the `<CtlSlot>` wrapper — but a React portal
 * preserves the React tree, and `MantineThemeProvider` is React context. So the tier DOES reach them,
 * and no second `CtlSlot` inside `Popover.Dropdown`/`Drawer` is needed. These tests are what makes
 * that a checked fact rather than a reasoned one.
 */
describe('the toggle family at the ctl tier', () => {
  test('a bare Radio inside CtlSlot resolves the ctl indicator box', () => {
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <CtlSlot>
          <Radio value="a" label="Previous period" />
        </CtlSlot>
      </MantineProvider>,
    )
    const root = container.querySelector('.mantine-Radio-root')
    expect(root?.getAttribute('style')).toContain('--radio-size: var(--radio-size-ctl)')
    expect(root?.getAttribute('style')).toContain('--radio-icon-size: var(--radio-icon-size-ctl)')
  })

  test('a bare Checkbox inside CtlSlot resolves the ctl indicator box', () => {
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <CtlSlot>
          <Checkbox value="a" label="Web" />
        </CtlSlot>
      </MantineProvider>,
    )
    expect(container.querySelector('.mantine-Checkbox-root')?.getAttribute('style')).toContain(
      '--checkbox-size: var(--checkbox-size-ctl)',
    )
  })

  test('a bare Switch inside CtlSlot resolves all five of its ctl vars', () => {
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <CtlSlot>
          <Switch label="Errors only" />
        </CtlSlot>
      </MantineProvider>,
    )
    const style = container.querySelector('.mantine-Switch-root')?.getAttribute('style') ?? ''
    for (const prefix of [
      'switch-height',
      'switch-width',
      'switch-thumb-size',
      'switch-label-font-size',
      'switch-track-label-padding',
    ]) {
      expect(style).toContain(`--${prefix}: var(--${prefix}-ctl)`)
    }
  })

  test('a Radio outside CtlSlot keeps Mantine’s own default — the tier does not leak', () => {
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <Radio value="a" label="Previous period" />
      </MantineProvider>,
    )
    expect(
      container.querySelector('.mantine-Radio-root')?.getAttribute('style') ?? '',
    ).not.toContain('var(--radio-size-ctl)')
  })

  test('a PORTALED popover body inherits the tier — React context crosses a portal', async () => {
    render(
      <MantineProvider theme={baseTheme}>
        <CtlSlot>
          <FilterPill label="No comparison">
            <Radio.Group value="previous">
              <Radio value="previous" label="Previous period" />
            </Radio.Group>
          </FilterPill>
        </CtlSlot>
      </MantineProvider>,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'No comparison' }))
    })
    // The dropdown is a portal at document.body — deliberately queried off `document`, not the
    // render container, because being outside the container is the whole point of the test.
    const root = document.querySelector('.mantine-Popover-dropdown .mantine-Radio-root')
    expect(root).not.toBeNull()
    expect(root?.getAttribute('style')).toContain('--radio-size: var(--radio-size-ctl)')
  })
})

/**
 * `tier="widget"` — the 24px ActionIcon step a `WidgetHeader tier="widget"` header row can hold.
 *
 * The bug: `StatCard` wrapped its `actions` slot in a plain `<CtlSlot>`, so a bare `ActionIcon`
 * resolved to the 30px `ctl` tier inside a 28px header row (`--vx-space-widget-header-height`) and
 * grew it to 30. Measured in Chrome on the playground's dashboard at 390px, two KPI cards in the
 * same grid row: the one WITH a kebab put its hero value at y=164, the one without at y=162 — the
 * whole card, and every number in it, 2px out of line because of a slot's tier.
 */
describe('CtlSlot tier="widget"', () => {
  test('a bare ActionIcon resolves the 24px icon step, not the 30px ctl one', () => {
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <CtlSlot tier="widget">
          <ActionIcon variant="subtle" aria-label="Card actions">
            <span />
          </ActionIcon>
        </CtlSlot>
      </MantineProvider>,
    )
    const button = container.querySelector('button')
    expect(button?.getAttribute('data-size')).toBe('icon')
    // `--ai-size-icon` reads `--vx-space-control-height-widget` (24px) in `ctlSizeVars()`, so the
    // tier tracks the density knob like every other control height.
    expect(button?.style.getPropertyValue('--ai-size')).toBe('var(--ai-size-icon)')
  })

  test('the marker is the TIER name, the same one ChartCard writes by hand', () => {
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <CtlSlot tier="widget">
          <span />
        </CtlSlot>
      </MantineProvider>,
    )
    expect(container.querySelector('[data-basalt-tier]')?.getAttribute('data-basalt-tier')).toBe(
      'widget',
    )
  })

  test('the default is still `ctl` — no call site had to change', () => {
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <CtlSlot>
          <ActionIcon variant="subtle" aria-label="Sync">
            <span />
          </ActionIcon>
        </CtlSlot>
      </MantineProvider>,
    )
    expect(container.querySelector('button')?.getAttribute('data-size')).toBe('ctl')
    expect(container.querySelector('[data-basalt-tier]')?.getAttribute('data-basalt-tier')).toBe(
      'ctl',
    )
  })

  test('the widget tier is ActionIcon-only — a Button in it keeps whatever it had', () => {
    // Only `--ai-size-icon` exists at this step (`theme/index.ts`'s `ctlSizeVars`). Defaulting a
    // Button to `size="icon"` would resolve `--button-height: var(--button-height-icon)` to nothing
    // and paint a zero-height button — the exact `-xs`-var failure `ctlSizeVars`' doc records.
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <CtlSlot tier="widget">
          <Button>Save</Button>
        </CtlSlot>
      </MantineProvider>,
    )
    expect(container.querySelector('button')?.getAttribute('data-size')).not.toBe('icon')
  })
})

/**
 * `StatCard`'s own slot — the regression guard on the call site, not just on the mechanism. A
 * `<CtlSlot>` here (the default tier) is what shipped, and nothing else in the suite would have
 * caught it.
 */
describe('StatCard mounts its actions slot at the widget tier', () => {
  test('a raw ActionIcon in `actions` lands on the 24px step', () => {
    const { container } = render(
      <MantineProvider theme={baseTheme}>
        <StatCard
          title="Total sales"
          value="$1294.9k"
          actions={
            <ActionIcon variant="subtle" aria-label="Card actions">
              <span />
            </ActionIcon>
          }
        />
      </MantineProvider>,
    )
    const slot = container.querySelector('[data-basalt-tier]')
    expect(slot?.getAttribute('data-basalt-tier')).toBe('widget')
    expect(container.querySelector('button')?.getAttribute('data-size')).toBe('icon')
  })
})
