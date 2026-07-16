#!/usr/bin/env bash
#
# Dist gate for the unbundled tsup build. The playground only exercises src/,
# so this is the only thing that proves the published tarball actually resolves.
# Builds, packs, asserts tarball contents, and scratch-installs the tarball to
# confirm every subpath export resolves and the Mantine-free tokens entry loads.
#
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> build"
bun run build

echo "==> pack"
rm -f basalt-ui-*.tgz
bun pm pack
TGZ=$(ls basalt-ui-*.tgz)
echo "packed: $TGZ"

echo "==> publint"
bunx publint --strict "$TGZ"

echo "==> attw (are-the-types-wrong)"
bunx attw "$TGZ" --profile esm-only --ignore-rules cjs-resolves-to-esm named-exports --exclude-entrypoints ./styles.css ./llms.txt

echo "==> assert tarball contents"
LIST=$(tar -tzf "$TGZ")
require() { echo "$LIST" | grep -qx "package/$1" || { echo "MISSING in tarball: $1"; exit 1; }; }
forbid() { if echo "$LIST" | grep -qx "package/$1"; then echo "FORBIDDEN in tarball: $1"; exit 1; fi; }
for f in \
  dist/index.js dist/index.d.ts dist/index.d.ts.map \
  dist/charts/index.js dist/charts/index.d.ts \
  dist/tokens/index.js dist/tokens/index.d.ts \
  dist/guard/index.js dist/guard/index.d.ts \
  dist/state.js dist/state.d.ts \
  dist/vite.js dist/vite.d.ts \
  dist/theme-lab/index.js dist/cli/index.js dist/styles.css \
  dist/shell/index.js \
  dist/shell/app-sidebar.module.css dist/shell/app-mobile-nav.module.css dist/shell/app-header.module.css \
  src/index.ts \
  configs/oxlint.json configs/tsconfig.base.json configs/tsconfig.react-app.json \
  agent/rules/basalt-tokens.md agent/rules/basalt-charts.md \
  agent/templates/DESIGN.md.tpl agent/templates/CLAUDE-block.md.tpl \
  llms.txt \
  bin/basalt.mjs; do require "$f"; done
# CSS-module type decls must NOT be transpiled into runtime JS (the tsup *.d.ts exclude).
for f in src/index.css src/starlight.css tailwind.config.js \
  dist/shell/app-sidebar.module.css.d.js dist/shell/app-mobile-nav.module.css.d.js \
  dist/shell/app-header.module.css.d.js; do forbid "$f"; done
echo "tarball contents OK"

echo "==> dist layering guard (Mantine-free subpaths + root-barrel re-export)"
node scripts/check-dist-layering.mjs

echo "==> scratch-consumer resolution test (with optional peers)"
ABS_TGZ="$PWD/$TGZ"
SCRATCH=$(mktemp -d)
SCRATCH2=""
trap 'rm -rf "$SCRATCH" "$SCRATCH2"' EXIT
cd "$SCRATCH"
echo '{ "name": "scratch", "private": true, "type": "module" }' >package.json
bun add "$ABS_TGZ" \
  react react-dom \
  @mantine/core @mantine/hooks \
  @mantine/form @mantine/notifications @mantine/spotlight @mantine/modals \
  "@tanstack/react-query@^5.101.0" "@tanstack/react-query-devtools@^5.101.0" \
  "@tanstack/react-router@^1.170.0" \
  "@tanstack/react-table@>=8" "@tanstack/react-virtual@>=3" \
  "react-markdown@^10.1.0" "remark-gfm@^4.0.1" \
  "use-stick-to-bottom@^1.1.6" \
  typescript >/dev/null 2>&1
cat >test.mjs <<'JS'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const subpaths = [
  'basalt-ui',
  'basalt-ui/charts',
  'basalt-ui/tokens',
  'basalt-ui/guard',
  'basalt-ui/state',
  'basalt-ui/vite',
  'basalt-ui/theme-lab',
  'basalt-ui/styles.css',
  'basalt-ui/query',
  'basalt-ui/router-tanstack',
  'basalt-ui/forms',
  'basalt-ui/notifications',
  'basalt-ui/commands',
  'basalt-ui/data',
  'basalt-ui/data/table',
  'basalt-ui/data/virtual',
  'basalt-ui/agent',
  'basalt-ui/connectivity',
  'basalt-ui/content',
]
for (const s of subpaths) {
  const url = import.meta.resolve(s)
  if (!url) throw new Error(`did not resolve: ${s}`)
  console.log('resolved', s)
}

// the Mantine-free tokens entry must fully load (no peer deps required)
const tokens = await import('basalt-ui/tokens')
if (typeof tokens.buildPaletteCss !== 'function') throw new Error('tokens.buildPaletteCss missing')

// the Mantine-free guard entry must load with checkSource present
const guard = await import('basalt-ui/guard')
if (typeof guard.checkSource !== 'function') throw new Error('guard.checkSource missing')

// the raw oxlint preset must resolve via ./configs/* and be valid JSON
JSON.parse(readFileSync(require.resolve('basalt-ui/configs/oxlint.json'), 'utf8'))

// headless adapter smoke imports (peers installed — these load without a DOM/provider)
const queryMod = await import('basalt-ui/query')
if (typeof queryMod.createBasaltQueryClient !== 'function') throw new Error('query.createBasaltQueryClient missing')
console.log('smoke: basalt-ui/query OK')

const agentMod = await import('basalt-ui/agent')
if (typeof agentMod.useAgentStream !== 'function') throw new Error('agent.useAgentStream missing')
if (typeof agentMod.edenTransport !== 'function') throw new Error('agent.edenTransport missing')
console.log('smoke: basalt-ui/agent OK')

const routerTanstackMod = await import('basalt-ui/router-tanstack')
if (typeof routerTanstackMod.createMultiSearchParamStore !== 'function') {
  throw new Error('router-tanstack.createMultiSearchParamStore missing')
}
console.log('smoke: basalt-ui/router-tanstack OK')

console.log('scratch resolution OK (19 subpaths)')
JS
node test.mjs

echo "==> dist-vantage tsc assertion (catches .d.ts declaration-emit regressions)"
# Write a strict tsconfig matching the package's own flags — the .d.ts vantage only
# catches a declaration-emit regression under the same strict flags.
cat >tsconfig.dist-vantage.json <<'JSON'
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noPropertyAccessFromIndexSignature": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["dist-vantage.ts"]
}
JSON
# Write a consumer .ts that imports from the installed basalt-ui dist .d.ts files.
# Uses Slot<>, AsyncState + assertNever, and SeriesKey — one per published surface.
cat >dist-vantage.ts <<'TS'
import type { Slot, AsyncState } from 'basalt-ui'
import { assertNever } from 'basalt-ui'
import type { SeriesKey } from 'basalt-ui/charts'
import type { GuardKind, Finding } from 'basalt-ui/guard'

// Slot: un-augmented slot is never-keyed {}
type EmptySlot = Slot<'nonexistent', Record<string, unknown>>
const _k: keyof EmptySlot = undefined as never

// AsyncState: exhaustive switch via assertNever
function render(s: AsyncState<number>): string {
  switch (s.status) {
    case 'idle':    return 'idle'
    case 'loading': return 'loading'
    case 'success': return String(s.data)
    case 'error':   return String(s.error)
    default:        return assertNever(s)
  }
}

// SeriesKey resolves (never when un-augmented — valid, no tsc error)
const _sk: SeriesKey = undefined as never

// GuardKind and Finding are present in the .d.ts
const _gk: GuardKind = 'raw-hex'
const _f: Finding = { relPath: 'x', line: 1, token: '#fff', kind: 'raw-hex' }

export { render, _k, _sk, _gk, _f }
TS
bunx tsc --project tsconfig.dist-vantage.json
echo "dist-vantage tsc OK"

echo "==> charts/tokens-only (no-Mantine) resolution + render"
SCRATCH2=$(mktemp -d)
cd "$SCRATCH2"
echo '{ "name": "scratch-free", "private": true, "type": "module" }' >package.json
bun add "$ABS_TGZ" react react-dom >/dev/null 2>&1
cat >free.mjs <<'JS'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// The Mantine-free subpaths must load with NO @mantine installed.
const charts = await import('basalt-ui/charts')
const tokens = await import('basalt-ui/tokens')
if (typeof tokens.buildPaletteCss !== 'function') throw new Error('tokens.buildPaletteCss missing')
if (typeof tokens.buildPaletteCss() !== 'string') throw new Error('buildPaletteCss() did not return a string')
// Render proof: Bars accepts explicit width+height and uses VX token refs (plain var() strings,
// SSR-safe). Wrapped in VxThemeProvider (also Mantine-free) so useVxTheme() resolves; the
// provider itself has no @mantine dependency. renderToStaticMarkup works with all React hooks
// (useCallback/useMemo/useRef/useContext run synchronously in SSR).
const { VxThemeProvider, Bars } = charts
const data = [{ x: '2024-01', v: 10 }, { x: '2024-02', v: 20 }, { x: '2024-03', v: 15 }]
const chart = createElement(Bars, {
  data,
  width: 400,
  height: 200,
  chartId: 'test',
  getX: (d) => d.x,
  getValue: (d, key) => key === 'v' ? d.v : null,
  positiveBars: [{ key: 'v', label: 'Value', color: 'var(--vx-blue)' }],
  leftAxis: { domain: [0, 30] },
})
const wrapped = createElement(VxThemeProvider, { colorScheme: 'light' }, chart)
const html = renderToStaticMarkup(wrapped)
if (!html.includes('<svg')) throw new Error('chart kind did not render an <svg>')
console.log('charts/tokens-only resolution + render OK')
JS
node free.mjs

echo "PACK TEST PASSED"
