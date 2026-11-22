/**
 * The page bar's filter trigger: from three filters up a `FilterSet` in the page bar is one
 * `Filter` button with the active count, opening one popover of every filter, so the view row stays
 * one line. An enum draws as a chip set, a multi as a checkbox list, every other kind as its row
 * form. The footer says how many rows the filters keep (`Showing 21 of 50`, from `match`) and resets
 * them. Below the `@regular` container the same body opens in a sheet.
 */
import { useId } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { filters } from '../core/messages/filters'
import { useMessages } from '../core/messages/use-messages'
import { CountBadge } from '../ui/badge'
import { Button, buttonVariants } from '../ui/button'
import { Checkbox, CheckboxGroup } from '../ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet'
import { FoldedControls } from './control-home'
import { ControlView } from './control-view'
import { catalogueOf, withCurrentValue } from './filter-set-census'
import type { AnySpec } from './filter-set-census'

/** From this many filters the page bar folds them into one trigger; fewer stay pills. */
export const MENU_FROM = 3

/** Past this many options an enum is its select, not a chip set. */
const CHIPS_MAX = 12

export type Match = { shown: number; total: number }

type Census = { count: number; reset(): void }

/** The strings `FilterSet` already owns, handed in so each message keeps one home. */
export type MenuLabels = { title: string; name: string; reset: string }

const CHIP =
  'relative inline-flex h-6 cursor-pointer items-center rounded-ctrl border px-2 text-xs whitespace-nowrap focus-ring transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-full after:-translate-y-1/2 pointer-coarse:after:min-h-11 motion-reduce:transition-none'

/** The section name over a chip set or a checkbox list: small, uppercase, muted. */
function SectionLabel({ id, children }: { id: string; children: string }): ReactElement {
  return (
    <span id={id} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  )
}

function EnumChips({ spec }: { spec: AnySpec }): ReactElement {
  const id = useId()
  const [value, set] = spec.handle.use()
  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a group of toggle buttons, not a form fieldset
    <div role="group" aria-labelledby={id} data-slot="filter-chips" className="flex flex-col gap-2">
      <SectionLabel id={id}>{spec.label}</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {catalogueOf(spec).map((option) => {
          const on = option.value === value
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={on}
              className={cn(
                CHIP,
                on
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border text-foreground hover:bg-accent',
              )}
              onClick={() => {
                set(option.value)
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MultiChecks({ spec }: { spec: AnySpec }): ReactElement {
  const id = useId()
  const [value, set] = spec.handle.use()
  const held = Array.isArray(value) ? (value as readonly unknown[]).map(String) : []
  return (
    <div data-slot="filter-checks" className="flex flex-col gap-1">
      <SectionLabel id={id}>{spec.label}</SectionLabel>
      <CheckboxGroup
        aria-labelledby={id}
        className="gap-0 pointer-coarse:gap-0"
        value={held}
        onValueChange={(next) => {
          // An empty selection narrows nothing: it unsets the field rather than storing `[]`.
          if (next.length === 0) spec.handle.clear()
          else set(next)
        }}
      >
        {catalogueOf(spec).map((option) => (
          <label
            key={String(option.value)}
            className="flex min-h-7 cursor-pointer items-center gap-2 text-sm text-foreground pointer-coarse:min-h-11"
          >
            <Checkbox value={String(option.value)} />
            {option.label}
          </label>
        ))}
      </CheckboxGroup>
    </div>
  )
}

function Section({ spec }: { spec: AnySpec }): ReactElement {
  const [value] = spec.handle.use()
  // The catalogue also holds an applied value it lacks (a link, an archived option), so it shows.
  const shown = withCurrentValue(spec, value)
  const count = catalogueOf(shown).length
  if (spec.handle.kind === 'enum' && count > 0 && count <= CHIPS_MAX)
    return <EnumChips spec={shown} />
  if (spec.handle.kind === 'multi' && count > 0) return <MultiChecks spec={shown} />
  return <ControlView spec={shown} />
}

/** Every filter, then the match line and the reset: the popover's and the sheet's body alike. */
function MenuBody({
  specs,
  census,
  match,
  reset,
}: {
  specs: readonly AnySpec[]
  census: Census
  match: Match | undefined
  reset: string
}): ReactElement {
  const t = useMessages(filters)
  return (
    <FoldedControls>
      <div data-slot="filter-menu" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-4">
          {specs.map((spec) => (
            <Section key={spec.handle.key} spec={spec} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span
            data-slot="filter-match"
            aria-live="polite"
            className="text-xs text-muted-foreground tabular-nums"
          >
            {match === undefined ? null : t('filters.showing', match.shown, match.total)}
          </span>
          <button
            type="button"
            data-slot="filter-reset"
            disabled={census.count === 0}
            data-disabled={census.count === 0 ? '' : undefined}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            onClick={census.reset}
          >
            {reset}
          </button>
        </div>
      </div>
    </FoldedControls>
  )
}

function FunnelGlyph(): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 3.5h11L9.25 8.5v4l-2.5 1v-5z" />
    </svg>
  )
}

/** The trigger's face: the funnel, the word from `@regular` up, and the active count. */
function Face({ count }: { count: number }): ReactElement {
  const t = useMessages(filters)
  return (
    <>
      <FunnelGlyph />
      <span className="@max-regular:sr-only">{t('filters.filter')}</span>
      {count > 0 && <CountBadge count={count} aria-hidden="true" />}
    </>
  )
}

/**
 * One trigger for every filter of the page bar: a popover from `@regular` up, a sheet below it.
 * Both are in the server markup, swapped by a container query.
 */
export function FilterMenu({
  specs,
  census,
  match,
  labels,
}: {
  specs: readonly AnySpec[]
  census: Census
  match: Match | undefined
  labels: MenuLabels
}): ReactElement {
  const { title, name, reset } = labels
  return (
    <fieldset
      data-slot="filter-set"
      data-presentation="menu"
      aria-label={title}
      className="m-0 min-w-0 shrink-0 border-0 p-0"
    >
      <div className="hidden @regular:block">
        <Popover>
          <PopoverTrigger
            render={<Button variant="secondary" data-filter-trigger="" aria-label={name} />}
          >
            <Face count={census.count} />
          </PopoverTrigger>
          <PopoverContent aria-label={title} align="end" className="w-84 max-w-[90vw]">
            <MenuBody specs={specs} census={census} match={match} reset={reset} />
          </PopoverContent>
        </Popover>
      </div>
      <div className="@regular:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="secondary"
                shape="icon"
                data-filter-trigger=""
                aria-label={name}
                className="w-auto px-2"
              />
            }
          >
            <Face count={census.count} />
          </SheetTrigger>
          <SheetContent title={title}>
            <MenuBody specs={specs} census={census} match={match} reset={reset} />
          </SheetContent>
        </Sheet>
      </div>
    </fieldset>
  )
}
