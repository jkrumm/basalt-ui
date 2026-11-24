// Blocks: see color-literal.tsx. `// @ts` blocks run under oxlint only (they need a TS
// parser); the plain import is the same ImportSpecifier and runs under both hosts.

// @invalid
localStorage.setItem('theme', 'dark')

// @invalid
window.localStorage.removeItem('compact')

// @invalid
sessionStorage.clear()

// @invalid
localStorage.compact = '1'

// @invalid
window.sessionStorage['draft'] = text

// @valid
const compact = localStorage.getItem('compact')

// @valid
const store = createPersistedState({ key: 'basalt:compact', version: 1 })

// @valid
import { StorageLike } from 'basalt-ui'
export const adapter = { set: (key, value) => localStorage.setItem(key, value) }

// @valid
// @ts
import type { StorageLike } from 'basalt-ui'
localStorage.removeItem('x')

// @valid
// @ts
import { type StorageLike } from 'basalt-ui'
localStorage.removeItem('y')

// @valid
// @filename recipes/remembered-values.test.ts
localStorage.setItem('theme', 'dark')

// @valid
// @filename recipes/remembered-values.spec.tsx
window.sessionStorage.clear()

// @invalid
// @filename recipes/remembered-values.ts
localStorage.setItem('theme', 'dark')

// @invalid
// @filename recipes/test-utils.ts
localStorage.setItem('theme', 'dark')

// @invalid
const store = window.localStorage
store.setItem('view', v)

// @invalid
const local = localStorage
local.removeItem('view')

// @invalid
const session = globalThis.sessionStorage
session.clear()

// @invalid
const store = localStorage
store.compact = '1'

// @valid
const store = window.localStorage
const view = store.getItem('view')

// @valid
const cache = new Map()
cache.setItem('view', v)

// @valid
let store = other
store = localStorage
store.setItem('view', v)

// @valid
const store = createStore()
store.clear()

// @invalid
const guarded = typeof window !== 'undefined' ? window.localStorage : null
guarded?.setItem('density', d)

// @valid
const guarded = typeof window !== 'undefined' ? window.localStorage : null
const density = guarded?.getItem('density')
