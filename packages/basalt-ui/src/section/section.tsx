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
 * `Section` holds ≤3 actions (C6) — past that, a dev-only console warning fires (the AST guard
 * lands in wave 6).
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
import { CtlSlot } from '../theme'
import { useFilterSurface } from '../controls/filter-context'
import { usePersistedOrLocal } from '../state/persisted-or-local'
import { WidgetHeader } from '../widget-header'
import type { WidgetHeaderProps } from '../widget-header'
import classes from './section.module.css'

export type SectionProps = Omit<WidgetHeaderProps, 'tier'> & {
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

/** The house dev gate (`data/data-table.tsx`, `provider`, `charts/kinds/BandStrip` use the same
 * expression): `basaltViteConfig` defines `process.env.NODE_ENV`, so a production bundle
 * constant-folds this to `false` and drops the warning. Read per call, never hoisted. */
function isDev(): boolean {
  return process.env['NODE_ENV'] !== 'production'
}

/** ≤3 actions is C6 (docs/CONTROLS-SPEC.md §1) — the AST guard (`basalt/page-bar-budget`) lands in
 * wave 6; this is the dev-only stopgap so the budget is visible before the lint rule exists. */
function warnPastActionBudget(title: string, actions: ReactNode): void {
  if (!isDev()) return
  const count = Children.count(actions)
  if (count <= 3) return
  console.warn(
    `Section "${title}": ${count} actions exceeds the ≤3 budget (docs/CONTROLS-SPEC.md C6) — ` +
      'move the rest behind a menu.',
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
  tabs,
  collapsible = false,
  persistKey,
  defaultOpen = true,
  summary,
  id,
  children,
  ...headerProps
}: SectionProps) {
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

  const { title, actions } = headerProps
  if (actions !== undefined) warnPastActionBudget(title, actions)

  const headerActions =
    tabs !== undefined || actions !== undefined || collapsible ? (
      <>
        {tabs !== undefined && open && <CtlSlot>{tabs}</CtlSlot>}
        {actions !== undefined && <CtlSlot>{actions}</CtlSlot>}
        {collapsible && (
          <ChevronToggle open={open} onToggle={() => setOpen(!open)} controls={bodyId} />
        )}
      </>
    ) : undefined

  return (
    <div
      className={classes.root}
      data-tier={tier}
      {...(id !== undefined && { id })}
      {...(id !== undefined && {
        style: {
          scrollMarginTop:
            'calc(var(--app-shell-header-height, 0px) + var(--basalt-page-bar-h, 0px))',
        },
      })}
    >
      <WidgetHeader
        tier={tier}
        {...headerProps}
        {...(headerActions !== undefined && { actions: headerActions })}
      />
      {summary !== undefined && <div className={classes.summary}>{summary}</div>}
      {open && (
        <div id={bodyId} className={classes.body}>
          {children}
        </div>
      )}
    </div>
  )
}
