# W1 evidence — v2-core (V2-SPEC § 1–7)

Base: `origin/master` @ `3f6e5fc`, produced 2026-10-13. No spike was needed. Every verdict rests on
the inventory below and on installed or packed sources.

## Inventory method

1. **1.41 surface.** The TypeScript 6.0.3 compiler API ran over the `src/` entry of every JS subpath
   in `packages/basalt-ui/package.json` `exports`. It lists each module export
   (`checker.getExportsOfModule`) and resolves aliases to classify value vs type. The run reproduces
   `scripts/export-surface.json` exactly (395 values) and adds the 517 barrel type exports. Script:
   `surface.ts` below.
2. **Consumers.** A regex scan found every `import`/`export … from 'basalt-ui[/…]'` (including
   `import type`, multi-line specifier lists and `as` renames) and every CSS `@import`.
   - Repos: argo, linewatch, weatherorb, rb, rollhook, basalt-ui-obsidian, email-gateway and
     image-gateway, files `*.{ts,tsx,mts,js,jsx,css}`.
   - Skipped: `node_modules`, `dist`, `build`, `.git`, `.claude` (agent worktrees) and `coverage`.
   - One count is one file. Every consumer import resolves to a 1.41 export (0 unmatched names).
   - `configs/*` references in JSON/YAML were found separately with grep.
   - Script: `scan.ts` below.
3. **Second pass: the import forms the first scan cannot see** (added after the lead's review).
   `scan-extra.ts` below matches `import('basalt-ui…')`, `require(…)`, `require.resolve(…)`,
   `export * [as X] from`, `import * as X from` (expanding to every `X.member`) and `vi.mock`/`jest.mock`
   across `*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}` with the same skip list.
   - Result: **0 hits** in the 300 files that mention `basalt-ui`. No verdict flips, so every count
     below and in V2-SPEC § 1 stands.
   - Cross-check: a plain `grep -rnE` for the same forms, including `.claude/` worktrees, also finds
     nothing. `*.{md,mdx,astro,vue,svelte,html}` hits are only the code snippets in four `DESIGN.md`
     files (argo, rb, basalt-ui-obsidian, image-gateway), which no bundler compiles; they are not counted.
4. **Join and verdicts.** Surface × consumers is joined per `(subpath, name)`. The default rules
   apply, plus the overrides recorded in the reason column of `docs/waves/v2-surface.md`.
   `apps/playground` is not scanned (charter 1).

Each consumer's `basalt-ui` pin at scan time:

| Consumer           | Pin                                                  |
| ------------------ | ---------------------------------------------------- |
| argo               | 1.41.0 at the root; `apps/dashboard` declares 1.36.0 |
| linewatch          | 1.41.0                                               |
| weatherorb         | 1.30.2                                               |
| rb                 | 1.41.0                                               |
| rollhook           | 1.36.0, imports only `basalt-ui/tokens.css` (no JS)  |
| basalt-ui-obsidian | 1.41.0                                               |
| email-gateway      | 1.36.0                                               |
| image-gateway      | 1.41.0                                               |

`configs/*` is referenced 13 times: `oxlint.json` ×7, `tsconfig.node.json` ×3,
`tsconfig.react-app.json` ×2, `tsconfig.base.json` ×1.

## Counts

- 912 rows: 395 values and 517 types.
- 107 names are exported from more than one subpath.
- 144 value rows have a consumer (43 of them `./charts`); 251 have none.
- 54 type rows have a consumer; 463 have none.
- The scan found 850 file-level import sites.

| 1.41 subpath        | value keep | value move | value delete | value → § 9 | type keep | type move | type delete | type → § 9 |
| ------------------- | ---------- | ---------- | ------------ | ----------- | --------- | --------- | ----------- | ---------- |
| `.`                 | 20         | 2          | 50           | 0           | 4         | 2         | 154         | 0          |
| `./charts`          | 0          | 0          | 0            | 97          | 0         | 0         | 0           | 69         |
| `./tokens`          | 11         | 0          | 12           | 1           | 2         | 0         | 8           | 1          |
| `./theme-lab`       | 0          | 0          | 9            | 0           | 0         | 0         | 5           | 0          |
| `./vite`            | 2          | 0          | 0            | 0           | 0         | 0         | 3           | 0          |
| `./guard`           | 0          | 0          | 14           | 0           | 0         | 0         | 7           | 0          |
| `./format`          | 8          | 0          | 9            | 3           | 0         | 0         | 12          | 0          |
| `./forms`           | 3          | 0          | 8            | 0           | 0         | 0         | 10          | 0          |
| `./commands`        | 6          | 0          | 16           | 0           | 1         | 0         | 18          | 0          |
| `./notifications`   | 0          | 3          | 20           | 0           | 0         | 0         | 15          | 0          |
| `./router-tanstack` | 0          | 7          | 2            | 0           | 0         | 2         | 39          | 0          |
| `./data/table`      | 0          | 2          | 0            | 0           | 0         | 0         | 7           | 0          |
| `./data/virtual`    | 0          | 0          | 1            | 0           | 0         | 0         | 3           | 0          |
| `./agent`           | 3          | 0          | 18           | 0           | 13        | 0         | 32          | 0          |
| `./agent-chat`      | 0          | 4          | 5            | 0           | 0         | 3         | 12          | 0          |
| `./content`         | 8          | 0          | 21           | 0           | 9         | 0         | 28          | 0          |
| `./controls`        | 11         | 0          | 14           | 0           | 2         | 0         | 31          | 0          |
| `./controls-dates`  | 1          | 0          | 0            | 0           | 0         | 0         | 1           | 0          |
| `./state`           | 3          | 0          | 1            | 0           | 3         | 0         | 21          | 0          |
| **total**           | 76         | 18         | 200          | 101         | 34        | 7         | 406         | 70         |

The 94 keep-or-move value rows collapse to 91 unique names, because three symbols appear twice:
`field` (`./state` and `./router-tanstack`), `createLocalStore` (`./state` and `.`) and
`createPersistedState` (`./state` and `.`). Each keeps `./state` as its one 2.0 home. Adding `createBasaltRouter` gives 92
non-chart value symbols in 2.0. Kept types collapse to 38 unique names, and `BasaltRouterContext` and
`BasaltEvent` bring that to 40.

| Subpaths            | Count                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| 1.41 `exports` keys | 24                                                                                             |
| 2.0 (V2-SPEC § 1)   | 15                                                                                             |
| dropped outright    | 6 (`./guard`, `./theme-lab`, `./data/virtual`, `./tokens.css`, `./llms.txt`, `./package.json`) |
| folded or renamed   | 4 (`./router-tanstack`, `./notifications`, `./agent-chat`, `./data/table` → `./table`)         |

Baseline `bun packages/basalt-ui/scripts/check-budgets.ts --report` on the base commit:

- public symbols 395 / 400
- published subpaths 24 / 24
- shipped rule lines 750 / 750
- spec prose 2528 / 3200
- playground route files 15 / 15
- CLI non-test lines 4249 / 4250

## External facts and their sources

| Fact                                                                                                                                                                                                                                                                                        | Source                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Latest versions on 2026-10-13: react 19.3.0, @types/react 19.3.0, ai 7.0.138, @ai-sdk/react 4.0.141, remend 1.4.0, shiki 4.5.0, motion 14.2.0, @tanstack/react-router 1.170.44, @tanstack/react-query 5.104.2, @tanstack/react-hotkeys 0.13.0, @mantine/core 9.7.2, beautiful-mermaid 1.1.3 | `npm view <pkg> version`                                                                                                               |
| `ViewTransition`, `addTransitionType` and `Activity` are stable exports. Runtime: `ViewTransition`/`Activity` are symbols, `addTransitionType`/`useEffectEvent` are functions                                                                                                               | installed `@types/react` 19.3.0 `index.d.ts:2002-2101`; `react` 19.3.0 runtime probe                                                   |
| `ViewTransitionProps` has `enter`/`exit`/`update`/`share`/`default` classes and `name`; `ActivityProps.mode` is `'hidden' \| 'visible'`                                                                                                                                                     | same file                                                                                                                              |
| Only `startTransition`, `useDeferredValue` and Suspense reveals activate `<ViewTransition>`; plain `setState` does not; `flushSync` mid-sequence skips it                                                                                                                                   | react.dev `reference/react/ViewTransition`, react.dev blog 2026-09-09 (React 19.3), via research-gateway job `46681550`                |
| React interrupts a non-React view transition and queues its own                                                                                                                                                                                                                             | react.dev `ViewTransition` reference (same job)                                                                                        |
| React does not honour `prefers-reduced-motion` itself; the docs recommend a CSS media query                                                                                                                                                                                                 | same                                                                                                                                   |
| `popstate` (Back/Forward) navigations skip React view transitions                                                                                                                                                                                                                           | same                                                                                                                                   |
| `<Activity mode="hidden">` hides with `display: none`, destroys Effects, preserves state                                                                                                                                                                                                    | react.dev `reference/react/Activity` (same job)                                                                                        |
| Behaviour without `document.startViewTransition` (commit without animation)                                                                                                                                                                                                                 | **unverified**: only a third-party guide (reactonrails.com); V2-SPEC § 5 Open                                                          |
| Every TanStack Router navigation runs in `React.startTransition`                                                                                                                                                                                                                            | installed `@tanstack/react-router` 1.170.38 `dist/esm/Transitioner.js:16-20`; `@tanstack/router-core` 1.171.32 `dist/esm/link.d.ts:63` |
| `defaultViewTransition` calls `document.startViewTransition` (with `types` when supported)                                                                                                                                                                                                  | `@tanstack/router-core` 1.171.32 `dist/esm/router.js:490-505`, `router.d.ts:148-156`                                                   |
| Router events `onBeforeNavigate`, `onBeforeLoad`, `onLoad`, `onResolved`, `onBeforeRouteMount`, `onRendered`                                                                                                                                                                                | `router-core` `router.d.ts:433-449`                                                                                                    |
| `defaultOnCatch`, `defaultErrorComponent`, `defaultPendingComponent`, `defaultNotFoundComponent` router options                                                                                                                                                                             | `@tanstack/react-router` 1.170.38 `dist/esm/router.d.ts:20-66`                                                                         |
| QueryCache notify event `{ type: 'updated', action: { type: 'error', error } }`                                                                                                                                                                                                             | installed `@tanstack/query-core` 5.103.1 `build/modern/hydration-*.d.ts:259,1090`                                                      |
| `WebSocketChatTransport` is a class implementing `ChatTransport`, with its request/response types exported                                                                                                                                                                                  | `ai@7.0.138` tarball `dist/index.d.ts:6359-6500` + export list line 10912                                                              |
| `ChatStatus = 'submitted' \| 'streaming' \| 'ready' \| 'error'`                                                                                                                                                                                                                             | `ai@7.0.138` `dist/index.d.ts:5985`                                                                                                    |
| `UIMessageStreamError` carries `chunkType`, `chunkId` (also present in the installed 7.0.107)                                                                                                                                                                                               | `ai@7.0.138` `dist/index.d.ts:8282-8296`                                                                                               |
| Reasoning levels `'provider-default' \| 'none' \| 'minimal' \| 'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'`                                                                                                                                                                             | `@ai-sdk/provider@4.0.27` (the `ai@7.0.138` dependency) `dist/index.d.ts:1563`                                                         |
| `useChat` `throttle` is stable; `experimental_throttle` is deprecated                                                                                                                                                                                                                       | `@ai-sdk/react@4.0.141` `dist/index.d.ts:116-123`                                                                                      |
| `Chat` class exposes `resumeStream`                                                                                                                                                                                                                                                         | `@ai-sdk/react@4.0.141` `dist/index.d.ts:90,111`                                                                                       |
| remend 1.4 completes images to `![alt](streamdown:incomplete-image)` (`INCOMPLETE_IMAGE_PLACEHOLDER`)                                                                                                                                                                                       | `remend@1.4.0` tarball `dist/index.d.ts:2,36`                                                                                          |
| motion 14.2.0 depends on framer-motion 14.2.0, whose `MotionConfig` takes `reducedMotion: 'always' \| 'never' \| 'user'`                                                                                                                                                                    | `npm view motion@14.2.0 dependencies`; `framer-motion@14.2.0` tarball `dist/index.d.ts:209,236`                                        |
| Mantine theme has `respectReducedMotion`                                                                                                                                                                                                                                                    | installed `@mantine/core` 9.3.0 `lib/core/MantineProvider/theme.types.d.ts:89`                                                         |
| argo wiring, OTel and chat facts (provider tree, `lib/router.ts`, `lib/hyperdx.ts`, `api/src/telemetry.ts`, `hermes-transport.ts`, ai 7.0.107 / 5.0.196 skew, no motion / view-transition use)                                                                                              | Explore pass over `~/SourceRoot/argo` (read-only), cited by path in V2-SPEC                                                            |
| Fleet `service.name` convention `<project>-<component>` (argo-api, argo-dashboard, fpp-server, audio-gateway, research-gateway, …)                                                                                                                                                          | same Explore pass, grep of `OTEL_SERVICE_NAME` / `.env.tpl` names (no values)                                                          |

Tarballs were extracted under `/tmp/v2pk/<pkg>/`, one fresh directory per package.

## BasaltEvent type check (V2-SPEC § 7)

The § 7 union and the OTel adapter shape were compiled with the repo's TypeScript 6.0.3 (`--strict
--exactOptionalPropertyTypes`, stubbed `ThreadStatus`/`AgentError` and OTel's `Attributes` index
type). `tsc` exits 0. The test file asserts four things:

- An exhaustive `switch (e.type)` ends in `e satisfies never`.
- Three negative controls each raise an error: reading `exception.type` on a `route.navigate`
  event, a `query.error` with `failed: false`, and a failed `chat.turn` without the failure
  attributes.
- `{ ...e.attributes }` is assignable to `Attributes`.

## Scripts

Both run with Bun from any directory; outputs are TSV under `/tmp/v2inv/`.

`surface.ts` (`bun surface.ts packages/basalt-ui > surface.tsv`):

```ts
// Lists every export (value + type) of each published JS subpath, resolved from src entries.
import ts from 'typescript' // the repo's typescript@6.0.3 by absolute path; a bare import from /tmp lacked the compiler API
import { resolve } from 'node:path'
const pkg = process.argv[2]
const exportsMap = (await Bun.file(resolve(pkg, 'package.json')).json()).exports
const entries: Record<string, string> = {}
for (const [k, v] of Object.entries<any>(exportsMap)) {
  if (typeof v !== 'object') continue
  entries[k] = resolve(pkg, v.import.replace('./dist/', 'src/').replace(/\.js$/, ''))
}
const files = Object.values(entries).map((p) => {
  for (const ext of ['.ts', '.tsx', '/index.ts']) if (Bun.file(p + ext).size) return p + ext
  throw new Error(p)
})
const cfg = ts.getParsedCommandLineOfConfigFile(
  resolve(pkg, 'tsconfig.json'),
  {},
  { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
)!
const program = ts.createProgram(files, cfg.options)
const checker = program.getTypeChecker()
const out: any[] = []
Object.keys(entries).forEach((sub, i) => {
  const sf = program.getSourceFile(files[i])!
  const sym = checker.getSymbolAtLocation(sf)!
  for (const e of checker.getExportsOfModule(sym)) {
    const t = e.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(e) : e
    const isValue = !!(t.flags & ts.SymbolFlags.Value)
    out.push([sub, e.name, isValue ? 'value' : 'type'].join('\t'))
  }
})
console.log(out.join('\n'))
```

`scan.ts` (`bun scan.ts`, writes `hits.tsv` / `subs.tsv` / `versions.tsv`):

```ts
// Counts imports of basalt-ui symbols across consumer repos. Output TSV: subpath name kind files refs
import { Glob } from 'bun'
const home = process.env.HOME + '/SourceRoot/'
const repos = [
  'argo',
  'linewatch',
  'weatherorb',
  'rb',
  'rollhook',
  'basalt-ui-obsidian',
  'email-gateway',
  'image-gateway',
]
const skip =
  /(^|\/)(node_modules|dist|build|\.git|\.claude|\.output|\.vinxi|\.turbo|coverage|\.evidence)\//
const re =
  /(import|export)\s+(type\s+)?(\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+['"](basalt-ui(?:\/[^'"]*)?)['"]/g
const hits = new Map<string, Set<string>>()
const subs = new Map<string, Set<string>>()
const versions: string[] = []
for (const repo of repos) {
  const root = home + repo
  for (const pj of new Glob('**/package.json').scanSync({ cwd: root })) {
    if (skip.test(pj)) continue
    const j = await Bun.file(`${root}/${pj}`).json()
    const v = j.dependencies?.['basalt-ui'] ?? j.devDependencies?.['basalt-ui']
    if (v) versions.push(`${repo}:${pj}\t${v}`)
  }
  for (const f of new Glob('**/*.{ts,tsx,mts,js,jsx,css}').scanSync({ cwd: root })) {
    if (skip.test(f)) continue
    const src = await Bun.file(`${root}/${f}`).text()
    if (!src.includes('basalt-ui')) continue
    for (const m of src.matchAll(re)) {
      const sub = m[4] === 'basalt-ui' ? '.' : './' + m[4].slice('basalt-ui/'.length)
      const spec = m[3]
      const loc = `${repo}:${f}`
      if (!subs.has(sub)) subs.set(sub, new Set())
      subs.get(sub)!.add(loc)
      const names = [...spec.matchAll(/(?:^|[{,])\s*(?:type\s+)?(\w+)(?:\s+as\s+\w+)?/g)].map(
        (x) => x[1],
      )
      if (spec.startsWith('*')) names.splice(0, names.length, '*')
      for (const n of names) {
        const k = `${sub}\t${n}`
        if (!hits.has(k)) hits.set(k, new Set())
        hits.get(k)!.add(loc)
      }
    }
    // CSS @import / side-effect imports
    for (const m of src.matchAll(/(?:@import|import)\s+['"](basalt-ui\/[^'"]+)['"]/g)) {
      const sub = './' + m[1].slice(10)
      if (!subs.has(sub)) subs.set(sub, new Set())
      subs.get(sub)!.add(`${repo}:${f}`)
    }
  }
}
await Bun.write(
  '/tmp/v2inv/hits.tsv',
  [...hits].map(([k, s]) => `${k}\t${s.size}\t${[...s].join(' ')}`).join('\n') + '\n',
)
await Bun.write(
  '/tmp/v2inv/subs.tsv',
  [...subs]
    .map(
      ([k, s]) => `${k}\t${s.size}\t${[...new Set([...s].map((x) => x.split(':')[0]))].join(',')}`,
    )
    .join('\n') + '\n',
)
await Bun.write('/tmp/v2inv/versions.tsv', versions.join('\n') + '\n')
```

`scan-extra.ts` (`bun scan-extra.ts`, prints one TSV line per hit; it printed none):

```ts
// Second pass: the import forms scan.ts does not see. Prints every hit; namespace imports are expanded to X.member.
import { Glob } from 'bun'
const home = process.env.HOME + '/SourceRoot/'
const repos = [
  'argo',
  'linewatch',
  'weatherorb',
  'rb',
  'rollhook',
  'basalt-ui-obsidian',
  'email-gateway',
  'image-gateway',
]
const skip =
  /(^|\/)(node_modules|dist|build|\.git|\.claude|\.output|\.vinxi|\.turbo|coverage|\.evidence)\//
const SPEC = `['"\`](basalt-ui(?:\\/[^'"\`]*)?)['"\`]`
const forms: Record<string, RegExp> = {
  dynamicImport: new RegExp(`import\\s*\\(\\s*${SPEC}`, 'g'),
  require: new RegExp(`require\\s*\\(\\s*${SPEC}`, 'g'),
  requireResolve: new RegExp(`require\\.resolve\\s*\\(\\s*${SPEC}`, 'g'),
  exportStar: new RegExp(`export\\s+\\*\\s+(?:as\\s+\\w+\\s+)?from\\s+${SPEC}`, 'g'),
  namespace: new RegExp(`import\\s+(?:type\\s+)?\\*\\s+as\\s+(\\w+)\\s+from\\s+${SPEC}`, 'g'),
  viMock: new RegExp(`(?:vi|jest|mock)\\.mock\\s*\\(\\s*${SPEC}`, 'g'),
}
let files = 0
for (const repo of repos) {
  const root = home + repo
  for (const f of new Glob('**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}').scanSync({ cwd: root })) {
    if (skip.test(f)) continue
    const src = await Bun.file(`${root}/${f}`).text()
    if (!src.includes('basalt-ui')) continue
    files++
    for (const [form, re] of Object.entries(forms)) {
      for (const m of src.matchAll(re)) {
        if (form === 'namespace') {
          const members = new Set(
            [...src.matchAll(new RegExp(`\\b${m[1]}\\.(\\w+)`, 'g'))].map((x) => x[1]),
          )
          console.log(`${form}\t${m[2]}\t${repo}:${f}\t${[...members].join(',')}`)
        } else if (form === 'dynamicImport') {
          // destructured members right after the import, e.g. `const { X } = await import('basalt-ui')` or `.then((m) => m.X)`
          const tail = src.slice(m.index!, m.index! + 300)
          const members = [...tail.matchAll(/\b(?:m|mod|module)\.(\w+)/g)].map((x) => x[1])
          const head = src.slice(Math.max(0, m.index! - 200), m.index!)
          const destr = head.match(/\{([^}]*)\}\s*=\s*await\s*$/)?.[1] ?? ''
          console.log(
            `${form}\t${m[1]}\t${repo}:${f}\t${[
              ...members,
              ...destr
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            ].join(',')}`,
          )
        } else console.log(`${form}\t${m[1]}\t${repo}:${f}`)
      }
    }
  }
}
console.error(`files mentioning basalt-ui: ${files}`)
```

`docs/waves/v2-surface.md` is generated from `surface.tsv` joined with `hits.tsv`. The default
rules are in that file's header, and every override is recorded in its reason column.
