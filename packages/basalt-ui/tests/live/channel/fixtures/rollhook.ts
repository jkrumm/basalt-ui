/** A log stream: bare `data:` lines, no event name, `[DONE]` ends it and nothing reconnects. */
export const ROLLHOOK_LOG = [
  'data: step 1\n\n',
  'data: step 2\n\n',
  'data: [DONE]\n\n',
  'data: after\n\n',
]
export const isDone = (raw: { data: string }) => raw.data === '[DONE]'
