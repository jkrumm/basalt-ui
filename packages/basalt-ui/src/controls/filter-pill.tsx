/**
 * `FilterPill` — the one chip every filter in the bar row renders (`docs/CONTROLS-SPEC.md` §3):
 * bordered, 30px, leading icon · label · trailing `⇅`. INTERNAL: it is not on the `./controls`
 * barrel, because a consumer reaching for it directly is hand-rolling a filter
 * (`basalt/hand-rolled-filter`) — the pill is what `RangeFilter`/`SelectFilter`/… ARE, not a
 * building block to assemble one from.
 *
 * The 30px box is `variant="default" size="ctl"` and nothing else — the tier comes from the theme's
 * `--button-height-ctl` var set (`docs/CONTROLS-SPEC.md` §5), so the pill is the same height whether
 * or not the home wrapped its slot in `CtlSlot`, and it tracks the density knob for free.
 *
 * Two modes, one component: with `children` the pill is a `Popover` target (every enum-ish filter);
 * with only `onClick` it is a plain button that acts on press (`ToggleFilter`, the `+N` fold's
 * sibling, the `Filters (n)` sheet opener).
 */
import { Button, Popover } from '@mantine/core'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { IconSlot } from '../theme/icon-slot'
import classes from './controls.module.css'
import { UpDownGlyph } from './glyphs'

export type FilterPillProps = {
  readonly label: string
  readonly icon?: ReactNode
  /** Non-default → accent-tinted border. Derived from `field.isDefault(value)`, never hand-set. */
  readonly active?: boolean
  /** Mono label, for a numeric preset set (`7d` / `30d`) — the same law `[data-numeric]` applies
   *  to a numeric SegmentedControl label (`theme/segmented-control.module.css`). */
  readonly numeric?: boolean
  /** Popover body. Omit for a press-to-act pill. */
  readonly children?: ReactNode
  readonly onClick?: () => void
  /** Accessible name when the visible label is a bare count (`+2`). */
  readonly ariaLabel?: string
  /**
   * `aria-pressed` for the press-to-act mode (`ToggleFilter`) — without it the on/off state is
   * carried by a border colour and nothing else. Deliberately NOT set on a popover-target pill,
   * where `aria-expanded` (which Mantine's `Popover.Target` supplies) is the correct state.
   */
  readonly pressed?: boolean
  readonly className?: string
  /** Set by `FilterSet` on its own fold/sheet pills; a filter never passes either of these. */
  readonly hideGlyph?: boolean
  /** `data-shown` — the CSS hook that reveals the `+N` fold pill once folding is needed. */
  readonly shown?: boolean
}

export function FilterPill({
  label,
  icon,
  active,
  numeric,
  children,
  onClick,
  ariaLabel,
  pressed,
  className,
  hideGlyph,
  shown,
}: FilterPillProps): ReactNode {
  // Mantine's `Popover` does not open on target click — it is a controlled surface, unlike `Menu`.
  // This is the only `useState` in the folder, and it holds an OVERLAY's open flag, not a filter's
  // value (C3 is about the value; a popover that survives a reload would be a bug, not a feature).
  const [opened, setOpened] = useState(false)

  const target = (
    <Button
      variant="default"
      size="ctl"
      className={className === undefined ? classes.pill : `${classes.pill} ${className}`}
      classNames={{ label: classes.pillLabel }}
      {...(active === true && { 'data-active': true })}
      {...(numeric === true && { 'data-numeric': true })}
      {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
      {...(pressed !== undefined && children === undefined && { 'aria-pressed': pressed })}
      {...(shown === true && { 'data-shown': true })}
      {...(icon !== undefined && {
        // `IconSlot` owns the 16px box and the optical centring; `.pillIcon` adds only the pill's
        // muted-then-ink colour law. A consumer's glyph can no longer set this row's height.
        leftSection: <IconSlot className={classes.pillIcon}>{icon}</IconSlot>,
      })}
      {...(hideGlyph !== true && {
        rightSection: (
          <IconSlot className={classes.glyph}>
            <UpDownGlyph />
          </IconSlot>
        ),
      })}
      onClick={
        onClick ??
        (() => {
          setOpened((current) => !current)
        })
      }
    >
      {label}
    </Button>
  )

  if (children === undefined) return target

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      onDismiss={() => {
        setOpened(false)
      }}
      position="bottom-start"
      withinPortal
      shadow="md"
      radius="sm"
      trapFocus
    >
      <Popover.Target>{target}</Popover.Target>
      <Popover.Dropdown className={classes.dropdown}>{children}</Popover.Dropdown>
    </Popover>
  )
}
