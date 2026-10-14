/**
 * What the fixture and the `ssr` lane agree on — no dependencies, so the lane (and its unit tests) can
 * import it without resolving React.
 */

/** Artificial loader latency per streamed section, in ms. The lane reads these back as the floor. */
export const SECTION_DELAYS_MS = { kpis: 150, trend: 300, mix: 450, table: 600 } as const
export type SectionKey = keyof typeof SECTION_DELAYS_MS
export const SECTION_KEYS = Object.keys(SECTION_DELAYS_MS) as SectionKey[]

/** Markers the lane reads: the shell element, and one per section once its content is in. */
export const SHELL_ATTR = 'data-ssr-shell'
export const READY_ATTR = 'data-ssr-ready'
export const FALLBACK_ATTR = 'data-ssr-fallback'
/** Performance marks the client entry and the app emit. */
export const MARK_HYDRATE_START = 'ssr-hydrate-start'
export const MARK_HYDRATE_END = 'ssr-hydrate-end'
