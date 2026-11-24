import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings `./page` prints itself. `page.toc` titles the table of contents, `page.tocTrigger` is
 * the button that opens it below 1200px, and
 * `page.kind*` name a title-less callout's kind for assistive tech, and `page.moreActions`
 * `page.closeAside` and `page.backToList` name the page bar's overflow button, `page.recordActions` a panel header's, the aside's close button, `page.closePeek` a `Peek`'s or `Dock`'s, `page.pinPanel` a `Peek`'s dock button, `page.resizePeek` the label of its width handle, `page.resizeList` a split page's list handle, and a split page's way back to its list, `page.openFullPage` names a `Peek`'s link to the record's own page, `page.previousRecord` and `page.nextRecord` a panel's steps through its opener's records, `page.closeRecord` a routed record page's close back to its list, `page.openAs` and `page.present*` the presentation menu, `page.minimise` and `page.restore` a window's, and `page.itemAttention` and `page.itemActions` name an `InnerNav` item's dot
 * and its actions menu, `page.favorite` and `page.unfavorite` the favorite star's action, and `page.propertyEdit`, `page.propertyEmpty`, `page.propertyInvalid` and `page.propertyRange` name
 * a `PropertyList` row's edit button, its unset value and its two validation errors.
 */
export type PageMessages = Record<
  | 'page.toc'
  | 'page.tocTrigger'
  | 'page.previous'
  | 'page.next'
  | 'page.kindInfo'
  | 'page.kindGood'
  | 'page.kindWarn'
  | 'page.kindBad'
  | 'page.moreActions'
  | 'page.recordActions'
  | 'page.closeAside'
  | 'page.closePeek'
  | 'page.pinPanel'
  | 'page.resizePeek'
  | 'page.resizeList'
  | 'page.openFullPage'
  | 'page.backToList'
  | 'page.closeRecord'
  | 'page.itemAttention'
  | 'page.previousRecord'
  | 'page.nextRecord'
  | 'page.openAs'
  | 'page.presentPeek'
  | 'page.presentWindow'
  | 'page.presentPage'
  | 'page.minimise'
  | 'page.restore'
  | 'page.propertyEmpty'
  | 'page.propertyInvalid'
  | 'page.favorite'
  | 'page.unfavorite',
  string
> &
  Record<'page.minRead', (f: Format, minutes: number) => string> &
  Record<'page.itemActions' | 'page.propertyEdit', (f: Format, label: string) => string> &
  Record<'page.propertyRange', (f: Format, min: number, max: number) => string>

export const page = {
  'page.toc': 'On this page',
  'page.tocTrigger': 'On this page',
  'page.previous': 'Previous',
  'page.next': 'Next',
  'page.kindInfo': 'Info',
  'page.kindGood': 'Success',
  'page.kindWarn': 'Warning',
  'page.kindBad': 'Error',
  'page.moreActions': 'More actions',
  'page.recordActions': 'More actions',
  'page.closeAside': 'Close panel',
  'page.closePeek': 'Close panel',
  'page.pinPanel': 'Dock panel',
  'page.resizePeek': 'Resize panel',
  'page.resizeList': 'Resize the list',
  'page.openFullPage': 'Open full page',
  'page.backToList': 'Back',
  'page.closeRecord': 'Close record',
  'page.itemAttention': 'Needs attention',
  'page.previousRecord': 'Previous record',
  'page.nextRecord': 'Next record',
  'page.openAs': 'Open as',
  'page.presentPeek': 'Side panel',
  'page.presentWindow': 'Window',
  'page.presentPage': 'Full page',
  'page.minimise': 'Minimise',
  'page.restore': 'Restore',
  'page.favorite': 'Add to favorites',
  'page.unfavorite': 'Remove from favorites',
  'page.itemActions': (_f, label) => `Actions for ${label}`,
  'page.propertyEdit': (_f, label) => `Edit ${label}`,
  'page.propertyEmpty': 'Not set',
  'page.propertyInvalid': 'Error: this value is not valid.',
  'page.propertyRange': (f, min, max) =>
    `Error: enter a number from ${f.number(min)} to ${f.number(max)}.`,
  'page.minRead': (f, minutes) => `${f.number(minutes)} min read`,
} satisfies Partial<BasaltMessages>
