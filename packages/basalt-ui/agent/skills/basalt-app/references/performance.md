# Performance: bars per route, the compiler check, DevTools

Gate counts and bytes, never milliseconds: a millisecond changes with the machine, a byte or a React commit does not. basalt-ui gates its own bytes and commit counts; your app owns the bars for its routes.

## Per-route bars

A route's first load is the static closure of its `dist/*.html`: the scripts, modulepreloads and stylesheets it names, then the static `import` edges of each chunk. A dynamic `import()` is not first load. Measure after `vite build` with default-level gzip and fail past a ceiling per route.

```ts
// scripts/check-route-bars.ts
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const BARS = { 'index.html': { jsGzipMax: 80 * 1024, cssGzipMax: 30 * 1024, maxScripts: 2 } }
const REF = /(?:href|src)="(\/[^"]+\.(?:js|css))"|(?:from|import)\s*"(\.{1,2}\/[^"]+\.js)"/g

function closure(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen
  seen.add(file)
  if (file.endsWith('.css')) return seen
  for (const m of readFileSync(file, 'utf8').matchAll(REF)) {
    closure(m[1] ? join('dist', m[1]) : resolve(dirname(file), m[2]!), seen)
  }
  return seen
}

for (const [page, bar] of Object.entries(BARS)) {
  const files = [...closure(join('dist', page))]
  const of = (ext: string) => files.filter((f) => f.endsWith(ext))
  const gz = (list: string[]) => list.reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0)
  if (
    gz(of('.js')) > bar.jsGzipMax ||
    gz(of('.css')) > bar.cssGzipMax ||
    of('.js').length > bar.maxScripts
  ) {
    throw new Error(`${page} is over its bar`)
  }
}
```

Seed each bar at the first measurement plus 5 %, rounded up to 0.5 KB; ratchet it down when a route gets lighter; raise it only for a named reason, in the same commit. A page that ships no script sets `maxScripts: 0`.

## Is the React Compiler on?

basalt-ui ships uncompiled and compiler-clean; compiling is your Vite config (`plugins: [react(), babel({ presets: [reactCompilerPreset()] }), basalt()]`, `@rolldown/plugin-babel`). Check the output, not the config: compiled code carries the memo cache.

```sh
grep -rl 'react.memo_cache_sentinel' dist/assets || { echo 'React Compiler is not active'; exit 1; }
```

With it on, write no `useMemo`, `useCallback` or `memo` for speed.

## Find a slow route in DevTools

1. Profile a production build (`vite preview`); a dev build double-renders.
2. React DevTools Profiler, "Record why each component rendered": navigate once, stop. The commit list is the number a test can gate; the flame bar names the changed prop or hook.
3. A card that commits on every tick without its figure changing: state derived from a query in an effect, an inline object or function prop, or a context value rebuilt each render.
4. Chrome Performance with 4x CPU throttle: read Long Tasks, not the average frame.
5. Pin the fix with a test: `<Profiler onRender>` around the subtree, the event under `act`, a whole-number ceiling at the first measurement plus 5 %.
