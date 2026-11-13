import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings `./page` prints itself. `page.toc` titles the table of contents, `page.tocTrigger` is
 * the button that opens it below 1200px, `page.progress` names the reading-progress bar, and
 * `page.kind*` name a title-less callout's kind for assistive tech, and `page.moreActions`
 * and `page.closeAside` name the page bar's overflow button and the aside's close button, and `page.itemAttention` and `page.itemActions` name an `InnerNav` item's dot
 * and its actions menu.
 */
export type PageMessages = Record<
  | 'page.toc'
  | 'page.tocTrigger'
  | 'page.progress'
  | 'page.previous'
  | 'page.next'
  | 'page.kindInfo'
  | 'page.kindGood'
  | 'page.kindWarn'
  | 'page.kindBad'
  | 'page.moreActions'
  | 'page.closeAside'
  | 'page.itemAttention',
  string
> &
  Record<'page.minRead', (f: Format, minutes: number) => string> &
  Record<'page.itemActions', (f: Format, label: string) => string>

export const page = {
  'page.toc': 'On this page',
  'page.tocTrigger': 'On this page',
  'page.progress': 'Reading progress',
  'page.previous': 'Previous',
  'page.next': 'Next',
  'page.kindInfo': 'Info',
  'page.kindGood': 'Success',
  'page.kindWarn': 'Warning',
  'page.kindBad': 'Error',
  'page.moreActions': 'More actions',
  'page.closeAside': 'Close panel',
  'page.itemAttention': 'Needs attention',
  'page.itemActions': (_f, label) => `Actions for ${label}`,
  'page.minRead': (f, minutes) => `${f.number(minutes)} min read`,
} satisfies Partial<BasaltMessages>
