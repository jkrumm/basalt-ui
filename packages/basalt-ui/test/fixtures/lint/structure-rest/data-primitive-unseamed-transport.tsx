// Blocks: see colour-literal.tsx. `// @ts` blocks need a TS parser and run under oxlint only;
// the plain import below is the same ImportSpecifier and runs under both hosts.

// @invalid
const source = new EventSource('/events')

// @invalid
const socket = new WebSocket('wss://example.com/live')

// @invalid
const source = new window.EventSource('/events')

// @invalid
import { createChannel } from 'basalt-ui'
const source = new globalThis.WebSocket(url)

// @valid
import { Transport } from 'basalt-ui'
const source = new EventSource('/events')

// @valid
// @ts
import type { Transport } from 'basalt-ui'
const socket = new WebSocket(url)

// @valid
// @ts
import { type Transport } from 'basalt-ui'
const socket = new WebSocket(url)

// @valid
import { Transport as BasaltTransport } from 'basalt-ui'
const socket = new WebSocket(url)

// @valid
const channel = createChannel({ transport, name: 'logs' })

// @valid
const source = new EventTarget()
