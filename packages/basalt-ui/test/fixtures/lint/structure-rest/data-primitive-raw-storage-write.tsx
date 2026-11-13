// Blocks: see colour-literal.tsx. `// @ts` blocks run under oxlint only (they need a TS
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
