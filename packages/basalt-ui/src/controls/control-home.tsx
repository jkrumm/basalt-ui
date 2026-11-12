/**
 * `ControlHome`: the one place that decides how a control looks. A control never takes a `variant`;
 * the home that hosts it does, so a page author cannot pick the wrong form.
 *
 * | home | presentation |
 * |-|-|
 * | `page-bar`, `section-header`, `view-mode` | `pill` |
 * | `card-header`, `tool` | `inline` |
 * | `form-row`, `aside`, `sheet`, `side-panel`, `overlay` | `row` |
 *
 * `view-mode` and `tool` sit in a toolbar row, so they draw a `Toolbar` with one `ToolbarGroup`. A pill that a
 * fold moves into a popover draws the `row` form (`FoldedControls`): a pill inside a pill would nest
 * a portal, and a nested portal is not an outside click.
 */
import { Children, createContext, use } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { home as homeMessages } from '../core/messages/home'
import { Toolbar, ToolbarGroup } from '../ui/toolbar'
import type {
  ControlHome as HomeName,
  ControlHomeProps,
  ControlPresentation,
  HomePresentation,
} from './contract'
import { ControlPresentationContext } from './control-view'

/** The presentation of every home. The contract's `HomePresentation` pins each entry. */
export const HOME_PRESENTATION = {
  'page-bar': 'pill',
  'section-header': 'pill',
  'view-mode': 'pill',
  'card-header': 'inline',
  tool: 'inline',
  'form-row': 'row',
  aside: 'row',
  sheet: 'row',
  'side-panel': 'row',
  overlay: 'row',
} as const satisfies HomePresentation

/** Homes whose controls share a toolbar row with buttons, and so draw through `ToolbarGroup`. */
const TOOLBAR_HOMES: ReadonlySet<HomeName> = new Set<HomeName>(['view-mode', 'tool'])

/** `true` inside `FoldedControls`: a home there keeps the row form whatever its own presentation. */
const FoldedContext = createContext(false)

/** The presentation a home gives its controls, outside any fold. */
export function presentationOf(home: HomeName): ControlPresentation {
  return HOME_PRESENTATION[home]
}

const FRAME: Record<ControlPresentation, string> = {
  pill: 'flex min-w-0 max-w-full flex-wrap items-center gap-2',
  inline: 'flex min-w-0 max-w-full flex-wrap items-center gap-1.5',
  row: 'flex w-full min-w-0 flex-col gap-4',
}

/** The `data-slot` of each presentation's frame. */
const SLOT: Record<ControlPresentation, string> = {
  pill: 'filter-pill',
  inline: 'filter-inline',
  row: 'filter-row',
}

/**
 * Hosts controls and gives them the presentation of its `home`. A `FilterSet` or a `filterSlot`
 * inside reads it; with no home around, a control is a `pill`. A home with nothing to draw renders
 * nothing, so an empty slot leaves no gap.
 *
 * @useWhen you place controls in a surface that is not a slot of a composite (an aside, a sheet, a toolbar)
 * @neverWhen you want a different look for one control: the home decides the look, never a prop
 *
 * @example
 * <ControlHome home="aside">{filterSlot([spec(overview.field.q, 'Search')]).render()}</ControlHome>
 */
export function ControlHome({ home, children }: ControlHomeProps): ReactElement | null {
  const t = useMessages(homeMessages)
  const folded = use(FoldedContext)
  if (Children.toArray(children).length === 0) return null
  const presentation = folded ? 'row' : presentationOf(home)
  const toolbar = TOOLBAR_HOMES.has(home) && !folded
  return (
    <ControlPresentationContext value={presentation}>
      {toolbar ? (
        <Toolbar
          aria-label={t('home.filters')}
          data-home={home}
          className="min-h-0 min-w-0 max-w-full empty:hidden"
        >
          <ToolbarGroup className="h-auto min-w-0 max-w-full flex-wrap gap-2 empty:hidden">
            {children}
          </ToolbarGroup>
        </Toolbar>
      ) : (
        <fieldset
          data-slot={SLOT[presentation]}
          data-home={home}
          aria-label={t('home.filters')}
          className={cn('m-0 border-0 p-0 empty:hidden', FRAME[presentation])}
        >
          {children}
        </fieldset>
      )}
    </ControlPresentationContext>
  )
}

/**
 * The `row` form for controls a fold moves into a popover or a sheet. A `ControlHome` inside keeps
 * it, so a pill never renders nested in another pill's popup.
 *
 * @example
 * <PopoverContent aria-label="Filters"><FoldedControls>{slot.render()}</FoldedControls></PopoverContent>
 */
export function FoldedControls({ children }: { children?: ReactNode }): ReactElement {
  return (
    <FoldedContext value>
      <ControlPresentationContext value="row">{children}</ControlPresentationContext>
    </FoldedContext>
  )
}
