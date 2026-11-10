// Must be the FIRST import of every entry point. router-core's `isServer` flag is a module-level
// constant: in Node it resolves to `true` (so `navigate` is a no-op) unless NODE_ENV is `test`,
// where it falls back to the router option and `typeof document`. The harness drives a client
// router without a DOM, so it needs the second reading.
process.env['NODE_ENV'] = 'test'
