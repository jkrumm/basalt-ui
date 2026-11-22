import { home } from './messages/home'
import { useMessages } from './messages/use-messages'

/** The word of every Retry in the page and chart kits: the one reader of the key, so a localised app changes it once. */
export const RETRY_KEY = 'home.retry' as const satisfies keyof typeof home

/** The Retry button's word, with the app's override applied. Internal: no barrel exports it. */
export function useRetryLabel(): string {
  return useMessages(home)(RETRY_KEY)
}
