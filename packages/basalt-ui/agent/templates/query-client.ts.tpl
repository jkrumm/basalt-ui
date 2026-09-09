/**
 * Basalt query client — configure once, share via router context.
 * Extend staleTime / gcTime defaults and add per-query error handling here.
 *
 * A FACTORY, not a module-level singleton, and that is load-bearing under SSR: a
 * `export const queryClient = createBasaltQueryClient()` is created once per PROCESS,
 * so every request a Node server handles shares one cache — one user's data served to
 * the next. Call `makeQueryClient()` once per request on the server, and once at module
 * scope in a browser-only entry:
 *
 *   // main.tsx (CSR) — one client for the tab's lifetime
 *   const queryClient = makeQueryClient()
 *
 *   // an SSR/prerender entry — one per request, never hoisted
 *   const queryClient = makeQueryClient()
 *
 * Scaffold written by `basalt-ui init`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import { createBasaltQueryClient } from 'basalt-ui'

export function makeQueryClient() {
  return createBasaltQueryClient({
    // staleTime: 60_000,   // optional: global cache freshness window (ms)
    // gcTime: 5 * 60_000,  // optional: inactive-query garbage-collection window (ms)
  })
}
