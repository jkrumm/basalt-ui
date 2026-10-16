/**
 * The mobile `Filters (n)` sheet (`docs/CONTROLS-SPEC.md` §2.1/§3) — a bottom `Drawer` around the
 * SAME `PanelRow` forms the aside's `panel` surface renders (`useFilterSurface` resolves `'sheet'`
 * and `'panel'` to the identical control body; only the surrounding chrome differs). Every child of
 * the `FilterSet` renders its full-width form inside it, edits APPLY IMMEDIATELY (there is no Apply
 * button — the URL is the truth and a filter write is already `history: 'replace'`), and one
 * `Reset all` (in the header, not a footer — see this module's doc below) clears every registered
 * filter.
 *
 * This module used to also own the sheet's OWN row primitives — a `SheetOptionList` of 44px rows
 * with a hairline between them, one per option. That did not scale (`docs/CONTROLS-SPEC.md` §3): a
 * filter with many options became a sheet as tall as the set, where the panel's own `PanelChoice`
 * (a track, or a `Select` past three) and `MultiSelectFilter`'s facet fold both already had an
 * answer. Deleted with it: `SheetField`, `SheetOptionList`, `SheetDisclosure`, `SheetRow` and
 * `sheetRowClassNames` (`MIGRATING.md`).
 *
 * INTERNAL, like `FilterPill`: `FilterSet` owns when the sheet opens, so a consumer mounting it by
 * hand would own a second, unregistered filter home (C1).
 */
import { Button, Drawer } from '@mantine/core'
import type { ReactNode } from 'react'
import type { BasaltProps } from '../common/props'
import classes from './controls.module.css'

export type FilterSheetProps = BasaltProps & {
  readonly opened: boolean
  readonly onClose: () => void
  /**
   * Clears every registered filter. OMITTED on a sheet with no census behind it — the aside's
   * mobile projection (`docs/ASIDE-SPEC.md` §0) mounts its children under a `null` registry, so
   * there is nothing to reset and a button that resets nothing is worse than no button.
   */
  readonly onResetAll?: () => void
  readonly title?: string
  readonly children: ReactNode
}

/**
 * `Reset all` rides the HEADER, beside the title and the close ×, not a footer.
 *
 * A bottom drawer's footer is the one region a phone cannot promise is on screen: the sheet grows
 * with its content, so with six filters open the reset button sat below the fold and the only way to
 * reach it was to scroll past every row it would have undone. The header is fixed by construction.
 * It also removes the sheet's last horizontal rule — a footer needs separating from the rows above
 * it, a header does not (`docs/CONTROLS-SPEC.md` §2.1: hairlines between OPTION rows only).
 */
export function FilterSheet({
  opened,
  onClose,
  onResetAll,
  title = 'Filters',
  children,
  className,
  style,
}: FilterSheetProps): ReactNode {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      radius="sm"
      classNames={{ header: classes.sheetHeader, title: classes.sheetTitle }}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
      title={
        <>
          <span className={classes.sheetTitleText}>{title}</span>
          {onResetAll !== undefined && (
            <Button variant="subtle" size="ctl" onClick={onResetAll}>
              Reset all
            </Button>
          )}
        </>
      }
    >
      <div className={classes.sheetBody}>{children}</div>
    </Drawer>
  )
}
