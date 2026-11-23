#!/usr/bin/env node
// Dist-layering guard: walks the built dist/ graph of the UI-free subpaths and
// fails on any 2.x UI-stack or @visx/* import reachable from them, holds the ./charts graph to its
// docs/V2-SPEC.md § 9.8 import set (the engine's subpaths, d3-scale, react), and asserts the root
// barrel (dist/index.js) never RE-EXPORTS the ./charts or ./tokens entry.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const DIST = resolve(process.cwd(), 'dist')
let failed = false
const fail = (msg) => {
  console.error('GUARD FAIL:', msg)
  failed = true
}

// `from` / `import` as a KEYWORD only: never after a quote, dot, word char or `$`, so the string
// "from" in `{ y1: "from", y2: "to" }` or a `.from(…)` call is not an import clause.
const SPECIFIER = /(?<![\w$.'"])(?:from|import)\b\s*\(?\s*['"]([^'"]+)['"]/g
const matchSpecifiers = (src) => [...src.matchAll(SPECIFIER)].map((m) => m[1])

// Self-check: the keyword forms match, a string that merely says "from" does not.
const sample = [
  [`import { a } from "./a.js"`, ['./a.js']],
  [`export * from '../b.js'`, ['../b.js']],
  [`import "./side.js"`, ['./side.js']],
  [`const m = await import("@tanstack/charts/line")`, ['@tanstack/charts/line']],
  [`rect(r, { y1: "from", y2: "to" })`, []],
  [`rect(r, { y1: 'from', y2: 'to' })`, []],
  [`Array.from("abc")`, []],
]
for (const [src, want] of sample) {
  if (JSON.stringify(matchSpecifiers(src)) !== JSON.stringify(want))
    throw new Error(`check-dist-layering self-check failed on: ${src}`)
}

// All relative + bare specifiers in a JS module (from '…' | import('…') | import '…').
const specifiers = (file) => matchSpecifiers(readFileSync(file, 'utf8'))

// The STATIC ones only: `from '…'` and `import '…'`, never `import('…')`. A dynamic import is a lazy
// edge, so it is not part of what a consumer's bundle loads up front.
const STATIC_SPECIFIER = /(?<![\w$.'"])(?:from\b\s*|import\b\s*(?!\())['"]([^'"]+)['"]/g
const staticSpecifiers = (file) =>
  [...readFileSync(file, 'utf8').matchAll(STATIC_SPECIFIER)].map((m) => m[1])
for (const [src, want] of [
  [`import { a } from "./a.js"`, ['./a.js']],
  [`import "./side.js"`, ['./side.js']],
  [`const m = await import("react-day-picker")`, []],
  [`export * from '../b.js'`, ['../b.js']],
]) {
  if (JSON.stringify([...src.matchAll(STATIC_SPECIFIER)].map((m) => m[1])) !== JSON.stringify(want))
    throw new Error(`check-dist-layering static self-check failed on: ${src}`)
}

// Transitive graph over relative specifiers; collects the bare (external) specifiers reached.
// `staticOnly` follows and reports static imports only.
function walkGraph(entry, { staticOnly = false } = {}) {
  const seen = new Set()
  const bare = new Set()
  const stack = [entry]
  while (stack.length) {
    const file = stack.pop()
    if (seen.has(file)) continue
    seen.add(file)
    for (const spec of staticOnly ? staticSpecifiers(file) : specifiers(file)) {
      if (spec.startsWith('./') || spec.startsWith('../')) {
        const target = resolve(dirname(file), spec)
        if (existsSync(target)) stack.push(target)
      } else {
        bare.add(spec)
      }
    }
  }
  return { files: seen, bare }
}

// UI-free Layer-0 subpath dist entries (2.0: `./agent` left the set — the chat UI ships in it; its runtime
// half stays UI-free as a repo-local lint boundary).
// visx is gone (2.0): banned on every graph. `onlyBare` pins a graph's external imports to a set.
// The v3 `ChartCard` (v3 state-1 wiring) composes `ui/badge` (cva + `cn`, no Base UI) and `cn`'s `clsx`.
const CHART_BARE = [
  /^@tanstack\/charts\//,
  /^d3-scale$/,
  /^react(\/jsx-runtime)?$/,
  /^basalt-ui\/ui\/badge$/,
  /^clsx$/,
]
const subpaths = [{ rel: 'tokens/index.js' }, { rel: 'charts/index.js', onlyBare: CHART_BARE }]
for (const { rel, onlyBare } of subpaths) {
  const entry = resolve(DIST, rel)
  if (!existsSync(entry)) {
    fail(`missing dist entry: ${rel}`)
    continue
  }
  const { files, bare } = walkGraph(entry)
  let subpathFailed = false
  for (const spec of bare) {
    if (spec.startsWith('@mantine/')) {
      fail(`${rel} graph reaches a 2.x UI-stack import: ${spec}`)
      subpathFailed = true
    }
    if (spec.startsWith('@visx/')) {
      fail(`${rel} graph reaches visx import: ${spec}`)
      subpathFailed = true
    }
    if (onlyBare && !spec.endsWith('.css') && !onlyBare.some((re) => re.test(spec))) {
      fail(`${rel} graph reaches ${spec}, outside its allowed import set`)
      subpathFailed = true
    }
  }
  if (!subpathFailed) console.log(`UI-free OK: ${rel} (${files.size} files in graph)`)
}

// An optional peer owned by one entry (`react-day-picker` by `ui/date-picker`, which `ui/calendar` shares
// through `ui/calendar-grid` inside the same `./ui/*` export, docs/v3/ARCHITECTURE.md section 3; `react-resizable-panels` by `ui/resizable`; `@atlaskit/pragmatic-drag-and-drop` by `ui/sortable-list`; `@tanstack/react-form` by `./form`;
// `@tanstack/react-hotkeys` by `./shell`, docs/v3/verdicts/tanstack-map.md). No other published entry may load it up front: every export of
// package.json except the owner's own export key is walked over its static imports (a dynamic
// `import()` is the lazy edge `./controls` may use), and the owner's dist file must still reach it,
// so this check cannot pass by walking the wrong files.
for (const { PEER, OWNER, EXPORT } of [
  { PEER: 'react-day-picker', OWNER: 'ui/date-picker.js', EXPORT: './ui/*' },
  { PEER: 'react-resizable-panels', OWNER: 'ui/resizable.js', EXPORT: './ui/*' },
  { PEER: '@atlaskit/pragmatic-drag-and-drop', OWNER: 'ui/sortable-list.js', EXPORT: './ui/*' },
  { PEER: '@tanstack/react-form', OWNER: 'form/index.js', EXPORT: './form' },
  { PEER: '@tanstack/react-hotkeys', OWNER: 'shell/index.js', EXPORT: './shell' },
]) {
  const exportsMap = JSON.parse(readFileSync(resolve(DIST, '..', 'package.json'), 'utf8')).exports
  const entries = new Set()
  for (const [key, value] of Object.entries(exportsMap)) {
    const target = typeof value === 'object' && value !== null ? value.import : undefined
    if (key === EXPORT || typeof target !== 'string' || !target.endsWith('.js')) continue
    if (!target.includes('*')) {
      entries.add(resolve(DIST, '..', target))
      continue
    }
    const dir = resolve(DIST, '..', target.slice(0, target.lastIndexOf('/')))
    if (existsSync(dir))
      for (const f of readdirSync(dir)) if (f.endsWith('.js')) entries.add(resolve(dir, f))
  }
  entries.add(resolve(DIST, 'index.js'))
  let eagerFailed = false
  let reached = 0
  for (const entry of entries) {
    if (!existsSync(entry)) continue
    const { bare } = walkGraph(entry, { staticOnly: true })
    reached += 1
    if ([...bare].some((spec) => spec === PEER || spec.startsWith(`${PEER}/`))) {
      fail(
        `${entry.slice(DIST.length + 1)} eagerly reaches ${PEER}, an optional peer of ${OWNER} alone`,
      )
      eagerFailed = true
    }
  }
  const owner = resolve(DIST, OWNER)
  if (!existsSync(owner)) {
    fail(`missing dist entry: ${OWNER}`)
  } else if (
    // The owner may load its peer lazily (`ui/sortable-list` imports the drag engine on first use).
    ![...walkGraph(owner).bare].some((spec) => spec === PEER || spec.startsWith(`${PEER}/`))
  ) {
    fail(`${OWNER} no longer reaches ${PEER}: the eager check above proves nothing`)
    eagerFailed = true
  }
  if (!eagerFailed)
    console.log(`optional peer OK: ${PEER} is in no eager graph (${reached} entries)`)
}

// Root-barrel re-export guard.
const barrel = resolve(DIST, 'index.js')
if (!existsSync(barrel)) {
  fail('missing dist/index.js')
} else {
  let barrelFailed = false
  for (const spec of specifiers(barrel)) {
    if (
      /(^|\/)(charts|tokens)(\/index)?\.js$/.test(spec) ||
      spec === './charts' ||
      spec === './tokens'
    ) {
      fail(`root barrel re-exports a free-layer entry: ${spec}`)
      barrelFailed = true
    }
    if (spec.startsWith('@mantine/') || spec.startsWith('@visx/')) {
      fail(`root barrel directly imports ${spec}`)
      barrelFailed = true
    }
  }
  if (!barrelFailed) console.log('root-barrel re-export guard OK')
}

if (failed) {
  console.error('DIST LAYERING GUARD FAILED')
  process.exit(1)
}
console.log('dist layering guard PASSED')
