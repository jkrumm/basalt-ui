/**
 * Internal — `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * The standard isomorphic pattern, so an SSR render never trips React's "useLayoutEffect does
 * nothing on the server" warning. The branch reads a global that cannot change between renders, so
 * the hook identity is stable across every render of every caller.
 *
 * One module rather than one `const` per file: `page-bar.tsx` and `page-aside.tsx` declared the
 * same line with the same doc, and the second copy's doc already said "see `page-bar.tsx`'s copy".
 * Not exported from any barrel — this is a shell-internal utility, not a published hook.
 */
import { useEffect, useLayoutEffect } from 'react'

export const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
