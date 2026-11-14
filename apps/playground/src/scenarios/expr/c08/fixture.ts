/**
 * One slow agent run as a span tree, in tree order (a parent precedes its children). Times are
 * milliseconds from the run's start; the run has no wall clock, so the fixture needs no "today".
 * The extremes are on screen at rest: `web_search` holds half the run, `cache_lookup` lasts 0 ms,
 * and `execute` is the one step that failed.
 */
export type SpanKind = 'model' | 'tool' | 'retrieval'

export type Span = {
  id: string
  name: string
  kind: SpanKind
  depth: number
  startMs: number
  durationMs: number
  status: 'ok' | 'error'
  /** The step the failure started in; its ancestors carry `error` too but are not the cause. */
  cause?: string
  /** The cause in a word or two, printed on the bar. */
  causeShort?: string
  tokens: number
}

export const SPANS: readonly Span[] = [
  {
    id: 'plan',
    name: 'plan',
    kind: 'model',
    depth: 0,
    startMs: 0,
    durationMs: 1180,
    status: 'ok',
    tokens: 2140,
  },
  {
    id: 'retrieve',
    name: 'retrieve_context',
    kind: 'retrieval',
    depth: 0,
    startMs: 1180,
    durationMs: 960,
    status: 'ok',
    tokens: 0,
  },
  {
    id: 'embed',
    name: 'embed_query',
    kind: 'retrieval',
    depth: 1,
    startMs: 1180,
    durationMs: 140,
    status: 'ok',
    tokens: 38,
  },
  {
    id: 'vector',
    name: 'vector_search',
    kind: 'retrieval',
    depth: 1,
    startMs: 1320,
    durationMs: 820,
    status: 'ok',
    tokens: 0,
  },
  {
    id: 'web',
    name: 'web_search',
    kind: 'tool',
    depth: 0,
    startMs: 2140,
    durationMs: 4180,
    status: 'ok',
    tokens: 0,
  },
  {
    id: 'cache',
    name: 'cache_lookup',
    kind: 'tool',
    depth: 1,
    startMs: 2140,
    durationMs: 0,
    status: 'ok',
    tokens: 0,
  },
  {
    id: 'fetch',
    name: 'fetch_results',
    kind: 'tool',
    depth: 1,
    startMs: 2140,
    durationMs: 3560,
    status: 'ok',
    tokens: 0,
  },
  {
    id: 'rerank',
    name: 'rerank',
    kind: 'model',
    depth: 1,
    startMs: 5700,
    durationMs: 620,
    status: 'ok',
    tokens: 1320,
  },
  {
    id: 'sql',
    name: 'query_sql',
    kind: 'tool',
    depth: 0,
    startMs: 6320,
    durationMs: 540,
    status: 'error',
    tokens: 0,
  },
  {
    id: 'connect',
    name: 'connect',
    kind: 'tool',
    depth: 1,
    startMs: 6320,
    durationMs: 40,
    status: 'ok',
    tokens: 0,
  },
  {
    id: 'execute',
    name: 'execute',
    kind: 'tool',
    depth: 1,
    startMs: 6360,
    durationMs: 500,
    status: 'error',
    cause: 'statement timeout after 500 ms',
    causeShort: 'timeout',
    tokens: 0,
  },
  {
    id: 'answer',
    name: 'answer',
    kind: 'model',
    depth: 0,
    startMs: 6860,
    durationMs: 1260,
    status: 'ok',
    tokens: 3410,
  },
]

/** The run's length: the end of the last span, so any fixture fits its axis. */
export const RUN_MS = Math.max(...SPANS.map((s) => s.startMs + s.durationMs))
