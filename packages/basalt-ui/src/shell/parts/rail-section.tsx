/**
 * One rail section: a label band over its rows.
 *
 * Spacing is the section's own: the first section sits 6 px under the viewport top, every later one
 * 16 px under the section above (`mt-4`), in the expanded and the collapsed rail alike. The label
 * band is display-none in the collapsed rail, so a seam there is exactly the 16 px.
 *
 * A collapsible section folds through a persisted flag (`rail-folds.ts`). The fold hides the rows
 * with `data-folded`, NOT the `hidden` attribute: the collapsed rail has no header, and with it no
 * way to unfold, so a container query overrides the fold there and the rows are shown. The rows
 * stay mounted either way.
 */
import { useId } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../../core/cn'
import { CountBadge } from '../../ui/badge'
import { Collapsible, CollapsibleTrigger } from '../../ui/collapsible'
import { isLit } from '../core/badges'
import type { RailSection } from '../core/projector'
import { RailRowView } from './rail-rows'
import { RAIL_TEXT } from './rail-text'
import { setSectionFold } from './rail-folds'

const LABEL =
  'flex h-6 w-full items-center gap-1.5 px-2.5 text-micro font-medium tracking-wide text-faint uppercase @max-[120px]:hidden'

/** The folded header's badge: the rollup of what the hidden rows carry. */
function Rollup({ section }: { section: RailSection }): ReactElement | null {
  const { rollup } = section
  if (!isLit(rollup)) return null
  const attention = section.tone === 'warn'
  if ('dot' in rollup) {
    return (
      <span
        data-slot="shell-rail-section-rollup"
        aria-hidden="true"
        className={cn(
          'ms-auto size-1.5 rounded-full',
          attention ? 'bg-warn' : 'bg-muted-foreground',
        )}
      />
    )
  }
  return (
    <span data-slot="shell-rail-section-rollup" aria-hidden="true" className="ms-auto flex">
      <CountBadge count={rollup.count} attention={attention} />
    </span>
  )
}

function Header({
  section,
  rowsId,
}: {
  section: RailSection
  rowsId: string
}): ReactElement | null {
  if (section.label === '') return null
  if (!section.collapsible) {
    return (
      <h2 data-slot="shell-rail-section-label" className={LABEL}>
        {section.label}
      </h2>
    )
  }
  const cue = section.folded && section.containsActive
  return (
    <CollapsibleTrigger
      data-slot="shell-rail-section-label"
      aria-controls={rowsId}
      {...(cue && { 'data-contains-active': '' })}
      className={cn(LABEL, 'cursor-pointer text-start hover:text-muted-foreground')}
    >
      <span className="truncate">{section.label}</span>
      {cue && (
        <>
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-brand"
            data-slot="shell-rail-section-cue"
          />
          <span className="sr-only">{RAIL_TEXT.containsActive}</span>
        </>
      )}
      {section.folded && <Rollup section={section} />}
    </CollapsibleTrigger>
  )
}

export function RailSectionView({
  section,
  first,
}: {
  section: RailSection
  first: boolean
}): ReactElement {
  const rowsId = useId()
  const rows = (
    <div
      id={rowsId}
      data-slot="shell-rail-section-rows"
      data-folded={section.folded}
      className="flex flex-col gap-px data-[folded=true]:hidden @max-[120px]:data-[folded=true]:flex"
    >
      {section.rows.map((row) => (
        <RailRowView key={row.id} row={row} />
      ))}
    </div>
  )
  const className = cn('flex flex-col', first ? 'mt-1.5' : 'mt-4')
  return (
    <section
      data-slot="shell-rail-section"
      data-section={section.id}
      aria-label={section.label === '' ? undefined : section.label}
      className={className}
    >
      {section.collapsible ? (
        <Collapsible
          open={!section.folded}
          onOpenChange={(open) => setSectionFold(section.id, !open)}
        >
          <Header section={section} rowsId={rowsId} />
          {rows}
        </Collapsible>
      ) : (
        <>
          <Header section={section} rowsId={rowsId} />
          {rows}
        </>
      )}
    </section>
  )
}
