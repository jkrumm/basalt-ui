/**
 * Section — the tier-2 heading composer (docs/CONTROLS-SPEC.md §2.2, law C8): a page-level content
 * grouping under `WidgetHeader tier="section"` — or `tier="group"` when the section renders on the
 * `PageAside` panel surface, resolved from `useFilterSurface()` and never a call-site prop (law C1:
 * no fourth home, no new prop — the aside decides, not the caller). Named exactly `Section` — not
 * `PageSection` — so
 * the existing `shadow-basalt-export` guard fires on a consumer's own hand-rolled `Section` /
 * `PageSection` / `SectionTitle` / `SectionHeading` copy with zero new rule code.
 *
 * No `variant`, no border/background of its own — one shaded container level per page belongs to
 * the cards inside a Section (`ChartCard`/`StatCard`), not to the Section itself.
 *
 * `actions` and `tabs` are two separate `CtlSlot`-wrapped fragments rendered in the header row
 * (C1/C5) via `WidgetHeader`'s single `actions` slot; `tabs` hides while the section is collapsed.
 * `Section` holds ≤3 actions (C6) — a fourth is a tsc error (the `SectionActions` type).
 *
 * `collapsible` state persists via `createPersistedState('basalt:section:<persistKey>')` when
 * `persistKey` is given, else it is local `useState` — the header always stays drawn, only the body
 * unmounts. `defaultOpen` picks the state a first visit lands on; a persisted value outranks it.
 *
 * `summary` renders under the header and survives a collapse. That is the whole reason it is a
 * separate slot rather than the first child: a section a reader folded away should still state its
 * headline figures, or folding it costs them the numbers they were watching.
 *
 * `id` turns the root into a scroll anchor. Inside `BasaltShell` both bars sit outside the
 * scrollport, so the offset is the clearance token alone; without a shell it adds `PageBar`'s
 * measured height (`--basalt-page-bar-h`) so the heading isn't hidden under the sticky bar.
 *
 * @example
 * import { Section, StatCard } from 'basalt-ui'
 *
 * <Section title="Revenue" icon={<IconChartBar size={16} />} count={rows.length}>
 *   <StatCard title="MRR" value="$48,204" delta={3.1} />
 * </Section>
 *
 * @example
 * // Collapsible, with tabs and a persisted fold state.
 * <Section
 *   id="usage"
 *   title="Usage"
 *   collapsible
 *   persistKey="usage"
 *   tabs={<ViewTabs field={viewField} />}
 * >
 *   <UsageChart />
 * </Section>
 */
import { useEffect, useId } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import { BASALT_PREFIX } from '../common/errors'
import { useValidateProps } from '../common/validate'
import { CtlSlot } from '../theme'
import { BarActionSlot } from '../controls/actions'
import type { SectionActions } from '../controls/actions'
import { useFilterSurface } from '../controls/filter-context'
import { QueryState } from './query-state'
import type { QueryEmptyCopy, QueryStateLike } from './query-state'
import { usePersistedOrLocal } from '../state/persisted-or-local'
import { PAGE_BAR_HEIGHT_VAR, useInPageBarShell } from '../shell'
import { WidgetHeader } from './widget-header'
import type { WidgetHeaderProps } from './widget-header'
import classes from './section.module.css'

/**
 * The three boxes `Section` paints, and the whole styling seam it offers (`common/props.ts`):
 * `root` is the outer stack, `header` is the `WidgetHeader` row, `body` is the collapsible content
 * box. `summary` is deliberately absent — it is a one-row readout under the header, not a layout
 * box a consumer positions.
 */
export type SectionSlot = 'root' | 'header' | 'body'

// `classNames` is omitted alongside `tier`: `WidgetHeader` publishes its OWN slot union now, and
// intersecting the two would let a caller write `classNames={{ metric: … }}` on a `Section` and get
// silence. Section's three slots are its whole styling contract; the header's own slots are reached
// on a `WidgetHeader`.
/** The props only a drawn heading can carry; an untitled `Section` forbids each (`?: never`). */
type HeaderOnlyKey =
  | 'icon'
  | 'subtitle'
  | 'info'
  | 'value'
  | 'unit'
  | 'delta'
  | 'deltaPeriod'
  | 'deltaPolarity'
  | 'deltaFormat'
  | 'deltaGlyph'
  | 'sparkline'
  | 'count'

type SectionBaseProps = Omit<
  WidgetHeaderProps,
  'tier' | 'classNames' | 'actions' | 'title' | HeaderOnlyKey
> &
  BasaltProps &
  SlotStylesProps<SectionSlot> & {
    /**
     * Header actions as typed data (law C15), projected through the SAME row `PageBar` uses — one
     * kebab below `sm`. At most three: a fourth is a tsc error (law C6, `docs/V2-SPEC.md` §3).
     */
    actions?: SectionActions
    /**
     * The section's async result. Given one, the BODY renders through `QueryState` at the section
     * tier — pending / error-with-retry / empty each REPLACE `children`, data renders them — while
     * the header, the fold chevron and `summary` stay drawn throughout, so a section never blinks out
     * of the page while it refetches.
     *
     * This is law C3's uniform container contract (`docs/CONTROLS-SPEC.md` §1): without it every
     * caller re-derives the four-way switch `QueryState` exists to delete, and gets it wrong in the
     * one direction that matters — "nothing here" printed over a 500.
     */
    query?: QueryStateLike<unknown>
    /**
     * Copy for `query`'s EMPTY branch, rendered through `EmptyState` like every other one. Omit to
     * render nothing when the result is empty — `QueryState`'s own contract, unchanged. Ignored
     * without `query`.
     */
    empty?: QueryEmptyCopy
    /** Rendered in the header row, in its own `CtlSlot` — hidden while the section is collapsed. */
    tabs?: ReactNode
    /** Renders a chevron toggle in the header; the header stays drawn when closed, only `children`
     * (and `tabs`) unmount. @default false */
    collapsible?: boolean
    /** Persists the fold state at `basalt:section:<persistKey>`. Omit for a local, unpersisted fold
     * (`useState`). */
    persistKey?: string
    /** Controlled fold state (Mantine naming). Given one, the section follows it — a click only
     * calls `onOpenChange`, and the value is mirrored into the local/persisted fold so dropping
     * `open` keeps what the reader last saw. Omit for the uncontrolled, optionally persisted fold. */
    open?: boolean
    /** Called with the next fold state on every toggle, controlled or not. */
    onOpenChange?: (open: boolean) => void
    /** The fold state a section opens on, respected only while no persisted value exists — a section
     * a reader has closed stays closed. `false` is what a long secondary block wants. @default true */
    defaultOpen?: boolean
    /** Rendered directly under the header and ALWAYS visible, collapsed or not: a collapsed section
     * still states its headline figures, which is what makes collapsing it a real option. Keep it to
     * one row — the body is what `children` is for. Section owns the summary text size (11 px, the
     * chart-text step): a `size` prop on a bare `Text` here is ignored — wrap it to opt out. */
    summary?: ReactNode
    /** Turns the root into a scroll anchor (`id` + `scroll-margin-top`). Inside `BasaltShell` the
     * offset is the clearance token; without a shell it also clears `PageBar`, which assumes the
     * document is the scrollport. */
    id?: string
    children: ReactNode
  }

/**
 * A Section names itself with `title` — or, with no title, by its `tabs` alone (argo's m365 phone
 * pane switch: a heading restating the open pane's name beside the tabs that already say it). The
 * header row then collapses to the tabs (and `actions`): no heading, no fold, and none of the
 * heading-only props (`count`, `info`, `subtitle`, `icon`, the hero metric) — each is a type error.
 *
 * Naming: a `ViewTabs` in `tabs` already names its own tablist, so the section adds no second name
 * and no `group` role. Pass `aria-label` only when the tabs are not self-naming — it then makes the
 * root a labelled `group`.
 */
export type SectionProps = SectionBaseProps &
  (
    | (Pick<WidgetHeaderProps, HeaderOnlyKey> & { title: string; 'aria-label'?: never })
    | ({ title?: undefined; tabs: ReactNode; 'aria-label'?: string } & {
        [K in HeaderOnlyKey]?: never
      })
  )

function ChevronToggle({
  open,
  onToggle,
  controls,
}: {
  open: boolean
  onToggle: () => void
  controls: string
}) {
  return (
    <button
      type="button"
      className={classes.chevron}
      data-basalt-hit
      data-open={open}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? 'Collapse section' : 'Expand section'}
      onClick={onToggle}
    >
      <svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

const ANCHOR_CLEARANCE = 'var(--vx-space-sticky-header-clearance)'

/** The `scroll-margin-top` of an anchored Section; the bar term only exists without a shell. */
function anchorOffset(inShell: boolean): string {
  if (inShell) return ANCHOR_CLEARANCE
  return `calc(var(${PAGE_BAR_HEIGHT_VAR}, 0px) + ${ANCHOR_CLEARANCE})`
}

export function Section({
  actions,
  query,
  empty,
  tabs,
  collapsible = false,
  persistKey,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  summary,
  id,
  children,
  className,
  style,
  classNames,
  'aria-label': ariaLabel,
  ...headerProps
}: SectionProps) {
  const { title } = headerProps
  const untitled = title === undefined

  // A `persistKey` with nothing to fold writes a localStorage key nobody ever reads back — the
  // shape a consumer lands on after deleting `collapsible` and leaving the key behind. It renders
  // fine, which is what puts it in `useValidateProps` rather than in `assertRequiredProps`.
  useValidateProps(
    'Section',
    () => [
      persistKey !== undefined && !collapsible
        ? `${BASALT_PREFIX} Section "${title}": \`persistKey\` is set but \`collapsible\` is ` +
          'false — there is no fold to persist. Add `collapsible`, or drop `persistKey`.'
        : null,
    ],
    [persistKey, collapsible, title],
  )

  const [stateOpen, setStateOpen] = usePersistedOrLocal({
    scope: 'section',
    persistKey,
    initial: defaultOpen,
  })
  const open = openProp ?? stateOpen
  // Dropping `open` falls back to what the reader last SAW, not to a stale persisted value.
  useEffect(() => {
    if (openProp !== undefined && openProp !== stateOpen) setStateOpen(openProp)
  }, [openProp, stateOpen, setStateOpen])
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setStateOpen(next)
    onOpenChange?.(next)
  }
  const bodyId = useId()
  // The aside decides, not the call site (law C1): a Section on the PageAside panel surface, or on
  // its mobile sheet projection, renders the quiet `group` tier automatically — a Section never
  // lives inside a pill FilterSet fold, so `'pill'` (the context default outside any provider) is
  // the only surface that stays `section`.
  const tier = useFilterSurface() === 'pill' ? 'section' : 'group'

  // The anchor offset is Section's own, so the caller's `style` merges OVER it rather than
  // replacing it — a consumer setting a margin must not silently drop the scroll offset.
  //
  // NO chrome height in this offset. An anchor scroll happens inside the SCROLLPORT, and since
  // `AppShell.Main` became that box (`shell/app-main.module.css`) BOTH the app header and `PageBar`
  // row 2's band are shell regions rendered outside it — counting either would land every `#anchor`
  // that far below its own heading. What is left is breathing room, which is exactly what
  // `--vx-space-sticky-header-clearance` means (tokens/palette.ts, `deriveSpacing`).
  //
  // The one exception is a tree with NO shell: `PageBar` is then a sticky bar in the document flow,
  // the document is the scrollport, and its published height is exactly what an anchor must clear.
  const inShell = useInPageBarShell()
  const anchorStyle = id === undefined ? undefined : { scrollMarginTop: anchorOffset(inShell) }
  const rootStyle =
    anchorStyle === undefined && style === undefined ? undefined : { ...anchorStyle, ...style }

  // An untitled section has nothing to fold behind: the tabs ARE the header.
  const foldable = collapsible && !untitled
  const headerActions =
    tabs !== undefined || actions !== undefined || foldable ? (
      <>
        {tabs !== undefined && (open || untitled) && <CtlSlot>{tabs}</CtlSlot>}
        {actions !== undefined && (
          <CtlSlot>
            <BarActionSlot actions={actions} />
          </CtlSlot>
        )}
        {foldable && (
          <ChevronToggle open={open} onToggle={() => setOpen(!open)} controls={bodyId} />
        )}
      </>
    ) : undefined

  return (
    <div
      className={cx(classes.root, classNames?.root, className)}
      data-tier={tier}
      {...(untitled && ariaLabel !== undefined && { role: 'group', 'aria-label': ariaLabel })}
      {...(id !== undefined && { id })}
      {...(rootStyle !== undefined && { style: rootStyle })}
    >
      {untitled ? (
        <div className={cx(classes.tabsRow, classNames?.header)} data-basalt-hit-scope>
          {headerActions}
        </div>
      ) : (
        <WidgetHeader
          tier={tier}
          {...(headerProps as Pick<WidgetHeaderProps, HeaderOnlyKey>)}
          title={title}
          {...(classNames?.header !== undefined && { className: classNames.header })}
          {...(headerActions !== undefined && { actions: headerActions })}
        />
      )}
      {summary !== undefined && <div className={classes.summary}>{summary}</div>}
      {(open || untitled) && (
        <div id={bodyId} className={cx(classes.body, classNames?.body)}>
          {query === undefined ? (
            children
          ) : (
            // `tier="section"` is the compact one: a bare spinner rather than a 64px centred
            // block, and the error alert without the page-level stack around it. A Section IS the
            // region, so the state belongs inside its body, never around its header.
            <QueryState query={query} tier="section" {...(empty !== undefined && { empty })}>
              {children}
            </QueryState>
          )}
        </div>
      )}
    </div>
  )
}
