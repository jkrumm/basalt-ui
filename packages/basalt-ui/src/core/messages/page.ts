import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings `./page` prints itself. `page.toc` titles the table of contents, `page.tocTrigger` is
 * the button that opens it below 1200px, and
 * `page.kind*` name a title-less callout's kind for assistive tech, and `page.moreActions`
 * `page.closeAside` and `page.backToList` name the page bar's overflow button, the aside's close button, `page.closePeek` a `Peek`'s, and a split page's way back to its list, `page.openFullPage` names a `Peek`'s link to the record's own page, and `page.itemAttention` and `page.itemActions` name an `InnerNav` item's dot
 * and its actions menu.
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
  | 'page.closeAside'
  | 'page.closePeek'
  | 'page.openFullPage'
  | 'page.backToList'
  | 'page.itemAttention',
  string
> &
  Record<'page.minRead', (f: Format, minutes: number) => string> &
  Record<'page.itemActions', (f: Format, label: string) => string>

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
  'page.closeAside': 'Close panel',
  'page.closePeek': 'Close panel',
  'page.openFullPage': 'Open full page',
  'page.backToList': 'Back',
  'page.itemAttention': 'Needs attention',
  'page.itemActions': (_f, label) => `Actions for ${label}`,
  'page.minRead': (f, minutes) => `${f.number(minutes)} min read`,
} satisfies Partial<BasaltMessages>
