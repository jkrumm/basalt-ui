import { useLayoutEffect, useState } from 'react'

/**
 * One Retry for frames that share a source. Internal: no barrel exports it.
 *
 * The shared source is the `retry` function itself (the one `Phase` object a page hands to every
 * frame, or the stable wrapper `resolvePhase` makes per query `refetch`). Of the frames whose error
 * arm shows the same `retry`, the first to mount draws the button and the rest draw their message
 * alone; when the owner unmounts the next one takes over. A `ChartCard` takes no part: a card holding a
 * query is read alone (its own shot, its own corner of the page), so its error arm always draws Retry.
 */
type Member = (owner: boolean) => void

const groups = new WeakMap<() => void, Member[]>()

function sync(members: readonly Member[]): void {
  members.forEach((set, i) => {
    set(i === 0)
  })
}

/**
 * True when this frame draws the Retry. A frame with no retry, or none beside it, is its own
 * owner. The registration is a layout effect, so the first client paint already shows one button;
 * a server render has no layout effects, so its HTML carries every frame's button until hydration.
 *
 * @example
 * const showRetry = useRetryOwner(resolved.retry)
 */
export function useRetryOwner(retry: (() => void) | undefined): boolean {
  const [owner, setOwner] = useState(true)
  useLayoutEffect(() => {
    if (retry === undefined) return undefined
    const members = groups.get(retry) ?? []
    groups.set(retry, members)
    members.push(setOwner)
    sync(members)
    return () => {
      members.splice(members.indexOf(setOwner), 1)
      sync(members)
    }
  }, [retry])
  return retry === undefined || owner
}
