/**
 * Section — the tier-2 heading composer (docs/CONTROLS-SPEC.md §2.2, law C8): a page-level content
 * grouping under `WidgetHeader tier="section"`. Named exactly `Section` — not `PageSection` — so
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
 * unmounts.
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
import { Children, useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CtlSlot } from '../theme'
import { createPersistedState } from '../state'
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

const UNPERSISTED_KEY = '__local__'

/** Collapse state — `createPersistedState` when `persistKey` is given, else local `useState`.
 * Both hooks are always called (stable order across renders); only the unpersisted branch's setter
 * is ever invoked when `persistKey` is absent, so no unpersisted Section writes to storage. */
function useSectionOpen(
  persistKey: string | undefined,
  defaultOpen: boolean,
): readonly [boolean, (next: boolean) => void] {
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const usePersistedOpen = useMemo(
    () =>
      createPersistedState<boolean>({
        key: `section:${persistKey ?? UNPERSISTED_KEY}`,
        version: 1,
        initial: defaultOpen,
      }),
    [persistKey, defaultOpen],
  )
  const [persistedOpen, setPersistedOpen] = usePersistedOpen()

  if (persistKey !== undefined) return [persistedOpen, setPersistedOpen] as const
  return [localOpen, setLocalOpen] as const
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
  title,
  icon,
  subtitle,
  info,
  value,
  delta,
  deltaPeriod,
  sparkline,
  count,
  actions,
  tabs,
  collapsible = false,
  persistKey,
  id,
  children,
}: SectionProps) {
  const [open, setOpen] = useSectionOpen(persistKey, true)
  const bodyId = useId()

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
      {...(id !== undefined && { id })}
      {...(id !== undefined && {
        style: {
          scrollMarginTop:
            'calc(var(--app-shell-header-height, 0px) + var(--basalt-page-bar-h, 0px))',
        },
      })}
    >
      <WidgetHeader
        tier="section"
        title={title}
        {...(icon !== undefined && { icon })}
        {...(subtitle !== undefined && { subtitle })}
        {...(info !== undefined && { info })}
        {...(value !== undefined && { value })}
        {...(delta !== undefined && { delta })}
        {...(deltaPeriod !== undefined && { deltaPeriod })}
        {...(sparkline !== undefined && { sparkline })}
        {...(count !== undefined && { count })}
        {...(headerActions !== undefined && { actions: headerActions })}
      />
      {open && (
        <div id={bodyId} className={classes.body}>
          {children}
        </div>
      )}
    </div>
  )
}
