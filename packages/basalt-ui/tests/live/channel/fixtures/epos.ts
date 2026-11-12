/** A per-resource stream: ids, a named `end` event; a cursor the server no longer holds answers 410. */
export const EPOS_STREAM = [
  'event: message\nid: 1\ndata: {"text":"one"}\n\n',
  'event: message\nid: 2\ndata: {"text":"two"}\n\n',
  'event: end\ndata: {}\n\n',
]
export const EPOS_AFTER_RESET = [
  'event: message\nid: 10\ndata: {"text":"fresh"}\n\n',
  'event: end\ndata: {}\n\n',
]
