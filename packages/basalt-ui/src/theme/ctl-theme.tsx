/**
 * The `size="ctl"` slot theme (`docs/CONTROLS-SPEC.md` §5) — every home (`PageBar`, `Section`,
 * table toolbar, sidebar blocks, wave 3/4) wraps its **slot**, never its body, in `<CtlSlot>` so a
 * raw `Button`/`ActionIcon`/`Input`/… dropped into that slot renders at the `ctl` tier with NO prop
 * at the call site — a `size="xs"` typed there is C5 (`basalt/control-size-literal`).
 *
 * `CTL_THEME.components[*].defaultProps.size = 'ctl'` only sets the DEFAULT — an explicit
 * `size="md"` (or anything else) at the call site still wins, same override precedence as every
 * other Mantine `defaultProps`. Mantine's own `mergeMantineTheme` DEEP-merges `components` (not a
 * shallow replace), so nesting `<CtlSlot>` under `BasaltProvider` never drops the base theme's
 * `Button.extend`/`ActionIcon.extend`/… `vars`/`classNames` (the shadow/depth idiom,
 * `docs/DESIGN-SPEC.md` §5) — only `defaultProps.size` is added on top.
 *
 * `Menu` is deliberately absent — verified against the installed `@mantine/core` 9.3.0 source
 * (`Menu.d.ts`, `MenuItem.d.ts`): neither accepts a `size` prop at all, so "Menu/Menu.Item where
 * applicable" (the spec's own hedge) resolves to "not applicable" here.
 */
import {
  ActionIcon,
  Box,
  Button,
  Input,
  MantineThemeProvider,
  MultiSelect,
  NativeSelect,
  SegmentedControl,
  Select,
  TextInput,
} from '@mantine/core'
import type { MantineThemeOverride } from '@mantine/core'
import type { ReactNode } from 'react'

/** The `MantineThemeOverride` a `<CtlSlot>` provides — see this module's doc for the merge/
 * precedence contract. Exported so a consumer composing its own slot (a bespoke home not covered
 * by `PageBar`/`Section`/the sidebar blocks) can reach the SAME tier without re-declaring it. */
export const CTL_THEME: MantineThemeOverride = {
  components: {
    Button: Button.extend({ defaultProps: { size: 'ctl' } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { size: 'ctl' } }),
    Input: Input.extend({ defaultProps: { size: 'ctl' } }),
    TextInput: TextInput.extend({ defaultProps: { size: 'ctl' } }),
    Select: Select.extend({ defaultProps: { size: 'ctl' } }),
    MultiSelect: MultiSelect.extend({ defaultProps: { size: 'ctl' } }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { size: 'ctl' } }),
    NativeSelect: NativeSelect.extend({ defaultProps: { size: 'ctl' } }),
  },
}

export type CtlSlotProps = {
  children: ReactNode
}

/**
 * Wrap a home's SLOT (never its body) to render every Mantine control inside it at the `ctl` tier.
 * The marker is a Mantine `Box` (not a raw `<div>` — `basalt/raw-html-layout` flags inline
 * layout/surface styling on a bare HTML tag), `display: contents` keeps it out of the slot's own
 * flex/grid layout while leaving the `data-basalt-tier="ctl"` attribute queryable/testable
 * (`docs/CONTROLS-SPEC.md` §5) without the wrapper participating in flow.
 */
export function CtlSlot({ children }: CtlSlotProps): ReactNode {
  return (
    <MantineThemeProvider inherit theme={CTL_THEME}>
      <Box data-basalt-tier="ctl" style={{ display: 'contents' }}>
        {children}
      </Box>
    </MantineThemeProvider>
  )
}
