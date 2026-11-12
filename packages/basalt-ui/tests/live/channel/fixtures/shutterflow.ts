/** Five named events, a named heartbeat on every tick, no ids, no cursor: the shape of a broadcast feed. */
export const SHUTTERFLOW_EVENTS = [
  'progress',
  'index-changed',
  'job',
  'cloud-session',
  'library-changed',
] as const

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
const beat = frame('heartbeat', {})

export const SHUTTERFLOW_FIRST = [
  beat,
  frame('progress', { job: 1, done: 3, total: 10 }),
  beat,
  frame('index-changed', { scope: 'library' }),
  frame('job', { job: 1, state: 'running' }),
  beat,
  frame('cloud-session', { step: 'sso' }),
  frame('library-changed', { added: 2 }),
]
