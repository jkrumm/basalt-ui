import { useId } from 'react'
import type { ReactElement } from 'react'
import { headingSlug } from '../core/slug'
import type { ControlHandle } from '../core/ports'
import { SlotHomeContext } from '../core/slot-home'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import type { SectionProps } from './contract'
import { isEmptyTabs, renderTabs } from './page-tabs'

/**
 * A titled part of a page: an `h2`, an optional controls slot on the same row and the body. The
 * section is a named region and a scroll anchor: its `id` is the slug of `title`, and its scroll
 * margin is `--page-sticky-top`, so a `#hash` jump, a skip link or `scrollIntoView` lands the
 * heading just below the page band instead of under it. Outside a `Page` the offset is zero.
 *
 * `tabs` is the section's view switch: `{ handle, label }` of an enum field draws a tab strip
 * bound to it, a `ControlsSlot` renders as is.
 *
 * `summary` is one line beside the title, shown while the section is collapsed too. `collapsible`
 * makes the heading the trigger of a region around the body: `defaultOpen` for an uncontrolled
 * section (open unless `false`), `state` (a boolean field) for one the URL or the device remembers;
 * `state` wins.
 *
 * `controls` is the section's own control home (a range for one widget, a view switch): it never
 * holds page-wide filters, which belong to the `PageBar`.
 *
 * @useWhen a page has several parts that each need a heading, their own controls or an anchor
 * @neverWhen the part is a single card (the card has its own title) or the heading restates the page title
 *
 * @example
 * <Section title="Latency" controls={filterSlot([widgetRange])}>
 *   <ChartCard title="p95" chart={…} />
 * </Section>
 */
export function Section<K extends string = string>(props: SectionProps<K>): ReactElement {
  const { collapsible } = props
  if (collapsible === undefined) return <SectionFrame {...props} />
  const { state, defaultOpen } = collapsible
  return state === undefined ? (
    <SectionFrame {...props} collapse={{ defaultOpen: defaultOpen ?? true }} />
  ) : (
    <BoundSection {...props} state={state} />
  )
}

type Collapse = { defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }

function BoundSection<K extends string>({
  state,
  ...props
}: SectionProps<K> & { state: ControlHandle<boolean> }): ReactElement {
  const [open, setOpen] = state.use()
  return <SectionFrame {...props} collapse={{ open, onOpenChange: setOpen }} />
}

function Chevron(): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-icon shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-180 motion-reduce:transition-none"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SectionFrame<K extends string>({
  title,
  summary,
  controls,
  tabs,
  children,
  collapse,
}: SectionProps<K> & { collapse?: Collapse }): ReactElement {
  const headingId = useId()
  const anchor = headingSlug(title)
  const heading = (
    <h2
      id={headingId}
      className="m-0 min-w-0 font-head text-md font-semibold tracking-tight text-foreground"
    >
      {collapse === undefined ? (
        title
      ) : (
        <CollapsibleTrigger className="group inline-flex max-w-full items-center gap-2 text-left font-[inherit]">
          <span className="min-w-0">{title}</span>
          <Chevron />
        </CollapsibleTrigger>
      )}
    </h2>
  )
  const header = (
    <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
        {heading}
        {summary !== undefined && summary !== '' && (
          <p data-slot="section-summary" className="m-0 min-w-0 text-sm text-muted-foreground">
            {summary}
          </p>
        )}
      </div>
      {!isEmptyTabs(tabs) && (
        <div data-slot="section-tabs" className="flex min-w-0 items-center">
          {renderTabs(tabs)}
        </div>
      )}
      {controls !== undefined && controls.count > 0 && (
        <div data-slot="section-controls" className="flex min-w-0 flex-wrap items-center gap-2">
          <SlotHomeContext value="section-header">{controls.render()}</SlotHomeContext>
        </div>
      )}
    </header>
  )
  return (
    <section
      id={anchor === '' ? undefined : anchor}
      data-slot="section"
      aria-labelledby={headingId}
      className="flex min-w-0 scroll-mt-(--page-sticky-top) flex-col gap-3"
    >
      {collapse === undefined ? (
        <>
          {header}
          {children}
        </>
      ) : (
        <Collapsible {...collapse} className="flex min-w-0 flex-col gap-3">
          {header}
          <CollapsibleContent>{children}</CollapsibleContent>
        </Collapsible>
      )}
    </section>
  )
}
