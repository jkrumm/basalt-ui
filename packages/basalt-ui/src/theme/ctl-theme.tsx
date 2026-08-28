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
 *
 * **Radio / Checkbox / Switch and their `.Group`s, and the one consequence worth stating.** These
 * three default to Mantine's `sm` — a 20px indicator beside the tier's 13.5px option label — which
 * is what every filter popover and the mobile sheet rendered. They are here rather than fixed in a
 * CSS module because their geometry is a Mantine SIZE (five vars for a Switch alone), so the tier
 * reaches them the same way it reaches Button and Input: through `-ctl` vars in
 * `cssVariablesResolver`. The `.Group`s are listed too, so the group's `Input.Wrapper` label lands
 * on the tier's font step as well.
 *
 * The consequence: Mantine resolves a Radio's size as `props.size ? props.size : ctx.size`
 * (`Radio.mjs`), and a theme `defaultProps.size` is indistinguishable from an explicit prop to that
 * check — so inside a `<CtlSlot>` a `<Radio.Group size="lg">` no longer sizes its children, they stay
 * `ctl`. That is the correct trade in a home's SLOT (the whole contract there is "everything is the
 * tier"), and it is stated here because it is the kind of thing that otherwise gets rediscovered as
 * a bug. A consumer wanting a `lg` radio group puts it in a BODY, which no `CtlSlot` wraps.
 */
import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Input,
  MantineThemeProvider,
  MultiSelect,
  NativeSelect,
  Radio,
  SegmentedControl,
  Select,
  Switch,
  TextInput,
} from '@mantine/core'
import type { MantineSize, MantineThemeOverride } from '@mantine/core'
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
    // The theme keys are the component names Mantine's own `useProps` looks up — `RadioGroup`, not
    // `Radio.Group` (`RadioGroup.mjs`: `useProps("RadioGroup", …)`).
    Radio: Radio.extend({ defaultProps: { size: 'ctl' } }),
    // Mantine types `RadioGroup.size` as a CLOSED `MantineSize`, while `Radio`, `Checkbox`,
    // `Checkbox.Group`, `Switch` and `Switch.Group` all type theirs OPEN
    // (`MantineSize | (string & {})`) — verified in the installed 9.3.0 `.d.ts` files, so this is an
    // upstream inconsistency, not a statement that `RadioGroup` cannot take a custom tier. At
    // runtime `getSize` interpolates the string identically for all six. The cast restores what
    // every sibling type already allows; it widens nothing.
    RadioGroup: Radio.Group.extend({ defaultProps: { size: 'ctl' as MantineSize } }),
    Checkbox: Checkbox.extend({ defaultProps: { size: 'ctl' } }),
    CheckboxGroup: Checkbox.Group.extend({ defaultProps: { size: 'ctl' } }),
    Switch: Switch.extend({ defaultProps: { size: 'ctl' } }),
    SwitchGroup: Switch.Group.extend({ defaultProps: { size: 'ctl' } }),
  },
}

/**
 * **`Slider` is deliberately NOT here, and `--slider-size-ctl` still is** (`theme/index.ts`). The
 * tier's var set is what the size means, and `controls/slider-control.tsx` states `size="ctl"`
 * itself the way every control on `./controls` does. Putting it in this map instead would widen
 * `basalt/control-size-literal` — the rule is scoped to `CTL_THEME_TAGS`, ships at `error`, and a
 * widened `error` rule lands its new form with no grace period at all (C16, `docs/CONTROLS-SPEC.md`
 * §6). A `Slider` a consumer sizes by hand in a slot therefore keeps working; the one basalt draws
 * is on the tier because it says so.
 */

/**
 * The `tier="widget"` slot theme — ActionIcon-ONLY, at the 24px `size="icon"` step
 * (`--ai-size-icon` → `--vx-space-control-height-widget`, `docs/CONTROLS-SPEC.md` §5).
 *
 * It exists because a `WidgetHeader tier="widget"` header row is 28px
 * (`--vx-space-widget-header-height`) and a 30px `ctl` control does not fit inside it. `StatCard`
 * wrapped its `actions` slot in a plain `<CtlSlot>`, so a card WITH a kebab measured a 30px title
 * row and a card WITHOUT one measured 28 — two KPI cards side by side in the same grid row were
 * 2px out of alignment, and every number under them with it. Measured on the playground's dashboard
 * at 390px: `Total sales` at 164 against `Orders` at 162.
 *
 * The tier is a HEIGHT statement, so a slot can only fix it by owning the size — which is exactly
 * what {@link controlHeightWidget}'s own doc already said this step was for ("the `size="icon"`
 * ActionIcon height — `WidgetHeader tier="widget"` actions"). It is ActionIcon-only because the
 * tier has one var (`--ai-size-icon`): a 24px Button or Input has no vars declared and would
 * silently resolve to its initial value, which is why widening this set is a
 * `theme/index.ts`-first change, never a line added here.
 */
const WIDGET_THEME: MantineThemeOverride = {
  components: {
    ActionIcon: ActionIcon.extend({ defaultProps: { size: 'icon' } }),
  },
}

export type CtlSlotProps = {
  children: ReactNode
  /**
   * Which tier the slot imposes. `ctl` (the default) is the 30px control tier every home's control
   * row uses. `widget` is the 24px ActionIcon step a `WidgetHeader tier="widget"` header row can
   * hold — see {@link WIDGET_THEME} for the misalignment that makes it a separate tier rather than
   * a caller's `size` prop.
   *
   * The values are the TIER names, matching the `data-basalt-tier` attribute the slot emits and the
   * one `ChartCard` already writes by hand (it lives inside the Mantine-free `charts/` boundary and
   * so cannot mount this component). `widget` maps to Mantine's `size="icon"`; the two vocabularies
   * differ and that is upstream's, not basalt's.
   *
   * @default 'ctl'
   */
  tier?: 'ctl' | 'widget'
}

/**
 * Wrap a home's SLOT (never its body) to render every Mantine control inside it at the `ctl` tier.
 * The marker is a Mantine `Box` (not a raw `<div>` — `basalt/raw-html-layout` flags inline
 * layout/surface styling on a bare HTML tag), `display: contents` keeps it out of the slot's own
 * flex/grid layout while leaving the `data-basalt-tier="ctl"` attribute queryable/testable
 * (`docs/CONTROLS-SPEC.md` §5) without the wrapper participating in flow.
 */
export function CtlSlot({ children, tier = 'ctl' }: CtlSlotProps): ReactNode {
  return (
    <MantineThemeProvider inherit theme={tier === 'widget' ? WIDGET_THEME : CTL_THEME}>
      <Box data-basalt-tier={tier} style={{ display: 'contents' }}>
        {children}
      </Box>
    </MantineThemeProvider>
  )
}
