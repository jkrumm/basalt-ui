#!/usr/bin/env node
// Dist-layering guard: walks the built dist/ graph of the Mantine-free subpaths and
// fails on any @mantine/* (and @visx/* where forbidden) import reachable from them, and
// asserts the root barrel (dist/index.js) never RE-EXPORTS the ./charts or ./tokens entry
// (provider/theme legitimately deep-import ../charts/theme + ../tokens in their OWN files —
// those never surface through the barrel, so this guard does not see them).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const DIST = resolve(process.cwd(), 'dist')
let failed = false
const fail = (msg) => {
  console.error('GUARD FAIL:', msg)
  failed = true
}

// All relative + bare specifiers in a JS module (from '…' | import('…') | import '…').
function specifiers(file) {
  const src = readFileSync(file, 'utf8')
  const re = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g
  const out = []
  let m
  while ((m = re.exec(src))) out.push(m[1])
  return out
}

// Transitive graph over relative specifiers; collects the bare (external) specifiers reached.
function walkGraph(entry) {
  const seen = new Set()
  const bare = new Set()
  const stack = [entry]
  while (stack.length) {
    const file = stack.pop()
    if (seen.has(file)) continue
    seen.add(file)
    for (const spec of specifiers(file)) {
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

// Mantine-free Layer-0 + root-reachable subpath dist entries.
// visx is allowed ONLY inside the charts graph.
const subpaths = [
  { rel: 'tokens/index.js', banVisx: true },
  { rel: 'charts/index.js', banVisx: false },
  { rel: 'guard/index.js', banVisx: true },
  { rel: 'state.js', banVisx: true },
  { rel: 'query/index.js', banVisx: true },
]
for (const { rel, banVisx } of subpaths) {
  const entry = resolve(DIST, rel)
  if (!existsSync(entry)) {
    fail(`missing dist entry: ${rel}`)
    continue
  }
  const { files, bare } = walkGraph(entry)
  for (const spec of bare) {
    if (spec.startsWith('@mantine/')) fail(`${rel} graph reaches Mantine import: ${spec}`)
    if (banVisx && spec.startsWith('@visx/')) fail(`${rel} graph reaches visx import: ${spec}`)
  }
  if (!failed) console.log(`Mantine-free OK: ${rel} (${files.size} files in graph)`)
}

// Root-barrel re-export guard.
const barrel = resolve(DIST, 'index.js')
if (!existsSync(barrel)) {
  fail('missing dist/index.js')
} else {
  for (const spec of specifiers(barrel)) {
    if (
      /(^|\/)(charts|tokens)(\/index)?\.js$/.test(spec) ||
      spec === './charts' ||
      spec === './tokens'
    )
      fail(`root barrel re-exports a free-layer entry: ${spec}`)
    if (spec.startsWith('@mantine/') || spec.startsWith('@visx/'))
      fail(`root barrel directly imports ${spec}`)
  }
  if (!failed) console.log('root-barrel re-export guard OK')
}

if (failed) {
  console.error('DIST LAYERING GUARD FAILED')
  process.exit(1)
}
console.log('dist layering guard PASSED')
