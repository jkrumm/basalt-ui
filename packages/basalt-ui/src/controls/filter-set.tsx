/**
 * `FilterSet` — the filter home's container (`docs/CONTROLS-SPEC.md` §2.1 row 2, §3). It owns the
 * three things a consumer used to hand-roll per page: the nowrap row, the overflow fold, and the
 * mobile sheet.
 *
 * **Desktop.** One row, `wrap: nowrap`, and it NEVER scrolls (C7). When the measured pill widths
 * exceed the container the tail folds into a `+N` menu pill — a `ResizeObserver` on the row plus
 * per-slot `offsetWidth`, because the fold point depends on the labels actually painted (the same
 * reasoning as the charts' `autoMargin`), not on a guessed pill width.
 *
 * **Mobile (`< sm`).** The first `inline` children stay pills; every child — inline ones included —
 * also renders its full-width sheet form inside the `Filters (n)` Drawer — which exists only when
 * the budget folded at least one child away (one filter at `inline: 1` gets no pill at all). `n` is
 * DERIVED: each filter registers `{ isActive, reset }` with this component (`filter-context.tsx`),
 * so `FilterSet` never needs to be told which fields its children hold, and `Reset all` reaches all
 * of them.
 *
 * **Two mounts of the same children, one census.** The row keeps every child mounted on every
 * viewport (hidden slots are `display: none`, never unmounted), so it is the single registration
 * surface; the fold dropdown and the sheet mount a second copy under a `null` registry. That is why
 * a folded filter still counts toward `n` and still answers `Reset all`.
 *
 * @example
 * <PageBar
 *   filters={
 *     <FilterSet>
 *       <RangeFilter field={analytics.field.range} customPicker={DateRangePicker} />
 *       <CompareFilter field={analytics.field.compare} />
 *       <SelectFilter field={analytics.field.currency} label="Currency" />
 *     </FilterSet>
 *   }
 * />
 */
import { Children, isValidElement, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import classes from './controls.module.css'
import { FilterSetScope, useFilterCensus } from './filter-context'
import { FilterPill } from './filter-pill'
import { FilterSheet } from './filter-sheet'
import { FunnelGlyph } from './glyphs'

/** Width reserved for the `+N` pill once folding is known to be necessary. */
const FOLD_PILL_WIDTH = 52
/** `--vx-space-control-gap`'s level-0 value — the fallback when the row has no computed style. */
const FALLBACK_GAP = 6

export type FilterSetProps = {
  readonly children: ReactNode
  /**
   * How many children stay inline pills below `sm`. The rest are reachable only through the
   * `Filters (n)` sheet — which always holds every child, inline ones included.
   *
   * @default 1
   */
  readonly inline?: number
}

export function FilterSet({ children, inline = 1 }: FilterSetProps): ReactNode {
  const items = Children.toArray(children)
  const { registry, activeCount, resetAll } = useFilterCensus()
  const [sheetOpened, setSheetOpened] = useState(false)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const fit = useOverflowFit(rowRef, items.length)

  const openSheet = useCallback(() => {
    setSheetOpened(true)
  }, [])
  const closeSheet = useCallback(() => {
    setSheetOpened(false)
  }, [])

  // C14 — an empty home renders nothing, so no route pays for a reserved row.
  if (items.length === 0) return null

  const folded = items.slice(fit)
  // Below `sm` the sheet is the ONLY way to reach a child past the `inline` budget — so with every
  // child already inline (one filter at the default budget) it opens a drawer holding a copy of
  // what is on screen, under a pill that costs the row its width for nothing. The trigger exists
  // when something is actually folded away, and not before (law C14's reading of the mobile row).
  const anyFoldedOnMobile = items.length > inline

  return (
    <>
      <div className={classes.pillRow} ref={rowRef} data-filter-row>
        <FilterSetScope surface="pill" registry={registry}>
          {items.map((child, index) => (
            // `Children.toArray` already stamped a stable `.0`/`.1`-style key on every child, so
            // the slot wrapper reuses it rather than inventing an array-index key.
            <div
              key={slotKey(child, index)}
              className={classes.pillSlot}
              data-filter-slot
              {...(index < inline && { 'data-inline': true })}
              {...(index >= fit && { 'data-folded': true })}
            >
              {child}
            </div>
          ))}
        </FilterSetScope>

        <FilterPill
          label={`+${folded.length}`}
          ariaLabel={`${folded.length} more filters`}
          className={classes.foldPill}
          hideGlyph
          shown={folded.length > 0}
        >
          <div className={classes.optionList}>
            {/* SHEET form, not pill form. A folded pill would open a SECOND `withinPortal`
                Popover, which is not a DOM descendant of this one — Mantine's click-outside check
                walks `composedPath()` against the outer target/dropdown only, so the inner pill's
                own mousedown reads as "outside", closes `+N`, unmounts the pill, and the click
                never lands. The sheet form has no nested overlay at all, and it is the same form
                the mobile `Filters (n)` Drawer already uses — one behaviour, not two. */}
            <FilterSetScope surface="sheet" registry={null}>
              {folded}
            </FilterSetScope>
          </div>
        </FilterPill>

        {anyFoldedOnMobile && (
          <FilterPill
            label={activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
            active={activeCount > 0}
            icon={<FunnelGlyph />}
            className={classes.sheetPill}
            hideGlyph
            onClick={openSheet}
          />
        )}
      </div>

      {anyFoldedOnMobile && (
        <FilterSheet opened={sheetOpened} onClose={closeSheet} onResetAll={resetAll}>
          <FilterSetScope surface="sheet" registry={null}>
            {items}
          </FilterSetScope>
        </FilterSheet>
      )}
    </>
  )
}

/**
 * How many of `count` slots fit the row at its current width. Measures the slots' own
 * `offsetWidth` (remembering the last non-zero value per slot, since a folded or `inline`-budgeted
 * slot measures 0) and re-runs on every `ResizeObserver` tick.
 *
 * The measurement is only honest because `.pillSlot` is `flex-shrink: 0` — see that rule's comment
 * in `controls.module.css`. Every SLOT is observed alongside the row, not just the row: a label
 * that grows (a preset becoming `Mar 1 – Mar 14`) changes no container width, so observing the row
 * alone would miss exactly the case that pushes a fitting row over its budget.
 */
function useOverflowFit(rowRef: RefObject<HTMLDivElement | null>, count: number): number {
  const [fit, setFit] = useState(count)
  const widths = useRef<number[]>([])

  useEffect(() => {
    const row = rowRef.current
    if (row === null) return
    if (typeof ResizeObserver === 'undefined') {
      setFit(count)
      return
    }

    const measure = (): void => {
      const slots = [...row.querySelectorAll<HTMLElement>('[data-filter-slot]')]
      slots.forEach((slot, index) => {
        const width = slot.offsetWidth
        if (width > 0) widths.current[index] = width
      })

      const available = row.clientWidth
      if (available <= 0) {
        setFit(count)
        return
      }

      const gap = readGap(row)
      const bare = fitCount(widths.current, count, gap, available, 0)
      // Reserve the `+N` pill only once folding is known to be needed — reserving it up front
      // would fold a set that fits exactly.
      setFit(
        bare === count ? count : fitCount(widths.current, count, gap, available, FOLD_PILL_WIDTH),
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    for (const slot of row.querySelectorAll<HTMLElement>('[data-filter-slot]')) {
      observer.observe(slot)
    }
    return () => {
      observer.disconnect()
    }
  }, [rowRef, count])

  return fit
}

function fitCount(
  widths: readonly number[],
  count: number,
  gap: number,
  available: number,
  reserve: number,
): number {
  let used = reserve === 0 ? 0 : reserve + gap
  for (let index = 0; index < count; index += 1) {
    used += (index === 0 ? 0 : gap) + (widths[index] ?? 0)
    if (used > available) return index
  }
  return count
}

function slotKey(child: ReactNode, index: number): string {
  if (isValidElement(child) && child.key !== null) return child.key
  return String(index)
}

function readGap(row: HTMLElement): number {
  const parsed = Number.parseFloat(getComputedStyle(row).columnGap)
  return Number.isFinite(parsed) ? parsed : FALLBACK_GAP
}
