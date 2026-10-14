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
bunx attw "$TGZ" --profile esm-only --ignore-rules cjs-resolves-to-esm named-exports --exclude-entrypoints ./styles.css

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
  dist/commands/index.js dist/commands/index.d.ts \
  dist/agent/index.js dist/agent/index.d.ts \
  dist/state.js dist/state.d.ts \
  dist/vite.js dist/vite.d.ts \
  dist/cli/index.js dist/styles.css \
  dist/shell/index.js \
  dist/shell/app-sidebar.module.css dist/shell/app-mobile-nav.module.css dist/shell/app-header.module.css \
  dist/controls/index.js dist/controls/index.d.ts dist/controls/controls.module.css \
  dist/controls-dates/index.js dist/controls-dates/index.d.ts \
  src/index.ts \
  configs/oxlint.json configs/oxlint-basalt.json configs/tsconfig.base.json configs/tsconfig.react-app.json \
  agent/rules/basalt-tokens.md agent/rules/basalt-charts.md agent/rules/basalt-batteries.md \
  agent/templates/DESIGN.md.tpl agent/templates/AGENTS-block.md.tpl \
  agent/skills/basalt-app/SKILL.md agent/skills/basalt-charts/SKILL.md \
  agent/skills/basalt-design/SKILL.md \
  llms.txt \
  bin/basalt-ui.mjs; do require "$f"; done
# CSS-module type decls must NOT be transpiled into runtime JS (the tsup *.d.ts exclude).
# The retired rule files must not ship either: `files` globs `agent/`, so a rule deleted from the
# repo but left in a stale worktree would be published and placed into consumers by `sync`.
for f in src/index.css src/starlight.css tailwind.config.js MAINTAINING.md \
  agent/rules/basalt-router.md agent/rules/basalt-app.md agent/rules/basalt-query.md \
  dist/shell/app-sidebar.module.css.d.js dist/shell/app-mobile-nav.module.css.d.js \
  dist/shell/app-header.module.css.d.js; do forbid "$f"; done
# forbid() above is an exact-string match, so the test-artifact patterns need their own regex
# check: src/**/*.test.ts(x) (files:["src/"] ships every source, including tests) and
# dist/**/*.test.d.ts(.map) (tsc --emitDeclarationOnly has no test exclude of its own).
if grep -qE '^package/(src|dist)/.*\.test\.(ts|tsx|d\.ts)(\.map)?$' "$LISTFILE"; then
  echo "FORBIDDEN in tarball: test artifacts present"
  grep -E '^package/(src|dist)/.*\.test\.' "$LISTFILE" | head -20
  exit 1
fi
echo "tarball contents OK"

echo "==> tarball parity (every CLI-read source ships in the artifact)"
node scripts/check-tarball-parity.mjs "$LISTFILE"

echo "==> dist layering guard (Mantine-free subpaths + root-barrel re-export)"
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
trap 'rm -rf "$SCRATCH" "$SCRATCH2" "$SCRATCH3" "$SCRATCH4" "$SCRATCH5"; rm -f "$LISTFILE"' EXIT
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
  'basalt-ui/controls-dates',
  'basalt-ui/forms',
  'basalt-ui/state',
  'basalt-ui/table',
  'basalt-ui/format',
  'basalt-ui/commands',
  'basalt-ui/agent',
  'basalt-ui/content',
  'basalt-ui/vite',
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

// the Mantine-free, React-free format entry must load and format
const format = await import('basalt-ui/format')
if (typeof format.money !== 'function') throw new Error('format.money missing')
if (format.money(1234, { currency: 'USD', locale: 'en-US' }) !== '$1,234') {
  throw new Error('format.money did not format as expected')
}

// the raw oxlint preset must resolve via ./configs/* and be valid JSON
JSON.parse(readFileSync(require.resolve('basalt-ui/configs/oxlint.json'), 'utf8'))
JSON.parse(readFileSync(require.resolve('basalt-ui/configs/oxlint-basalt.json'), 'utf8'))

// headless adapter smoke imports (peers installed — these load without a DOM/provider)
const agentMod = await import('basalt-ui/agent')
if (typeof agentMod.aiSdkTransport !== 'function') throw new Error('agent.aiSdkTransport missing')
console.log('smoke: basalt-ui/agent OK')

const stateMod = await import('basalt-ui/state')
if (typeof stateMod.createSearchStore !== 'function') throw new Error('state.createSearchStore missing')
console.log('smoke: basalt-ui/state OK')

console.log(`scratch resolution OK (${subpaths.length} subpaths)`)
JS
# `./agent` ships the Mantine chat UI, whose CSS-module imports plain Node cannot load.
node --import "$(dirname "$ABS_TGZ")/scripts/css-noop-register.mjs" test.mjs

echo "==> export-surface snapshot (named-export completeness per subpath)"
# publint/attw validate the export MAP, not named-export completeness — a barrel that drops a
# named export (BP/p at 1.0.0) passes both and still hard-fails the consumer's build. Import the
# INSTALLED package's dist per subpath and diff Object.keys() against the committed snapshot.
PKGDIR="$(dirname "$ABS_TGZ")"
node --import "$PKGDIR/scripts/css-noop-register.mjs" "$PKGDIR/scripts/export-surface.mjs" \
  --base "$SCRATCH/node_modules/basalt-ui"

echo "==> scratch-consumer oxlint preset contract (extends the shipped preset for real)"
# Exercises the real consumer contract against the tarball: a fresh .oxlintrc.json that
# extends the shipped preset via the documented node_modules-relative path, linted for real.
# A config PARSE failure (e.g. an unknown top-level key) must fail the pack test; ordinary
# lint findings on the trivial fixture below are expected and must NOT fail it.
# Both presets: the full one, and the guards-only one it extends. The `.tsx` fixture trips
# basalt/card-inset, proving the chained extends still loads the plugin from inside the tarball.
cat >lint-fixture.tsx <<'TSX'
import { Card } from '@mantine/core'
export const ScratchLintFixture = () => <Card padding="md" />
TSX
# Captured to a file, then grepped from the file — same reason as `require` above: a
# `echo "$VAR" | grep -q` pipeline can report SIGPIPE (141) instead of grep's own verdict.
OXLINT_LOG=$(mktemp)
for preset in oxlint oxlint-basalt; do
  printf '{ "extends": ["./node_modules/basalt-ui/configs/%s.json"] }\n' "$preset" >.oxlintrc.json
  set +e
  bunx oxlint lint-fixture.tsx >"$OXLINT_LOG" 2>&1
  set -e
  cat "$OXLINT_LOG"
  if grep -qiF "failed to parse" "$OXLINT_LOG"; then
    echo "FAILED: shipped $preset.json does not parse for a real consumer (config parse failure)"
    exit 1
  fi
  if ! grep -qF "basalt/card-inset" "$OXLINT_LOG"; then
    echo "FAILED: extending $preset.json did not run the basalt/* rules"
    exit 1
  fi
done
echo "scratch-consumer oxlint preset contract OK"

echo "==> scratch-consumer theme guard (the shipped rules, run against a consumer tree)"
# The only step here that exercises the guard the way a CONSUMER meets it: the real CLI, from the
# real tarball, over a real `basalt.roots` tree. Every other gate above checks the artifact's SHAPE.
#
# Added because two enforcement bugs shipped and were found by a consumer within the hour: a step
# list that had drifted from the token scale (so `p={16}` was flagged in favour of a token worth
# 18), and a CSS-module scan with no sub-scale escape (so a 4px cluster gap was unfixable). Both
# are invisible to publint/attw/export-surface — they are about what the guard SAYS, not what the
# package contains. The fixture below encodes one of each direction: something that must flag, and
# something that must not.
bun -e "
import { readFileSync, writeFileSync } from 'node:fs'
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
pkg.basalt = { roots: ['guard-fixture'] }
writeFileSync('package.json', JSON.stringify(pkg))
"
mkdir -p guard-fixture
# The spacing line is GENERATED from the tarball's own `deriveSpacing(0).scale.md`, never typed as
# a literal: the bug being guarded against IS a literal that stopped matching the scale. Written
# this way, the step asserts the shipped guard and the shipped tokens agree — from a consumer's
# vantage, against the real artifact — which is the check that was missing when they disagreed.
# `deriveSpacing` is internal since 2.0, so it is read off the installed file, not the export map.
bun -e "
import { deriveSpacing } from './node_modules/basalt-ui/dist/tokens/palette.js'
import { writeFileSync } from 'node:fs'
const md = deriveSpacing(0).scale.md
writeFileSync(
  'guard-fixture/violation.tsx',
  \`export const Swatch = () => <div style={{ color: '#ff00ff' }} p={\${md}} />\n\`,
)
console.log('guard fixture: scale md =', md)
"
# Sub-scale micro-spacing in CSS: doctrine says allowed raw (no token exists below the scale
# floor), so a finding here is the guard contradicting its own rule file.
cat >guard-fixture/ok.module.css <<'CSS'
.cluster {
  gap: 2px;
  padding: 4px 8px;
}
CSS
GUARD_LOG=$(mktemp)
set +e
bunx basalt-ui check-theme >"$GUARD_LOG" 2>&1
GUARD_EXIT=$?
set -e
cat "$GUARD_LOG"
if [ "$GUARD_EXIT" -eq 0 ]; then
  echo "FAILED: check-theme passed a tree containing a raw hex — the shipped guard is not enforcing"
  exit 1
fi
if ! grep -qF "raw-hex" "$GUARD_LOG"; then
  echo "FAILED: check-theme did not report the raw hex in guard-fixture/violation.tsx"
  exit 1
fi
if ! grep -qF "raw-spacing" "$GUARD_LOG"; then
  echo "FAILED: the guard's spacing steps have drifted from deriveSpacing()'s scale — a prop value"
  echo "        equal to the shipped \`md\` stop went unflagged. This is the 1.2.0 bug."
  exit 1
fi
if grep -qF "ok.module.css" "$GUARD_LOG"; then
  echo "FAILED: check-theme flagged sub-scale CSS micro-spacing, which basalt-tokens.md allows raw"
  exit 1
fi
rm -rf guard-fixture "$GUARD_LOG" "$OXLINT_LOG"
echo "scratch-consumer theme guard OK"

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
# Uses createBasaltTheme's literal-union knobs, groupTokens' branded SeriesGroup, the BasaltRegister
# augmentation seam and SeriesKey — one per published surface.
cat >dist-vantage.ts <<'TS'
import { createBasaltTheme } from 'basalt-ui'
import type { BasaltRegister } from 'basalt-ui'
import { buildPaletteCss, defineSeries, groupTokens } from 'basalt-ui/tokens'
import type { SeriesKey } from 'basalt-ui'

// radius/density are literal unions (V2-SPEC section 3)
const _theme = createBasaltTheme(undefined, { radius: 2, density: -1 })

// groupTokens returns a branded SeriesGroup that paletteOptions.groups accepts
const _group = groupTokens('x', defineSeries({ a: { light: '#111111', dark: '#eeeeee' } }))
const _css = buildPaletteCss({ groups: [_group] })

// An un-augmented register is never-keyed; SeriesKey resolves (never when un-augmented)
const _k: keyof BasaltRegister = undefined as never
const _sk: SeriesKey = undefined as never

export { _theme, _css, _k, _sk }
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

echo "==> charts/tokens-only (no-Mantine) resolution + render"
SCRATCH2=$(mktemp -d)
cd "$SCRATCH2"
echo '{ "name": "scratch-free", "private": true, "type": "module" }' >package.json
# The chart layer's two subpath-required peers (docs/V2-SPEC.md § 9) and React — nothing else.
scratch_install "$ABS_TGZ" react react-dom "@tanstack/charts@1.1.0" "d3-scale@4.0.2"
cat >free.mjs <<'JS'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// The Mantine-free subpaths must load with NO @mantine installed.
const charts = await import('basalt-ui/charts')
const tokens = await import('basalt-ui/tokens')
if (typeof tokens.buildPaletteCss !== 'function') throw new Error('tokens.buildPaletteCss missing')
if (typeof tokens.buildPaletteCss() !== 'string') throw new Error('buildPaletteCss() did not return a string')
// Render proof: a kind renders the engine's accessible SVG on the server, at the SSR width, with
// every paint a VX token ref (plain var() strings).
const data = [{ at: '2024-01-01', v: 10 }, { at: '2024-01-02', v: 20 }, { at: '2024-01-03', v: 15 }]
const html = renderToStaticMarkup(
  createElement(charts.Bars, {
    ariaLabel: 'Value',
    data,
    x: (d) => new Date(`${d.at}T00:00:00Z`),
    bars: [{ key: 'v', label: 'Value', color: 'var(--vx-accent)', getValue: (d) => d.v }],
    y: { domain: [0, 30] },
  }),
)
if (!html.includes('<svg') || !html.includes('role="img"')) throw new Error('chart kind did not render an accessible <svg>')
console.log('charts/tokens-only resolution + render OK')
JS
# `--import css-noop-register` (same as the agent-chat step below): `ChartCard` composes the
# Mantine-free `WidgetHeader`, which imports its own CSS module. Under `bundle: false` that import
# survives verbatim into dist for the consumer's bundler to resolve — bare Node cannot load a `.css`
# specifier, so without the register this step fails on an ERR_UNKNOWN_FILE_EXTENSION that says
# nothing about the layering it exists to prove.
node --import "$PKGDIR/scripts/css-noop-register.mjs" free.mjs

echo "==> controls without @mantine/dates (the optional peer only ./controls-dates needs)"
# `@mantine/dates` is an optional peer, and only ONE subpath needs it. The claim `docs/CONTROLS-SPEC.md`
# §3 makes — and that linewatch, which has no date picker, depends on — is that `basalt-ui/controls`
# resolves and RENDERS with the peer genuinely absent, which no source-level test can prove: a lazy
# `import('@mantine/dates')` anywhere under `src/controls/**` passes a static scan and fails here.
# The mirror of the charts/tokens-only step above, and asserted in BOTH directions: `./controls`
# resolves, `./controls-dates` does not, so the split is load-bearing rather than decorative.
SCRATCH5=$(mktemp -d)
cd "$SCRATCH5"
echo '{ "name": "scratch-no-dates", "private": true, "type": "module" }' >package.json
scratch_install "$ABS_TGZ" react react-dom @mantine/core @mantine/hooks
if [ -d node_modules/@mantine/dates ]; then
  echo "FAILED: @mantine/dates ended up in a scratch install that never requested it — test setup is broken, not a package defect"
  exit 1
fi
# Same for `@mantine/form`: the form layout (FormRow & co) lives in ./controls since 1.36.0 so a
# consumer rendering one never installs the form library. ./forms is the subpath that needs it.
if [ -d node_modules/@mantine/form ]; then
  echo "FAILED: @mantine/form ended up in a scratch install that never requested it — test setup is broken, not a package defect"
  exit 1
fi
cat >controls.mjs <<'JS'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MantineProvider } from '@mantine/core'

const controls = await import('basalt-ui/controls')
for (const name of ['FilterSet', 'RangeFilter', 'SelectFilter', 'MultiSelectFilter', 'SearchFilter', 'ToggleFilter', 'ViewTabs']) {
  if (typeof controls[name] !== 'function') throw new Error(`controls.${name} missing`)
}

// Render proof, not just a resolve: a real filter bound to a real field. `createLocalStore` is the
// router-free lane, so this needs no @tanstack/react-router either — and createPersistedState is
// SSR-safe, so the handle resolves to its fallback under renderToStaticMarkup.
const { createLocalStore, field } = await import('basalt-ui/state')
const store = createLocalStore({
  key: 'pack-test-controls',
  fields: {
    currency: field.enum(['USD', 'EUR'], 'USD'),
    channel: field.enum(['web', 'app'], 'web'),
  },
})
// TWO filters against the default `inline: 1` budget, deliberately: the mobile sheet pill exists
// only when the budget folded a child away, so a one-filter set proves the sheet nothing.
const tree = createElement(
  MantineProvider,
  null,
  createElement(
    controls.FilterSet,
    null,
    createElement(controls.SelectFilter, { field: store.field.currency, label: 'Currency' }),
    createElement(controls.SelectFilter, { field: store.field.channel, label: 'Channel' }),
  ),
)
const html = renderToStaticMarkup(tree)
// The pill prints the SELECTED OPTION's label, at the field's fallback too — `Currency`/`Channel`
// name the popover and the accessible name and are never printed on the pill
// (`src/controls/enum-filter.tsx`). So the render proof is the two VALUES, which also proves BOTH
// children rendered rather than just the first.
if (!html.includes('USD')) throw new Error('FilterSet did not render its first child filter')
if (!html.includes('web')) throw new Error('FilterSet did not render its second child filter')
if (!html.includes('Filters')) throw new Error('FilterSet did not render its mobile sheet pill')
console.log('controls without @mantine/dates: resolution + render OK')

// The form layout, with `@mantine/form` genuinely absent: resolves AND renders.
for (const name of ['FormRow', 'FormGroup']) {
  if (typeof controls[name] !== 'function') throw new Error(`controls.${name} missing`)
}
const rowHtml = renderToStaticMarkup(
  createElement(
    MantineProvider,
    null,
    createElement(controls.FormRow, { label: 'Email' }, createElement('input', { name: 'email' })),
  ),
)
if (!rowHtml.includes('Email')) throw new Error('FormRow did not render its label')
console.log('controls without @mantine/form: FormRow resolution + render OK')

// The other direction: the split is only worth having if the peer is genuinely required THERE.
let datesResolved = false
try {
  await import('basalt-ui/controls-dates')
  datesResolved = true
} catch (err) {
  if (!String(err).includes('@mantine/dates')) {
    console.error(err)
    throw new Error('basalt-ui/controls-dates failed for a reason OTHER than the absent @mantine/dates peer')
  }
}
if (datesResolved) {
  throw new Error(
    'basalt-ui/controls-dates resolved with @mantine/dates NOT installed — either the peer moved out ' +
      'of that subpath (then it belongs on ./controls and this step is wrong) or the import went lazy ' +
      '(then the subpath silently no-ops for a consumer missing the peer).',
  )
}
console.log('controls-dates correctly requires @mantine/dates')
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
REQUIRED_PEER_NAMES=()
while IFS= read -r name; do REQUIRED_PEER_NAMES+=("$name"); done < <(bun "$PKGDIR/scripts/surface-peers.ts" required)
SUBPATH_PEER_NAMES=()
while IFS= read -r name; do SUBPATH_PEER_NAMES+=("$name"); done < <(bun "$PKGDIR/scripts/surface-peers.ts" subpath)
OWN_PEERS=$(bun "$PKGDIR/scripts/surface-peers.ts" own)
export OWN_PEERS
peer_array REQUIRED_PEERS "${REQUIRED_PEER_NAMES[@]}"
scratch_install "$ABS_TGZ" "${REQUIRED_PEERS[@]}"
for absent in remend "${SUBPATH_PEER_NAMES[@]}"; do
  if [ -d "node_modules/$absent" ]; then
    echo "FAILED: $absent ended up in the required-peers-only install — test setup is broken, not a package defect"
    exit 1
  fi
done
cat >peers.mjs <<'JS'
// subpath -> the peers whose absence may legitimately break it (V2-SPEC.md § 1 Peers). The
// subpath-required half is printed by scripts/surface-peers.ts from surface-gates.ts (OWN_PEERS);
// the peer-free subpaths are listed here so they are still imported.
const own = {
  ...JSON.parse(process.env.OWN_PEERS),
  'basalt-ui/controls': [],
  'basalt-ui/state': [],
  'basalt-ui/format': [],
  'basalt-ui/tokens': [],
}
const phase = process.argv[2]
let failed = false
for (const [subpath, peers] of [['basalt-ui', []], ...Object.entries(own)]) {
  try {
    await import(subpath)
    console.log(`${phase}: ${subpath} loads`)
  } catch (err) {
    // Deferred gap (surface-gates DEFERRED_PEER_GAPS): the root's ThemeToggle still imports motion
    // until V2-SPEC section 5 lands (W7).
    const deferred = subpath === 'basalt-ui' && String(err.message).includes("'motion")
    if (phase === 'absent' && err.code === 'ERR_MODULE_NOT_FOUND' && deferred) {
      console.log('absent: basalt-ui still needs motion (ThemeToggle, deferred to W7)')
      continue
    }
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
scratch_install "$ABS_TGZ" "${SUBPATH_PEERS[@]}" "use-stick-to-bottom@^1.1.6" "@tanstack/react-virtual@>=3.14.0 <4" "vite@8.0.16"
node --import "$PKGDIR/scripts/css-noop-register.mjs" peers.mjs present

# V2-SPEC § 8 Store row: Router, Table and Hotkeys all depend on @tanstack/react-store (and it on
# @tanstack/store); the cost of Table v9 is only the one-off +4 kB if the tree dedupes them. A nested
# second copy means a consumer pays twice and holds two stores, so fail loudly on any.
for store_pkg in react-store store; do
  store_versions=$(bun pm ls --all | grep -oE "@tanstack/$store_pkg@[0-9][^ ]*" | sort -u)
  if [ "$(printf '%s\n' "$store_versions" | grep -c .)" -ne 1 ]; then
    echo "pack-test: expected exactly ONE @tanstack/$store_pkg version in the scratch tree, found:"
    printf '%s\n' "$store_versions"
    exit 1
  fi
done
echo "@tanstack/react-store + @tanstack/store dedupe to one version each"
echo "subpath-required peers OK (absent: own-peer failures only; present: every subpath loads)"

echo "==> ./styles.css @importing Mantine's layer CSS (V2-SPEC.md § 1 Open)"
# The shipped stylesheet must itself `@import '@mantine/core/styles.layer.css'`, and bundling it with
# the bundler consumers run (Vite, i.e. Rolldown) must land Mantine's `@layer mantine` block before
# `@layer basalt`, so basalt wins by layer order exactly as the declared `@layer mantine, basalt;`
# promises. The `@layer` statement itself is folded away by the bundler; declaration order is what
# survives, so that is what is asserted.
cat >styles-proof.mjs <<'JS'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { build } from 'vite'
const require = createRequire(import.meta.url)
const css = readFileSync(require.resolve('basalt-ui/styles.css'), 'utf8')
if (!css.includes("@import '@mantine/core/styles.layer.css'")) {
  throw new Error("the shipped styles.css does not `@import '@mantine/core/styles.layer.css'`")
}
mkdirSync('styles-proof', { recursive: true })
writeFileSync('styles-proof/styles.css', css)
writeFileSync('styles-proof/main.js', "import './styles.css'\n")
const result = await build({
  configFile: false,
  logLevel: 'silent',
  root: 'styles-proof',
  build: { write: false, rolldownOptions: { input: 'main.js' } },
})
const bundle = Array.isArray(result) ? result[0] : result
const out = bundle.output.filter((o) => o.fileName.endsWith('.css')).map((o) => String(o.source)).join('\n')
const mantine = out.indexOf('@layer mantine{')
const basalt = out.indexOf('@layer basalt{')
if (mantine === -1 || basalt === -1) throw new Error(`layers missing from the bundled CSS (mantine ${mantine}, basalt ${basalt})`)
if (mantine > basalt) throw new Error('@layer basalt precedes @layer mantine: basalt would lose to Mantine')
if (!out.includes('--mantine-color-scheme')) throw new Error('Mantine rules are missing from the bundled CSS')
console.log('styles.css + Mantine layer CSS OK (shipped import)')
JS
node styles-proof.mjs

echo "==> tokens-only install is light (no peers at all)"
# The property this whole change exists to prove: a consumer who only wants the token layer
# installs basalt-ui and gets NOTHING else — no chart engine, no fonts, no Mantine. Every
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

echo "PACK TEST PASSED"
