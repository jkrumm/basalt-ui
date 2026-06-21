/**
 * Basalt query client — configure once, share via router context.
 * Extend staleTime / gcTime defaults and add per-query error handling here.
 *
 * Scaffold written by `basalt init`. This file is yours — `basalt sync` will not overwrite it.
 */
import { createBasaltQueryClient } from 'basalt-ui/query'

export const queryClient = createBasaltQueryClient({
  // staleTime: 60_000,   // optional: global cache freshness window (ms)
  // gcTime: 5 * 60_000,  // optional: inactive-query garbage-collection window (ms)
})
