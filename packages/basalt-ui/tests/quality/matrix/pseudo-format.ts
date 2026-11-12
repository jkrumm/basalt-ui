/** Stands in for the playground's `demo/page-format` in the pseudo-locale bundle (see harness.ts). */
import { pseudoMessages } from './pseudo-messages'

export const PAGE_FORMAT = {
  locale: 'en-GB',
  timeZone: 'UTC',
  messages: pseudoMessages(),
} as const
