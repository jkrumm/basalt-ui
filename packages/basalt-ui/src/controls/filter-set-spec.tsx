/**
 * The data-driven `FilterSet`: one row of pills, a measured `+N` fold, and below the `@regular`
 * container a `Filters (n)` button that opens a sheet of row forms.
 *
 * - A pill prints the VALUE (also at its default), and is named by the filter (`Region: Europe`).
 * - It opens as a `row` form in a popover. A folded pill is that same row form inside the `+N`
 *   panel, never a pill inside a pill (a nested portal would read as an outside click).
 * - The swap between row and button is a container query, not a JS viewport: both are in the server
 *   markup, so hydration has nothing to reconcile.
 * - The count and `Reset all` come from the handles (`useCensus`), not from what is mounted.
 */
import { use, useRef } from 'react'
import type { ReactElement } from 'react'
import { useMessages } from '../core/messages/use-messages'
import { filters } from '../core/messages/filters'
import type { Translate } from '../core/messages/use-messages'
import { Button, buttonVariants } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet'
import type { ControlPresentation } from './contract'
import { FoldedControls } from './control-home'
import { ControlPresentationContext, ControlView } from './control-view'
import { isActive, isUnrestricted, useCensus, withCurrentValue } from './filter-set-census'
import type { AnySpec } from './filter-set-census'
import { useFold } from './filter-set-fold'
import { describeValue } from './renderers'

type T = Translate<typeof filters>

/** The text a pill prints for `value`: the value itself, the filter's name when there is none. */
function pillText(spec: AnySpec, value: unknown, t: T): string {
  const empty = spec.placeholder ?? spec.label
  switch (spec.handle.kind) {
    case 'boolean':
      return `${spec.label}: ${value === true ? t('filters.on') : t('filters.off')}`
    case 'multi': {
      if (isUnrestricted(spec, value)) return empty
      const held = value as readonly unknown[]
      return held.length === 1 ? describeValue(spec, held) : t('filters.selected', held.length)
    }
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? String(value) : empty
    case 'string':
      return typeof value === 'string' && value !== '' ? value : empty
    default:
      return describeValue(spec, value) || empty
  }
}

function ResetAll({ count, reset }: { count: number; reset(): void }): ReactElement {
  const t = useMessages(filters)
  return (
    <button
      type="button"
      data-slot="filter-reset"
      disabled={count === 0}
      data-disabled={count === 0 ? '' : undefined}
      className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} self-start`}
      onClick={reset}
    >
      {t('filters.resetAll')}
    </button>
  )
}

/** One spec as a `row`: label, input, cue. The catalogue always holds the applied value. */
function RowView({ spec }: { spec: AnySpec }): ReactElement {
  const [value] = spec.handle.use()
  return <ControlView spec={withCurrentValue(spec, value)} />
}

type Census = { count: number; reset(): void }

function Pill({ spec, size }: { spec: AnySpec; size: 'sm' | 'md' }): ReactElement {
  const t = useMessages(filters)
  const [value] = spec.handle.use()
  const text = pillText(spec, value, t)
  const name = text.includes(spec.label) ? text : `${spec.label}: ${text}`
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="secondary" size={size} aria-label={name} className="max-w-56" />}
      >
        <span className="min-w-0 truncate">{text}</span>
        {isActive(spec, value) && (
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-brand" />
        )}
      </PopoverTrigger>
      <PopoverContent aria-label={spec.label} align="start" className="w-80 max-w-[90vw]">
        <FoldedControls>
          <RowView spec={spec} />
        </FoldedControls>
      </PopoverContent>
    </Popover>
  )
}

function Fold({
  folded,
  census,
  size,
}: {
  folded: readonly AnySpec[]
  census: Census
  size: 'sm' | 'md'
}): ReactElement {
  const t = useMessages(filters)
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="secondary"
            size={size}
            data-fold-trigger=""
            aria-label={t('filters.moreFilters', folded.length)}
          />
        }
      >
        +{folded.length}
      </PopoverTrigger>
      <PopoverContent aria-label={t('filters.showMore')} align="end" className="w-80 max-w-[90vw]">
        <FoldedControls>
          <div data-slot="filter-fold" className="flex flex-col gap-4">
            {folded.map((spec) => (
              <RowView key={spec.handle.key} spec={spec} />
            ))}
            <ResetAll {...census} />
          </div>
        </FoldedControls>
      </PopoverContent>
    </Popover>
  )
}

function PhoneSheet({
  specs,
  census,
  size,
}: {
  specs: readonly AnySpec[]
  census: Census
  size: 'sm' | 'md'
}): ReactElement {
  const t = useMessages(filters)
  return (
    <div className="@regular:hidden">
      <Sheet>
        <SheetTrigger render={<Button variant="secondary" size={size} />}>
          <span data-slot="filter-count">{t('filters.count', census.count)}</span>
        </SheetTrigger>
        <SheetContent title={t('filters.title')}>
          <FoldedControls>
            <div data-slot="filter-sheet" className="flex flex-col gap-4">
              {specs.map((spec) => (
                <RowView key={spec.handle.key} spec={spec} />
              ))}
              <ResetAll {...census} />
            </div>
          </FoldedControls>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function PillSet({
  specs,
  census,
  presentation,
}: {
  specs: readonly AnySpec[]
  census: Census
  presentation: ControlPresentation
}): ReactElement {
  const t = useMessages(filters)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const visible = useFold(
    rowRef,
    specs.map((s) => s.handle.key),
  )
  const size = presentation === 'inline' ? 'sm' : 'md'
  const folded = specs.slice(visible)
  return (
    <fieldset
      data-slot="filter-set"
      data-presentation={presentation}
      aria-label={t('filters.title')}
      className="m-0 w-full min-w-0 max-w-full border-0 p-0"
    >
      <div className="@container w-full min-w-0 max-w-full">
        <div
          ref={rowRef}
          data-slot="filter-pills"
          className="hidden w-full min-w-0 flex-nowrap items-center gap-2 overflow-clip [overflow-clip-margin:4px] @regular:flex"
        >
          {specs.map((spec, index) => (
            <div
              key={spec.handle.key}
              data-slot="filter-pill"
              data-fold-key={spec.handle.key}
              hidden={index >= visible}
              className="max-w-full min-w-0 shrink-0"
            >
              <Pill spec={spec} size={size} />
            </div>
          ))}
          {folded.length > 0 && <Fold folded={folded} census={census} size={size} />}
        </div>
        <PhoneSheet specs={specs} census={census} size={size} />
      </div>
    </fieldset>
  )
}

function RowSet({ specs, census }: { specs: readonly AnySpec[]; census: Census }): ReactElement {
  const t = useMessages(filters)
  return (
    <fieldset
      data-slot="filter-set"
      data-presentation="row"
      aria-label={t('filters.title')}
      className="m-0 flex w-full min-w-0 flex-col gap-4 border-0 p-0"
    >
      {specs.map((spec) => (
        <RowView key={spec.handle.key} spec={spec} />
      ))}
      <ResetAll {...census} />
    </fieldset>
  )
}

function Body({ specs }: { specs: readonly AnySpec[] }): ReactElement {
  const presentation = use(ControlPresentationContext)
  const census = useCensus(specs)
  return presentation === 'row' ? (
    <RowSet specs={specs} census={census} />
  ) : (
    <PillSet specs={specs} census={census} presentation={presentation} />
  )
}

/**
 * Draws `specs` in the presentation of the home around it. An empty list draws nothing. The body is
 * keyed by the handles it holds, so a changed set remounts it and the census keeps one hook per spec.
 */
export function SpecFilterSet({ specs }: { specs: readonly AnySpec[] }): ReactElement | null {
  if (specs.length === 0) return null
  return <Body key={specs.map((s) => s.handle.key).join('\u0000')} specs={specs} />
}
