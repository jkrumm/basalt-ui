/**
 * Internal — `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * The standard isomorphic pattern, so an SSR render never trips React's "useLayoutEffect does
 * nothing on the server" warning. The branch reads a global that cannot change between renders, so
 * the hook identity is stable across every render of every caller.
 *
 * Lives in `common/` rather than beside the shell because both halves use it — the shell chrome, the
 * provider, and the Mantine-free measured-fold core — and `common/` is the one module both may
 * import from. One module rather than one `const` per file. Not exported from any barrel; import it
 * by path.
 */
import { useEffect, useLayoutEffect } from 'react'

export const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
