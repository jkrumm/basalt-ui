import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings `./page` prints itself. `page.toc` titles the table of contents, `page.tocTrigger` is
 * the button that opens it below 1200px, `page.progress` names the reading-progress bar.
 */
export type PageMessages = Record<
  'page.toc' | 'page.tocTrigger' | 'page.progress' | 'page.previous' | 'page.next',
  string
> &
  Record<'page.minRead', (f: Format, minutes: number) => string>

export const page = {
  'page.toc': 'On this page',
  'page.tocTrigger': 'On this page',
  'page.progress': 'Reading progress',
  'page.previous': 'Previous',
  'page.next': 'Next',
  'page.minRead': (f, minutes) => `${f.number(minutes)} min read`,
} satisfies Partial<BasaltMessages>
