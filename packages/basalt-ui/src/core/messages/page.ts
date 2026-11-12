import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings `./page` prints itself. `page.toc` titles the table of contents, `page.tocTrigger` is
 * the button that opens it below 1200px, `page.progress` names the reading-progress bar, and
 * `page.kind*` name a title-less callout's kind for assistive tech, and `page.refresh`,
 * `page.moreActions` and `page.closeAside` name the page bar's refresh and overflow buttons and the
 * aside's close button.
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
  | 'page.refresh'
  | 'page.moreActions'
  | 'page.closeAside',
  string
> &
  Record<'page.minRead', (f: Format, minutes: number) => string>

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
  'page.refresh': 'Refresh',
  'page.moreActions': 'More actions',
  'page.closeAside': 'Close panel',
  'page.minRead': (f, minutes) => `${f.number(minutes)} min read`,
} satisfies Partial<BasaltMessages>
