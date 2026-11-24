#!/usr/bin/env bash
#
# Dist gate for the unbundled tsup build. The playground only exercises src/,
# so this is the only thing that proves the published tarball actually resolves.
# Builds, packs, asserts tarball contents, and scratch-installs the tarball to
# confirm every subpath export resolves and the tokens entry loads.
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
bunx attw "$TGZ" --profile esm-only --ignore-rules cjs-resolves-to-esm named-exports --exclude-entrypoints ./styles.css ./tokens.css ./typography.css ./prose.css ./fonts.css ./tailwind.css ./archify.css ./table.css ./static.css ./starlight.css ./astro/BasaltFonts.astro ./astro/mdx/Chart.astro ./astro/mdx/DataTable.astro

echo "==> assert tarball contents"
# Assert against a FILE, never `echo "$LIST" | grep -q`. Under this script's `set -o pipefail`,
# `grep -q` exits at its first match and echo's remaining writes take SIGPIPE, so the PIPELINE
# reports 141 and a file that IS in the tarball is reported MISSING. bash buffers stdout to a
# pipe in ~4KB chunks, so "did echo finish before grep exited" is a scheduling race — which is
# exactly why this gate failed nondeterministically, on a different file each run, and only ever
# on entries near the START of the 1104-line listing. grep over a regular file has no writer to
# kill. `-F` additionally stops a path being read as a regex (every filename contains `.`).
LISTFILE=$(mktemp)
trap 'rm -f "$LISTFILE"' EXIT
tar -tzf "$TGZ" >"$LISTFILE"
require() { grep -qxF "package/$1" "$LISTFILE" || { echo "MISSING in tarball: $1"; exit 1; }; }
forbid() { if grep -qxF "package/$1" "$LISTFILE"; then echo "FORBIDDEN in tarball: $1"; exit 1; fi; }
for f in \
  dist/index.js dist/index.d.ts dist/index.d.ts.map \
  dist/charts/index.js dist/charts/index.d.ts \
  dist/tokens/index.js dist/tokens/index.d.ts \
  dist/table/index.js dist/table/index.d.ts \
  dist/vite.js dist/vite.d.ts \
  dist/cli/index.js dist/styles.css \
  dist/shell/index.js \
  dist/router/index.js dist/data/index.js dist/page/index.js dist/cards/index.js dist/ai/index.js dist/motion/index.js \
  dist/lint/index.js dist/lint/stylelint/index.js dist/testing/index.js dist/css/theme-script.js \
  dist/css/tokens.css dist/css/typography.css dist/css/prose.css dist/css/fonts.css dist/css/tailwind.css dist/css/archify.css dist/table/table.css \
  dist/static/index.js dist/static/index.d.ts dist/astro/index.js dist/astro/index.d.ts dist/astro/BasaltFonts.astro dist/astro/mdx/Chart.astro dist/astro/mdx/DataTable.astro dist/astro/mdx/chart-island.js dist/astro/mdx/table-island.js \
  dist/css/static.css dist/css/starlight.css \
  dist/controls/index.js dist/controls/index.d.ts \
  dist/form/index.js dist/form/index.d.ts \
  src/index.ts \
  configs/oxlint-app.json configs/oxlint-parts.json configs/oxlint-bridge.json configs/oxlint-site.json configs/tsconfig.base.json configs/tsconfig.react-app.json \
  agent/rules/basalt-tokens.md agent/rules/basalt-ui.md agent/rules/basalt-page.md \
  agent/rules/basalt-state.md agent/rules/basalt-charts.md \
  agent/templates/DESIGN.md.tpl agent/templates/AGENTS-block.md.tpl \
  agent/templates/AGENTS-block.tokens.md.tpl agent/templates/main.tpl \
  agent/templates/_app.tpl agent/templates/_app-error.tpl agent/templates/_app-missing.tpl \
  agent/templates/_app-pending.tpl agent/templates/_app-index.tpl agent/templates/__root.start.tpl agent/templates/router.start.tpl \
  agent/skills/basalt-app/SKILL.md agent/skills/basalt-charts/SKILL.md \
  agent/skills/basalt-design/SKILL.md \
  blocks/list-page/block.json blocks/record-page/block.json \
  llms.txt \
  bin/basalt-ui.mjs; do require "$f"; done
# CSS-module type decls must NOT be transpiled into runtime JS (the tsup *.d.ts exclude).
# The retired rule files must not ship either: `files` globs `agent/`, so a rule deleted from the
# repo but left in a stale worktree would be published and placed into consumers by `sync`.
for f in src/index.css src/starlight.css tailwind.config.js MAINTAINING.md \
  agent/rules/basalt-router.md agent/rules/basalt-app.md agent/rules/basalt-query.md \
  dist/shell/app-sidebar.module.css.d.js dist/shell/app-mobile-nav.module.css.d.js \
  dist/shell/app-header.module.css.d.js; do forbid "$f"; done
# The shipped rules are exactly five (v3): any other file under agent/rules/ is a retired rule
# left in a stale worktree, which `sync` would place into consumers.
if grep -E '^package/agent/rules/' "$LISTFILE" |
  grep -vE '^package/agent/rules/basalt-(tokens|ui|page|state|charts)\.md$'; then
  echo "FORBIDDEN in tarball: agent/rules/ holds a file outside the five shipped rules"
  exit 1
fi
# forbid() above is an exact-string match, so the test-artifact patterns need their own regex
# check: src/**/*.test.ts(x) (files:["src/"] ships every source, including tests) and
# dist/**/*.test.d.ts(.map) (tsc --emitDeclarationOnly has no test exclude of its own).
if grep -qE '^package/(src|dist)/.*\.test\.(ts|tsx|d\.ts)(\.map)?$' "$LISTFILE"; then
  echo "FORBIDDEN in tarball: test artifacts present"
  grep -E '^package/(src|dist)/.*\.test\.' "$LISTFILE" | head -20
  exit 1
fi
echo "tarball contents OK"

echo "==> llms.txt names every export (generated at build, untracked: the tarball copy is the artifact)"
LLMS_DIR=$(mktemp -d)
tar -xzOf "$TGZ" package/llms.txt >"$LLMS_DIR/llms.txt"
tar -xzOf "$TGZ" package/package.json >"$LLMS_DIR/package.json"
node scripts/gen-llms-assert.mjs "$LLMS_DIR/llms.txt" "$LLMS_DIR/package.json"
rm -rf "$LLMS_DIR"

echo "==> legacy names (the 2.x names, in the artifact outside the allowlist)"
NAMES_DIR=$(mktemp -d)
tar -xzf "$TGZ" -C "$NAMES_DIR"
bun ../../scripts/check-legacy-names.ts --package "$NAMES_DIR/package"
rm -rf "$NAMES_DIR"

echo "==> tarball parity (every CLI-read source ships in the artifact)"
node scripts/check-tarball-parity.mjs "$LISTFILE"

echo "==> dist layering guard (framework-free subpaths + root-barrel re-export)"
node scripts/check-dist-layering.mjs

# Install into a scratch consumer: quiet on success, but dump the installer's full output on
# failure. These four installs used to be `bun add ... >/dev/null 2>&1`, so a failed install exited
# the gate with NOTHING printed — indistinguishable in CI from a real resolution regression in the
# artifact, which is the one thing this script exists to detect. Silence on failure is the worst
# possible output for a gate.
scratch_install() {
  local log
  log=$(mktemp)
  if ! bun add "$@" >"$log" 2>&1; then
    echo "pack-test: scratch install FAILED — this is an install error, not a resolution failure:"
    cat "$log"
    rm -f "$log"
    exit 1
  fi
  rm -f "$log"
}

# The peer classes of docs/V2-SPEC.md § 1 "Peers": scripts/surface-gates.ts holds the one list (the
# graph-side assertion reads it too), `scripts/surface-peers.ts` prints it for this script, so the
# shell cannot drift from the gate. Scratch installs take each peer at the range the tarball declares,
# so a range bump in package.json is exercised here without a second edit.
# One `name@range` line per peer, read into an array by `peer_array` (bash 3.2 has no mapfile).
peer_array() {
  local out=$1 line
  shift
  eval "$out=()"
  while IFS= read -r line; do eval "$out+=(\"\$line\")"; done < <(
    for name in "$@"; do
      node -p "'$name@' + require('$PWD_PKG/package.json').peerDependencies['$name']"
    done
  )
}

PWD_PKG="$PWD"
echo "==> scratch-consumer resolution test (with optional peers)"
# Every declared peer at its declared range, except vite (pinned below).
peer_array ALL_PEERS $(node -p "Object.keys(require('$PWD/package.json').peerDependencies).filter((n) => n !== 'vite').join(' ')")
ABS_TGZ="$PWD/$TGZ"
SCRATCH=$(mktemp -d)
SCRATCH2=""
SCRATCH3=""
SCRATCH4=""
SCRATCH5=""
SCRATCH6=""
trap 'rm -rf "$SCRATCH" "$SCRATCH2" "$SCRATCH3" "$SCRATCH4" "$SCRATCH5" "$SCRATCH6"; rm -f "$LISTFILE"' EXIT
cd "$SCRATCH"
echo '{ "name": "scratch", "private": true, "type": "module" }' >package.json
# vite is pinned to the package's own dev version: an unpinned `vite` resolves to the registry's
# latest, and the gate then grades whatever rolldown published minutes ago — CI went red on
# 2026-09-02 because rolldown 1.2.7 was live while its linux-x64 binding was still at 1.2.6. The
# gate proves the ARTIFACT resolves; vite compatibility is the playground's and `make check`'s job.
scratch_install "$ABS_TGZ" \
  "vite@8.0.16" typescript \
  "${ALL_PEERS[@]}"
cat >test.mjs <<'JS'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

const subpaths = [
  'basalt-ui',
  'basalt-ui/charts',
  'basalt-ui/tokens',
  'basalt-ui/controls',
  'basalt-ui/table',
  'basalt-ui/content',
  'basalt-ui/vite',
  'basalt-ui/styles.css',
  // v3 skeleton: the stub barrels, the 2.x shell alias, and the CSS entries (frozen per major)
  'basalt-ui/router',
  'basalt-ui/data',
  'basalt-ui/form',
  'basalt-ui/page',
  'basalt-ui/cards',
  'basalt-ui/motion',
  'basalt-ui/ai',
  'basalt-ui/lint',
  'basalt-ui/stylelint',
  'basalt-ui/testing',
  'basalt-ui/theme-script',
  'basalt-ui/shell',
  'basalt-ui/tokens.css',
  'basalt-ui/typography.css',
  'basalt-ui/prose.css',
  'basalt-ui/fonts.css',
  'basalt-ui/tailwind.css',
  'basalt-ui/archify.css',
  'basalt-ui/table.css',
  // the site profile: static parts, the Astro integration and its head component, two sheets
  'basalt-ui/static',
  'basalt-ui/astro',
  'basalt-ui/astro/BasaltFonts.astro',
  'basalt-ui/astro/mdx/Chart.astro',
  'basalt-ui/astro/mdx/DataTable.astro',
  'basalt-ui/static.css',
  'basalt-ui/starlight.css',
]
for (const s of subpaths) {
  const url = import.meta.resolve(s)
  if (!url) throw new Error(`did not resolve: ${s}`)
  console.log('resolved', s)
}

// the tokens entry must fully load (no peer deps required)
const tokens = await import('basalt-ui/tokens')
if (typeof tokens.buildPaletteCss !== 'function') throw new Error('tokens.buildPaletteCss missing')

// the raw oxlint presets must resolve via ./configs/* and be valid JSON, each loading the rule plugin
for (const profile of ['app', 'parts', 'bridge', 'site']) {
  const preset = JSON.parse(
    readFileSync(require.resolve(`basalt-ui/configs/oxlint-${profile}.json`), 'utf8'),
  )
  if (!preset.jsPlugins?.includes('basalt-ui/lint')) throw new Error(`oxlint-${profile}.json does not load basalt-ui/lint`)
}

// the push channel ships with the data layer only (the root barrel no longer exports `createChannel`)
const dataMod = await import('basalt-ui/data')
if (typeof dataMod.createChannel !== 'function') throw new Error('data.createChannel missing')
console.log('smoke: basalt-ui/data createChannel OK')

// the site profile: the parts load with react alone, and the integration needs no astro install to import
const staticMod = await import('basalt-ui/static')
if (typeof staticMod.SiteHeader !== 'function') throw new Error('static.SiteHeader missing')
const astroMod = await import('basalt-ui/astro')
if (astroMod.basaltAstro().name !== 'basalt-ui') throw new Error('astro.basaltAstro() is not the basalt-ui integration')
console.log('smoke: basalt-ui/static and basalt-ui/astro OK')

// eject (docs/v3/ARCHITECTURE.md 4.1): a seed's `../core/*` and `../tokens` imports are published
// subpaths, and no compiled file reaches a primitive by a relative path an alias cannot follow.
{
  const { existsSync, readdirSync, statSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const pkgDir = new URL('./node_modules/basalt-ui/', import.meta.url)
  const seedDir = new URL('src/ui/', pkgDir)
  const seeds = readdirSync(seedDir)
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    .map((f) => f.slice(0, -'.tsx'.length))
  const wanted = new Set()
  for (const name of seeds) {
    const text = readFileSync(new URL(`${name}.tsx`, seedDir), 'utf8')
    for (const [, spec] of text.matchAll(/from\s+['"]\.\.\/(core\/[\w/-]+|tokens)['"]/g)) {
      wanted.add(spec === 'tokens' ? 'basalt-ui/tokens' : `basalt-ui/${spec}`)
    }
  }
  for (const spec of wanted) {
    const url = import.meta.resolve(spec)
    if (!existsSync(fileURLToPath(url))) throw new Error(`eject specifier does not resolve: ${spec}`)
  }
  // fix-esm-extensions has run: a surviving relative reach into a seed ends in `.js`
  const names = seeds.join('|')
  const viaUi = new RegExp(`from\\s*['"]\\.\\./ui/(?:${names})(?:\\.js)?['"]`)
  const sibling = new RegExp(`from\\s*['"]\\./(?:${names})(?:\\.js)?['"]`)
  const stale = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = `${dir}/${entry}`
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(js|d\.ts)$/.test(p)) {
        const text = readFileSync(p, 'utf8')
        const inUi = dir.endsWith('/dist/ui')
        if (viaUi.test(text) || (inUi && sibling.test(text))) stale.push(p)
      }
    }
  }
  walk(fileURLToPath(new URL('dist', pkgDir)))
  if (stale.length > 0) throw new Error(`relative primitive imports left in dist: ${stale.slice(0, 5).join(', ')}`)
  console.log(`smoke: eject specifiers OK (${wanted.size} core/tokens paths, ${seeds.length} seeds)`)

  // The exports map is an explicit list: an internal core module, a guard, a test helper, the slot
  // table and the old stub barrel do not resolve, though each file ships in the tarball.
  const hidden = [
    'basalt-ui/core/frame-arm',
    'basalt-ui/core/provider',
    'basalt-ui/core/scheme',
    'basalt-ui/ui/button.guard',
    'basalt-ui/ui/primitive.contract',
    'basalt-ui/ui/guard-completeness',
    'basalt-ui/ui/slots',
    'basalt-ui/ui/index',
  ]
  for (const spec of hidden) {
    let resolved = false
    try {
      import.meta.resolve(spec)
      resolved = true
    } catch (e) {
      if (e?.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED' && e?.code !== 'ERR_MODULE_NOT_FOUND') throw e
    }
    if (resolved) throw new Error(`${spec} resolves; the exports map must not publish it`)
  }
  console.log(`smoke: ${hidden.length} internal paths do not resolve`)
}

console.log(`scratch resolution OK (${subpaths.length} subpaths)`)
JS
# Some entries import CSS modules, which plain Node cannot load.
node --import "$(dirname "$ABS_TGZ")/scripts/css-noop-register.mjs" test.mjs

echo "==> export-surface snapshot (named-export completeness per subpath)"
# publint/attw validate the export MAP, not named-export completeness — a barrel that drops a
# named export (BP/p at 1.0.0) passes both and still hard-fails the consumer's build. Import the
# INSTALLED package's dist per subpath and diff Object.keys() against the committed snapshot.
PKGDIR="$(dirname "$ABS_TGZ")"
node --import "$PKGDIR/scripts/css-noop-register.mjs" "$PKGDIR/scripts/export-surface.mjs" \
  --base "$SCRATCH/node_modules/basalt-ui"

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
# Uses groupTokens' branded SeriesGroup, the BasaltRegister augmentation seam and SeriesKey — one
# per published surface.
cat >dist-vantage.ts <<'TS'
import type { BasaltRegister } from 'basalt-ui'
import { buildPaletteCss, defineSeries, groupTokens } from 'basalt-ui/tokens'
import type { SeriesKey } from 'basalt-ui'

// groupTokens returns a branded SeriesGroup that buildPaletteCss({ groups }) accepts
const _group = groupTokens('x', defineSeries({ a: { light: '#111111', dark: '#eeeeee' } }))
const _css = buildPaletteCss({ groups: [_group] })

// An un-augmented register is never-keyed; SeriesKey resolves (never when un-augmented)
const _k: keyof BasaltRegister = undefined as never
const _sk: SeriesKey = undefined as never

export { _css, _k, _sk }
TS
bunx tsc --project tsconfig.dist-vantage.json
echo "dist-vantage tsc OK"

echo "==> tsconfig \"extends\": \"basalt-ui/configs/*\" resolves via package exports"
# Undocumented-until-now, unverified-until-now (c6-target-surface open question 12): a bare
# `"extends": "basalt-ui/configs/tsconfig.react-app.json"` needs bundler-style package-exports
# resolution INSIDE tsconfig's own `extends` field, which is a different resolver than the one
# module specifiers use. Proves all three raw presets (`base`/`react-app`/`node`) resolve, not
# just one; `--showConfig` needs at least one real input file to print anything (TS18003 on an
# empty `include`), hence the throwaway probe file.
echo 'export const x = 1' >extends-probe.ts
for preset in base react-app node; do
  cat >"tsconfig.extends-$preset.json" <<JSON
{ "extends": "basalt-ui/configs/tsconfig.$preset.json", "include": ["extends-probe.ts"] }
JSON
  bunx tsc --showConfig --project "tsconfig.extends-$preset.json" >/dev/null
  echo "tsconfig extends basalt-ui/configs/tsconfig.$preset.json OK"
done
rm -f extends-probe.ts tsconfig.extends-base.json tsconfig.extends-react-app.json tsconfig.extends-node.json

echo "==> charts/tokens-only resolution + render"
SCRATCH2=$(mktemp -d)
cd "$SCRATCH2"
echo '{ "name": "scratch-free", "private": true, "type": "module" }' >package.json
# The chart layer's two subpath-required peers (docs/V2-SPEC.md § 9) and React — nothing else.
scratch_install "$ABS_TGZ" react react-dom "@tanstack/charts@1.5.0" "d3-scale@4.0.2"
cat >free.mjs <<'JS'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// The charts and tokens subpaths must load with no UI framework installed.
const charts = await import('basalt-ui/charts')
const tokens = await import('basalt-ui/tokens')
if (typeof tokens.buildPaletteCss !== 'function') throw new Error('tokens.buildPaletteCss missing')
if (typeof tokens.buildPaletteCss() !== 'string') throw new Error('buildPaletteCss() did not return a string')
// Render proof: a kind renders the engine's accessible SVG on the server, at the SSR width, with
// every paint a BASALT token ref (plain var() strings).
const data = [{ at: '2024-01-01', v: 10 }, { at: '2024-01-02', v: 20 }, { at: '2024-01-03', v: 15 }]
const html = renderToStaticMarkup(
  createElement(charts.Bars, {
    ariaLabel: 'Value',
    data,
    x: { value: (d) => new Date(`${d.at}T00:00:00Z`) },
    series: [
      {
        mark: 'bar',
        key: 'v',
        label: 'Value',
        color: { light: 'var(--basalt-accent)', dark: 'var(--basalt-accent)' },
        y: (d) => d.v,
      },
    ],
    y: { domain: [0, 30] },
  }),
)
if (!html.includes('<svg') || !html.includes('role="img"')) throw new Error('chart kind did not render an accessible <svg>')
console.log('charts/tokens-only resolution + render OK')
JS
# `--import css-noop-register` (same as the agent-chat step below): a chart part may import its own
# CSS module. Under `bundle: false` that import
# survives verbatim into dist for the consumer's bundler to resolve — bare Node cannot load a `.css`
# specifier, so without the register this step fails on an ERR_UNKNOWN_FILE_EXTENSION that says
# nothing about the layering it exists to prove.
node --import "$PKGDIR/scripts/css-noop-register.mjs" free.mjs

echo "==> controls resolve and render with only their own peers"
SCRATCH5=$(mktemp -d)
cd "$SCRATCH5"
echo '{ "name": "scratch-no-dates", "private": true, "type": "module" }' >package.json
# `./controls` draws `ui/*` (Base UI), the one peer its subpath-required list adds. The claim is that
# it resolves and RENDERS with every other optional peer genuinely absent, which no source-level
# test can prove: a lazy `import()` of a missing peer passes a static scan and fails here.
scratch_install "$ABS_TGZ" react react-dom @base-ui/react
cat >controls.mjs <<'JS'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const controls = await import('basalt-ui/controls')
for (const name of ['FilterSet', 'ViewTabs', 'spec', 'FormField', 'FormRow']) {
  if (typeof controls[name] !== 'function') throw new Error(`controls.${name} missing`)
}

// Render proof, not just a resolve: a real filter bound to a real field. `externalField` over a plain
// store is the router-free lane, so this needs no @tanstack/react-router either.
const { externalField } = await import('basalt-ui')
const memory = (key, options, fallback) => {
  let value = fallback
  const listeners = new Set()
  return externalField(
    {
      get: () => value,
      set: (next) => {
        value = next
        for (const listener of listeners) listener()
      },
      subscribe: (onChange) => {
        listeners.add(onChange)
        return () => listeners.delete(onChange)
      },
    },
    { key, kind: 'enum', fallback, options: options.map((v) => ({ value: v, label: v })) },
  )
}
const store = {
  field: {
    currency: memory('pack-test-currency', ['USD', 'EUR'], 'USD'),
    channel: memory('pack-test-channel', ['web', 'app'], 'web'),
  },
}
// TWO specs against the default `inline: 1` budget, deliberately: the mobile sheet pill exists
// only when the budget folded a child away, so a one-spec set proves the sheet nothing.
const tree = createElement(controls.FilterSet, {
  specs: [
    controls.spec(store.field.currency, 'Currency'),
    controls.spec(store.field.channel, 'Channel'),
  ],
})
const html = renderToStaticMarkup(tree)
// The pill prints its filter's name beside the SELECTED OPTION's label, at the field's fallback too
// (`Currency: USD`, `src/controls/filter-set-spec.tsx`). So the render proof is the two VALUES, which
// also proves BOTH children rendered rather than just the first.
if (!html.includes('USD')) throw new Error('FilterSet did not render its first child filter')
if (!html.includes('web')) throw new Error('FilterSet did not render its second child filter')
if (!html.includes('Filters')) throw new Error('FilterSet did not render its mobile sheet pill')
console.log('controls: resolution + render OK')

// The form parts, with no form library installed: resolve AND render.
for (const name of ['FormField', 'FormRow']) {
  if (typeof controls[name] !== 'function') throw new Error(`controls.${name} missing`)
}
const { Input } = await import('basalt-ui/ui/input')
const fieldLike = { state: { value: '', meta: { errors: [] } }, handleChange() {}, handleBlur() {} }
const rowHtml = renderToStaticMarkup(
  createElement(
    controls.FormRow,
    { legend: 'Contact' },
    createElement(controls.FormField, { label: 'Email', field: fieldLike }, createElement(Input)),
  ),
)
if (!rowHtml.includes('Email')) throw new Error('FormField did not render its label')
if (!rowHtml.includes('Contact')) throw new Error('FormRow did not render its legend')
console.log('controls: FormField and FormRow resolution + render OK')

// The retired 2.x date subpath is gone from the export map: it must not resolve at all.
let datesResolved = false
try {
  await import('basalt-ui/controls-dates')
  datesResolved = true
} catch (err) {
  if (err?.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
    console.error(err)
    throw new Error('basalt-ui/controls-dates failed for a reason OTHER than the removed export')
  }
}
if (datesResolved) throw new Error('basalt-ui/controls-dates still resolves; the 2.x subpath must stay removed')
console.log('controls-dates is no longer exported')
JS
node --import "$PKGDIR/scripts/css-noop-register.mjs" controls.mjs

echo "==> subpath-required peers: installed vs absent (docs/V2-SPEC.md § 1 Peers)"
# `peerDependenciesMeta` marks every subpath-required peer optional, and npm has no per-subpath
# optionality, so the ONLY proof that a classification holds is a pair of installs: the required
# peers alone (every subpath-required peer ABSENT), then the same tree plus the subpath-required
# peers (PRESENT). Absent: the root entry must still resolve (`.` reaches no subpath-required peer),
# and a subpath may either load or fail with ERR_MODULE_NOT_FOUND naming ITS OWN peer — never any
# other module. Present: every subpath must load. `remend` is genuinely optional (lazy `import()`)
# and is installed in neither tree, so the F2 regression (a static `remend` import in the root
# chain) shows up as the root entry failing in the absent pass.
SCRATCH4=$(mktemp -d)
cd "$SCRATCH4"
echo '{ "name": "scratch-peers", "private": true, "type": "module" }' >package.json
BASE_PEER_NAMES=()
while IFS= read -r name; do BASE_PEER_NAMES+=("$name"); done < <(bun "$PKGDIR/scripts/surface-peers.ts" base)
SUBPATH_PEER_NAMES=()
while IFS= read -r name; do SUBPATH_PEER_NAMES+=("$name"); done < <(bun "$PKGDIR/scripts/surface-peers.ts" subpath)
OWN_PEERS=$(bun "$PKGDIR/scripts/surface-peers.ts" own)
export OWN_PEERS
peer_array BASE_PEERS "${BASE_PEER_NAMES[@]}"
scratch_install "$ABS_TGZ" "${BASE_PEERS[@]}"
for absent in remend "${SUBPATH_PEER_NAMES[@]}"; do
  if [ -d "node_modules/$absent" ]; then
    echo "FAILED: $absent ended up in the React-only install — test setup is broken, not a package defect"
    exit 1
  fi
done
cat >peers.mjs <<'JS'
// subpath -> the peers whose absence may legitimately break it (V2-SPEC.md § 1 Peers). The
// subpath-required half is printed by scripts/surface-peers.ts from surface-gates.ts (OWN_PEERS);
// the peer-free subpaths are listed here so they are still imported.
const own = {
  ...JSON.parse(process.env.OWN_PEERS),
  'basalt-ui/tokens': [],
  // peer-free subpaths must load in both phases (`./router` and `./data` have subpath-required rows)
  'basalt-ui/lint': [],
  'basalt-ui/stylelint': [],
  'basalt-ui/testing': [],
  'basalt-ui/theme-script': [],
}
const phase = process.argv[2]
let failed = false
for (const [subpath, peers] of [['basalt-ui', []], ...Object.entries(own)]) {
  try {
    await import(subpath)
    console.log(`${phase}: ${subpath} loads`)
  } catch (err) {
    const named = peers.some((p) => String(err.message).includes(`'${p}`))
    if (phase === 'absent' && err.code === 'ERR_MODULE_NOT_FOUND' && named) {
      console.log(`absent: ${subpath} needs its own peer (${err.message.split("'")[1]})`)
      continue
    }
    console.error(`${phase}: ${subpath} failed unexpectedly:`, err.message)
    failed = true
  }
}
if (failed) process.exit(1)
JS
node --import "$PKGDIR/scripts/css-noop-register.mjs" peers.mjs absent
# vite is installed at the pinned version below, not at its declared range (see the first install).
INSTALL_PEER_NAMES=()
for name in "${SUBPATH_PEER_NAMES[@]}"; do [ "$name" = vite ] || INSTALL_PEER_NAMES+=("$name"); done
peer_array SUBPATH_PEERS "${INSTALL_PEER_NAMES[@]}"
scratch_install "$ABS_TGZ" "${SUBPATH_PEERS[@]}" "@tanstack/react-virtual@>=3.14.0 <4" "vite@8.0.16"
node --import "$PKGDIR/scripts/css-noop-register.mjs" peers.mjs present

# V2-SPEC § 8 Store row: Router, Table and Hotkeys all depend on @tanstack/react-store (and it on
# @tanstack/store); the cost of Table v9 is only the one-off +4 kB if the tree dedupes them. A nested
# second copy means a consumer pays twice and holds two stores, so fail loudly on any.
for store_pkg in react-store store; do
  store_versions=$(bun pm ls --all | grep -oE "@tanstack/$store_pkg@[0-9][^ ]*" | sort -u || true)
  if [ "$(printf '%s\n' "$store_versions" | grep -c .)" -ne 1 ]; then
    echo "pack-test: expected exactly ONE @tanstack/$store_pkg version in the scratch tree, found:"
    printf '%s\n' "$store_versions"
    exit 1
  fi
done
echo "@tanstack/react-store + @tanstack/store dedupe to one version each"
echo "subpath-required peers OK (absent: own-peer failures only; present: every subpath loads)"

echo "==> ./styles.css bundles for a consumer (layer + head-digits font)"
# The shipped stylesheet must bundle with the bundler consumers run (Vite, i.e. Rolldown): its `@layer
# basalt` block survives and the head-digits face's url() resolves to the emitted Nunito woff2 asset
# from the packed tarball.
cat >styles-proof.mjs <<'JS'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { build } from 'vite'
const require = createRequire(import.meta.url)
const css = readFileSync(require.resolve('basalt-ui/styles.css'), 'utf8')
mkdirSync('styles-proof', { recursive: true })
// The sheet is bundled from the installed package, not a copy: its font url() is relative to it.
writeFileSync('styles-proof/main.js', "import 'basalt-ui/styles.css'\n")
const result = await build({
  configFile: false,
  logLevel: 'silent',
  root: 'styles-proof',
  build: { write: false, rolldownOptions: { input: 'main.js' } },
})
const bundle = Array.isArray(result) ? result[0] : result
const out = bundle.output.filter((o) => o.fileName.endsWith('.css')).map((o) => String(o.source)).join('\n')
if (!out.includes('@layer basalt{')) throw new Error('@layer basalt is missing from the bundled CSS')
if (css.includes('@mantine/')) throw new Error('the shipped styles.css still imports a 2.x UI-stack package')
if (!/@font-face\s*\{[^}]*Basalt Head Digits/.test(css)) throw new Error("the shipped styles.css lacks the 'Basalt Head Digits' @font-face")
const digitsFont = bundle.output.find((o) => /nunito-sans-latin-wght-normal.*\.woff2$/.test(o.fileName))
if (!digitsFont) throw new Error('the Basalt Head Digits url() did not resolve to a Nunito woff2 asset in the bundled CSS')
const face = out.match(/@font-face\s*\{[^}]*Basalt Head Digits[^}]*\}/)?.[0] ?? ''
if (!face.includes(digitsFont.fileName)) throw new Error('the bundled Basalt Head Digits @font-face does not point at the emitted woff2')
console.log('styles.css bundles; head-digits font resolves')

// fonts.css alone (what static-site.md and tailwind.css give a consumer): every face's url() resolves to an
// emitted woff2 and Vite warns about none.
const warnings = []
mkdirSync('fonts-proof', { recursive: true })
writeFileSync('fonts-proof/main.js', "import 'basalt-ui/fonts.css'\n")
const fonts = await build({
  configFile: false,
  logLevel: 'warn',
  customLogger: { info() {}, warn: (m) => warnings.push(m), warnOnce: (m) => warnings.push(m), error: (m) => warnings.push(m), clearScreen() {}, hasErrorLogged: () => false, hasWarned: false },
  root: 'fonts-proof',
  build: { write: false, assetsInlineLimit: 0, rolldownOptions: { input: 'main.js' } },
})
const fontBundle = Array.isArray(fonts) ? fonts[0] : fonts
const woff2 = fontBundle.output.filter((o) => o.fileName.endsWith('.woff2'))
const fontCss = fontBundle.output.filter((o) => o.fileName.endsWith('.css')).map((o) => String(o.source)).join('\n')
if (woff2.length !== 6) throw new Error(`fonts.css emitted ${woff2.length} woff2 assets, expected 6`)
if (/url\(['"]?(\.\/|@)/.test(fontCss) || warnings.length) throw new Error(`fonts.css left a font url() unresolved: ${warnings.join(' | ')}`)
console.log('fonts.css bundles; six woff2 faces resolve')
JS
node styles-proof.mjs

echo "==> tokens-only install is light (no peers at all)"
# The property this whole change exists to prove: a consumer who only wants the token layer
# installs basalt-ui and gets NOTHING else — no chart engine and no React (the three fonts ride along as dependencies). Every
# peer above (including the fourteen moved out of `dependencies` in this change) is optional, so a
# bare `bun add basalt-ui` must not pull any of them in transitively.
SCRATCH3=$(mktemp -d)
cd "$SCRATCH3"
echo '{ "name": "scratch-light", "private": true, "type": "module" }' >package.json
scratch_install "$ABS_TGZ"
if [ -d node_modules/@tanstack/charts ]; then
  echo "FAILED: @tanstack/charts present in a tokens-only install — the engine is an optional peer"
  exit 1
fi
cat >light.mjs <<'JS'
const tokens = await import('basalt-ui/tokens')
if (typeof tokens.buildPaletteCss !== 'function') throw new Error('tokens.buildPaletteCss missing')
if (typeof tokens.buildPaletteCss() !== 'string') throw new Error('buildPaletteCss() did not return a string')
console.log('tokens-only resolution OK, no chart engine in tree')
JS
node light.mjs
echo "tokens-only install is light OK"

echo "==> blocks: basalt-ui add installs every block into a fresh app that typechecks and lints at error"
# The block tier's promise (docs/v3/BENCHMARK-ACCORDEE-BLUEPRINT.md section 6): a block copied out of
# the TARBALL compiles where it lands, with no import rewrite and no waiver. A fresh app with a bare
# manifest, the peers, the recommended icon set and zod; then add, tsc and oxlint on the app preset.
SCRATCH6=$(mktemp -d)
cd "$SCRATCH6"
echo '{ "name": "scratch-blocks", "private": true, "type": "module" }' >package.json
OXLINT_VERSION=$(node -p "require('$PWD_PKG/../../package.json').devDependencies.oxlint")
TS_VERSION=$(node -p "require('$PWD_PKG/package.json').devDependencies.typescript")
TYPES_REACT=$(node -p "require('$PWD_PKG/package.json').devDependencies['@types/react']")
scratch_install "$ABS_TGZ" "${ALL_PEERS[@]}" "vite@8.0.16" "typescript@$TS_VERSION" "oxlint@$OXLINT_VERSION" \
  "@types/react@$TYPES_REACT" "@types/react-dom@$TYPES_REACT" lucide-react zod
mkdir -p .basalt src
echo '{ "profile": "app", "version": "", "roots": { "src": "app" } }' >.basalt/manifest.json
cat >tsconfig.json <<'JSON'
{
  "extends": "basalt-ui/configs/tsconfig.react-app.json",
  "compilerOptions": { "noEmit": true, "types": [] },
  "include": ["src"]
}
JSON
echo '{ "extends": ["./node_modules/basalt-ui/configs/oxlint-app.json"] }' >.oxlintrc.json
./node_modules/.bin/basalt-ui add --list
BLOCKS=$(./node_modules/.bin/basalt-ui add --list | awk '{ print $1 }')
# shellcheck disable=SC2086 # one argument per block name
./node_modules/.bin/basalt-ui add $BLOCKS
for block in $BLOCKS; do
  [ -f ".basalt/base/src/blocks/$block/block.json" ] && { echo "FAILED: block.json was installed"; exit 1; }
  [ -d "src/blocks/$block" ] || { echo "FAILED: $block was not installed"; exit 1; }
done
./node_modules/.bin/tsc -p tsconfig.json
./node_modules/.bin/oxlint -c .oxlintrc.json --deny-warnings src
echo "blocks: $(echo $BLOCKS | wc -w | tr -d ' ') added; tsc and oxlint (app preset, deny warnings) clean"

echo "==> consumers: the tarball through init, build and render, app and site (scripts/pack-consumers.sh)"
bash "$PWD_PKG/scripts/pack-consumers.sh" "$ABS_TGZ"

echo "PACK TEST PASSED"
