/**
 * `ControlGroup` — adjacent controls that act on ONE thing, joined into one box
 * (`docs/CONTROLS-SPEC.md` §3). Blueprint's `ControlGroup` and Mantine's own `Button.Group` are the
 * same primitive; neither works here, because basalt's tier holds `FilterPill`s, `Button`s,
 * `ActionIcon`s and `TextInput`s in the same row and Mantine's `Button.Group` joins Buttons only
 * (it declares its own `section-*` size vars, which the `ctl` tier does not define — see
 * `theme/ctl-tier-coverage.test.ts`'s note on why `*Group` directories are excluded from the scan).
 *
 * **What it is for.** A `‹ Today ›` date stepper, a `− 1 +` quantity, an `Absolute | Rate` pair — a
 * set of controls a reader should read as ONE control with several affordances. The joined box is the
 * statement: these three act on the same value, and the two dividers inside it are the only place a
 * hairline is a divider rather than a border (`docs/DESIGN-SPEC.md` §8 — depth is a shadow). A row of
 * INDEPENDENT actions is not this; that is `ActionGroup`, and joining it would claim a relationship
 * that is not there.
 *
 * **Presentational by design — no `role`, no `aria-label`.** A joined LOOK is not a semantic group:
 * each child is already a button or an input with its own accessible name, and wrapping them in a
 * `role="group"` adds a level to the a11y tree that announces nothing a reader needs. Where the set
 * genuinely IS one control with one name — a range picker, a tab set — basalt already ships that
 * control (`RangeFilter`, `ViewTabs`) with the right semantics, and reaching for `ControlGroup`
 * instead is `basalt/hand-rolled-filter`.
 *
 * @example
 * // The one shape this exists for: three affordances, one value.
 * <ControlGroup>
 *   <ActionIcon variant="default" aria-label="Previous period" onClick={back}><IconLeft /></ActionIcon>
 *   <Button variant="default" onClick={today}>Today</Button>
 *   <ActionIcon variant="default" aria-label="Next period" onClick={next}><IconRight /></ActionIcon>
 * </ControlGroup>
 */
import { Box } from '@mantine/core'
import type { ReactNode } from 'react'
import classes from './controls.module.css'

export type ControlGroupProps = {
  readonly children: ReactNode
  /**
   * `none` (the default) JOINS the children: no gap, one shared hairline between each pair, and the
   * corner radius only on the outer ends, so the set reads as one box.
   *
   * `tight` keeps the tier's own control gap and only guarantees the alignment and the no-wrap. It
   * is for a set that belongs together but must stay separately pressable — three destructive
   * actions, or a pair where one child is `filled` and joining it would put a fill edge against a
   * border edge.
   *
   * @default 'none'
   */
  readonly gap?: 'none' | 'tight'
  readonly className?: string
}

export function ControlGroup({ children, gap = 'none', className }: ControlGroupProps): ReactNode {
  return (
    // A Mantine `Box`, not a raw `<div>` — `basalt/raw-html-layout` flags layout styling on a bare
    // HTML tag, the same reason `CtlSlot` uses one.
    <Box
      className={className === undefined ? classes.group : `${classes.group} ${className}`}
      data-gap={gap}
    >
      {children}
    </Box>
  )
}
