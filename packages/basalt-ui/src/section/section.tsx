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
 * `Section` holds ≤3 actions (C6) — past that, a dev-only `useValidateProps` message fires once per
 * title (the AST guard lands in wave 6).
 *
 * `collapsible` state persists via `createPersistedState('basalt:section:<persistKey>')` when
 * `persistKey` is given, else it is local `useState` — the header always stays drawn, only the body
 * unmounts. `defaultOpen` picks the state a first visit lands on; a persisted value outranks it.
 *
 * `summary` renders under the header and survives a collapse. That is the whole reason it is a
 * separate slot rather than the first child: a section a reader folded away should still state its
 * headline figures, or folding it costs them the numbers they were watching.
 *
 * `id` turns the root into a scroll anchor, offset by both the shell header height and the
 * `PageBar`'s measured height (`--basalt-page-bar-h`, wave 4) so an anchor-jumped heading isn't
 * hidden under either sticky bar.
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
import { Children, useId } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import { BASALT_PREFIX } from '../common/errors'
import { useValidateProps } from '../common/validate'
import { CtlSlot } from '../theme'
import { BarActionSlot, isBarActionList } from '../controls/actions'
import type { SlotActions } from '../controls/actions'
import { useFilterSurface } from '../controls/filter-context'
import { QueryState } from '../dashboard/query-state'
import type { QueryEmptyCopy, QueryStateLike } from '../dashboard/query-state'
import { usePersistedOrLocal } from '../state/persisted-or-local'
import { WidgetHeader } from '../widget-header'
import type { WidgetHeaderProps } from '../widget-header'
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
export type SectionProps = Omit<WidgetHeaderProps, 'tier' | 'classNames' | 'actions'> &
  BasaltProps &
  SlotStylesProps<SectionSlot> & {
    /**
     * Header actions, in either form (law C15): a typed `BarAction[]`, which basalt projects through
     * the SAME row `PageBar` and `ActionGroup` use — ≤3 inline, the rest folded into `More`, one
     * kebab below `sm` — or an opaque `ReactNode` a caller drew itself, rendered verbatim. The ≤3
     * budget (C6) is checked against whichever form is given.
     */
    actions?: SlotActions
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
    /** The fold state a section opens on, respected only while no persisted value exists — a section
     * a reader has closed stays closed. `false` is what a long secondary block wants. @default true */
    defaultOpen?: boolean
    /** Rendered directly under the header and ALWAYS visible, collapsed or not: a collapsed section
     * still states its headline figures, which is what makes collapsing it a real option. Keep it to
     * one row — the body is what `children` is for. */
    summary?: ReactNode
    /** Turns the root into a scroll anchor (`id` + `scroll-margin-top` cleared for both sticky bars). */
    id?: string
    children: ReactNode
  }

/**
 * ≤3 actions is C6 (docs/CONTROLS-SPEC.md §1) — the AST guard (`basalt/page-bar-budget`) lands in
 * wave 6; this is the dev-only stopgap so the budget is visible before the lint rule exists.
 *
 * Returns the message rather than logging it, because it is a {@link useValidateProps} check now:
 * it used to `console.warn` straight from the render body, which said it again on every keystroke
 * that re-rendered the page. The title is IN the message on purpose — the dedup key is
 * `${component} ${message}`, so two over-budget sections only both get heard because they name
 * themselves.
 */
function actionBudgetMessage(title: string, actions: SlotActions): string | null {
  // Both arms of the union are counted, and the typed one is counted EXACTLY: `Children.count` over
  // a `BarAction[]` would report the array's length as one child.
  const count = isBarActionList(actions) ? actions.length : Children.count(actions)
  if (count <= 3) return null
  return (
    `${BASALT_PREFIX} Section "${title}": ${count} actions exceeds the ≤3 budget ` +
    '(docs/CONTROLS-SPEC.md C6) — move the rest behind a menu.'
  )
}

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

export function Section({
  actions,
  query,
  empty,
  tabs,
  collapsible = false,
  persistKey,
  defaultOpen = true,
  summary,
  id,
  children,
  className,
  style,
  classNames,
  ...headerProps
}: SectionProps) {
  const { title } = headerProps

  // Two dev-only checks, one hook — both are misuses that RENDER fine, which is what puts them in
  // `useValidateProps` rather than in `assertRequiredProps`.
  //
  //  1. A `persistKey` with nothing to fold writes a localStorage key nobody ever reads back — the
  //     shape a consumer lands on after deleting `collapsible` and leaving the key behind.
  //  2. More than three header actions (C6). This used to `console.warn` from the render body, so a
  //     page that re-rendered on every keystroke reprinted it every keystroke.
  useValidateProps(
    'Section',
    () => [
      persistKey !== undefined && !collapsible
        ? `${BASALT_PREFIX} Section "${title}": \`persistKey\` is set but \`collapsible\` is ` +
          'false — there is no fold to persist. Add `collapsible`, or drop `persistKey`.'
        : null,
      actions === undefined ? null : actionBudgetMessage(title, actions),
    ],
    [persistKey, collapsible, title, actions],
  )

  const [open, setOpen] = usePersistedOrLocal({
    scope: 'section',
    persistKey,
    initial: defaultOpen,
  })
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
  const anchorStyle =
    id === undefined ? undefined : { scrollMarginTop: 'var(--vx-space-sticky-header-clearance)' }
  const rootStyle =
    anchorStyle === undefined && style === undefined ? undefined : { ...anchorStyle, ...style }

  const headerActions =
    tabs !== undefined || actions !== undefined || collapsible ? (
      <>
        {tabs !== undefined && open && <CtlSlot>{tabs}</CtlSlot>}
        {actions !== undefined && (
          <CtlSlot>
            <BarActionSlot actions={actions} />
          </CtlSlot>
        )}
        {collapsible && (
          <ChevronToggle open={open} onToggle={() => setOpen(!open)} controls={bodyId} />
        )}
      </>
    ) : undefined

  return (
    <div
      className={cx(classes.root, classNames?.root, className)}
      data-tier={tier}
      {...(id !== undefined && { id })}
      {...(rootStyle !== undefined && { style: rootStyle })}
    >
      <WidgetHeader
        tier={tier}
        {...headerProps}
        {...(classNames?.header !== undefined && { className: classNames.header })}
        {...(headerActions !== undefined && { actions: headerActions })}
      />
      {summary !== undefined && <div className={classes.summary}>{summary}</div>}
      {open && (
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
