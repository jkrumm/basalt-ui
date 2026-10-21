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
 * **Anatomy.** A facet pill reads `Label  Value`: the facet's name muted (`--vx-muted`), the selection
 * bright (`--vx-ink`) — two spans inside the one Button label, so a reader finds the value without
 * parsing a sentence. `value` is the SELECTION and its presence IS the anatomy; an unset facet
 * (`unset`) renders its one text muted, since it names a filter that is not filtering. A pill with
 * neither (`ToggleFilter`, `RangeFilter`, `NumberFilter`, the `+N` fold, `Filters (n)`) keeps its
 * single label exactly as before.
 *
 * Two modes, one component: with `children` the pill is a `Popover` target (every enum-ish filter);
 * with only `onClick` it is a plain button that acts on press (`ToggleFilter`, the `+N` fold's
 * sibling, the `Filters (n)` sheet opener).
 */
import { Button, Popover } from '@mantine/core'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import { IconSlot } from '../theme/icon-slot'
import classes from './controls.module.css'
import { UpDownGlyph } from './glyphs'

export type FilterPillProps = BasaltProps & {
  readonly label: string
  /** The selected value. Present ⇒ the two-span anatomy: `label` muted, `value` ink. */
  readonly value?: string
  /** Nothing selected: the single `label` text reads muted. Ignored when `value` is set. */
  readonly unset?: boolean
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
  /** Inert: the pill cannot be pressed, so its popover never opens. */
  readonly disabled?: boolean
  /** Set by `FilterSet` on its own fold/sheet pills; a filter never passes either of these. */
  readonly hideGlyph?: boolean
  /** `data-shown` — the CSS hook that reveals the `+N` fold pill once folding is needed. */
  readonly shown?: boolean
}

export function FilterPill({
  label,
  value,
  unset,
  icon,
  active,
  numeric,
  children,
  onClick,
  ariaLabel,
  pressed,
  disabled,
  className,
  style,
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
      className={cx(classes.pill, className)}
      data-basalt-hit
      // The label truncates past the pill's width cap; the full name stays one hover away.
      title={value === undefined ? label : `${label} ${value}`}
      classNames={{ label: classes.pillLabel }}
      {...(style !== undefined && { style })}
      {...(active === true && { 'data-active': true })}
      {...(numeric === true && { 'data-numeric': true })}
      {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
      {...(pressed !== undefined && children === undefined && { 'aria-pressed': pressed })}
      {...(shown === true && { 'data-shown': true })}
      {...(disabled === true && { disabled: true })}
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
      {value !== undefined ? (
        <>
          <span className={classes.pillName} data-pill-part="name">
            {label}
          </span>{' '}
          <span className={classes.pillValue} data-pill-part="value">
            {value}
          </span>
        </>
      ) : unset === true ? (
        <span className={classes.pillName} data-pill-part="name">
          {label}
        </span>
      ) : (
        label
      )}
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

/**
 * The popover's `Clear` — one button for `EnumFilter`, `NumberFilter` and `MultiSelectFilter`. Its
 * mousedown keeps focus where it is: a stepper commits its draft on blur, so a press that blurred
 * first would land the typed value in the URL a tick before the clear replaced it.
 */
export function FilterClearButton({ onClear }: { readonly onClear: () => void }): ReactNode {
  return (
    <Button
      variant="subtle"
      size="ctl"
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onClick={onClear}
    >
      Clear
    </Button>
  )
}
