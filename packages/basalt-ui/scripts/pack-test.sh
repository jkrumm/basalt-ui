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

echo "==> assert tarball contents"
LIST=$(tar -tzf "$TGZ")
require() { echo "$LIST" | grep -qx "package/$1" || { echo "MISSING in tarball: $1"; exit 1; }; }
forbid() { if echo "$LIST" | grep -qx "package/$1"; then echo "FORBIDDEN in tarball: $1"; exit 1; fi; }
for f in \
  dist/index.js dist/index.d.ts dist/index.d.ts.map \
  dist/charts/index.js dist/charts/index.d.ts \
  dist/tokens/index.js dist/tokens/index.d.ts \
  dist/vite.js dist/vite.d.ts \
  dist/theme-lab/index.js dist/cli/index.js dist/styles.css \
  dist/shell/index.js \
  dist/shell/app-sidebar.module.css dist/shell/app-mobile-nav.module.css dist/shell/app-header.module.css \
  src/index.ts \
  configs/oxlint.json configs/tsconfig.base.json configs/tsconfig.react-app.json \
  agent/rules/basalt-tokens.md agent/rules/basalt-charts.md \
  agent/templates/DESIGN.md.tpl agent/templates/CLAUDE-block.md.tpl agent/templates/settings.stanza.json \
  bin/basalt.mjs; do require "$f"; done
# CSS-module type decls must NOT be transpiled into runtime JS (the tsup *.d.ts exclude).
for f in src/index.css src/starlight.css tailwind.config.js \
  dist/shell/app-sidebar.module.css.d.js dist/shell/app-mobile-nav.module.css.d.js \
  dist/shell/app-header.module.css.d.js; do forbid "$f"; done
echo "tarball contents OK"

echo "==> scratch-consumer resolution test"
ABS_TGZ="$PWD/$TGZ"
SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT
cd "$SCRATCH"
echo '{ "name": "scratch", "private": true, "type": "module" }' >package.json
bun add "$ABS_TGZ" react react-dom @mantine/core @mantine/hooks >/dev/null 2>&1
cat >test.mjs <<'JS'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const subpaths = [
  'basalt-ui',
  'basalt-ui/charts',
  'basalt-ui/tokens',
  'basalt-ui/vite',
  'basalt-ui/theme-lab',
  'basalt-ui/styles.css',
]
for (const s of subpaths) {
  const url = import.meta.resolve(s)
  if (!url) throw new Error(`did not resolve: ${s}`)
  console.log('resolved', s)
}

// the Mantine-free tokens entry must fully load (no peer deps required)
const tokens = await import('basalt-ui/tokens')
if (typeof tokens.buildPaletteCss !== 'function') throw new Error('tokens.buildPaletteCss missing')

// the raw oxlint preset must resolve via ./configs/* and be valid JSON
JSON.parse(readFileSync(require.resolve('basalt-ui/configs/oxlint.json'), 'utf8'))

console.log('scratch resolution OK')
JS
node test.mjs

echo "PACK TEST PASSED"
