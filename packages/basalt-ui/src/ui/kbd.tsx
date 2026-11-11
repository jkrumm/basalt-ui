import { cva } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'
import { useSyncExternalStore } from 'react'
import { cn } from '../core/cn'

/**
 * The `Kbd` cva table: one key cap, a hairline-bordered chip at the smallest text step. No axes.
 *
 * @example
 * kbdVariants() // class string for a hand-built key cap
 */
export const kbdVariants = cva(
  'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-inset px-1 font-sans text-micro font-medium whitespace-nowrap text-muted-foreground',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const kbdParts = ['kbd'] as const

const subscribe = (): (() => void) => () => undefined

function isApple(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform
  return /mac|iphone|ipad/i.test(platform ?? navigator.userAgent)
}

/** Whether this is an Apple platform. The server and the first client render say no, so hydration matches. */
const useApple = (): boolean => useSyncExternalStore(subscribe, isApple, () => false)

export type KbdProps = Omit<ComponentProps<'kbd'>, 'className' | 'children'> & {
  /** Layout only (`ml-auto`). */
  className?: string
  /** The key: `K`, `Enter`, `Esc`. `Mod` is the platform's command key: `⌘` on Apple, `Ctrl` elsewhere. */
  children: string
}

/**
 * One key of a shortcut. Put a combination in one `Kbd` per key.
 *
 * @example
 * <Kbd>Mod</Kbd><Kbd>K</Kbd>
 */
export function Kbd({ children, className, ...props }: KbdProps): ReactElement {
  const apple = useApple()
  return (
    <kbd {...props} data-slot="kbd" className={cn(kbdVariants(), className)}>
      {children === 'Mod' ? (apple ? '⌘' : 'Ctrl') : children}
    </kbd>
  )
}
