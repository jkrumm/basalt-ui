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
import { Button, MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
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
    ] as const
    for (const name of names) {
      expect(CTL_THEME.components?.[name]?.defaultProps?.['size']).toBe('ctl')
    }
  })
})
