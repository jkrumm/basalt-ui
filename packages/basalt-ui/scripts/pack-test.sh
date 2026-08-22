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
bunx attw "$TGZ" --profile esm-only --ignore-rules cjs-resolves-to-esm named-exports --exclude-entrypoints ./styles.css ./tokens.css ./llms.txt

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
  dist/guard/index.js dist/guard/index.d.ts \
  dist/state.js dist/state.d.ts \
  dist/vite.js dist/vite.d.ts \
  dist/theme-lab/index.js dist/cli/index.js dist/styles.css dist/tokens.css \
  dist/shell/index.js \
  dist/shell/app-sidebar.module.css dist/shell/app-mobile-nav.module.css dist/shell/app-header.module.css \
  src/index.ts \
  configs/oxlint.json configs/tsconfig.base.json configs/tsconfig.react-app.json \
  agent/rules/basalt-tokens.md agent/rules/basalt-charts.md \
  agent/templates/DESIGN.md.tpl agent/templates/CLAUDE-block.md.tpl \
  agent/skills/basalt-app/SKILL.md agent/skills/basalt-charts/SKILL.md \
  agent/skills/basalt-design/SKILL.md \
  llms.txt \
  bin/basalt-ui.mjs; do require "$f"; done
# CSS-module type decls must NOT be transpiled into runtime JS (the tsup *.d.ts exclude).
for f in src/index.css src/starlight.css tailwind.config.js \
  dist/shell/app-sidebar.module.css.d.js dist/shell/app-mobile-nav.module.css.d.js \
  dist/shell/app-header.module.css.d.js; do forbid "$f"; done
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

echo "==> scratch-consumer resolution test (with optional peers)"
ABS_TGZ="$PWD/$TGZ"
SCRATCH=$(mktemp -d)
SCRATCH2=""
SCRATCH3=""
SCRATCH4=""
trap 'rm -rf "$SCRATCH" "$SCRATCH2" "$SCRATCH3" "$SCRATCH4"; rm -f "$LISTFILE"' EXIT
cd "$SCRATCH"
echo '{ "name": "scratch", "private": true, "type": "module" }' >package.json
scratch_install "$ABS_TGZ" \
  react react-dom \
  @mantine/core @mantine/hooks \
  @mantine/form @mantine/notifications @mantine/spotlight @mantine/modals \
  "@tanstack/react-query@^5.101.0" "@tanstack/react-query-devtools@^5.101.0" \
  "@tanstack/react-router@^1.170.0" \
  "@tanstack/react-table@>=8 <9" "@tanstack/react-virtual@>=3.13.26 <4" \
  "react-markdown@^10.1.0" "remark-gfm@^4.0.1" \
  "use-stick-to-bottom@^1.1.6" \
  vite \
  typescript \
  "@visx/axis@4.0.0" "@visx/curve@4.0.0" "@visx/event@4.0.0" "@visx/grid@4.0.0" \
  "@visx/group@4.0.0" "@visx/responsive@4.0.0" "@visx/scale@4.0.0" "@visx/shape@4.0.0" \
  "@visx/threshold@4.0.0" \
  "motion@12.42.0" "remend@1.3.0" \
  "@fontsource-variable/hubot-sans@5.2.8" "@fontsource-variable/jetbrains-mono@5.2.8" \
  "@fontsource-variable/nunito-sans@5.2.7"
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
  'basalt-ui/tokens.css',
  'basalt-ui/query',
  'basalt-ui/router-tanstack',
  'basalt-ui/forms',
  'basalt-ui/notifications',
  'basalt-ui/commands',
  'basalt-ui/data',
  'basalt-ui/data/table',
  'basalt-ui/data/virtual',
  'basalt-ui/agent',
  'basalt-ui/agent-chat',
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

console.log('scratch resolution OK (20 subpaths)')
JS
node test.mjs

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
cat >.oxlintrc.json <<'JSON'
{ "extends": ["./node_modules/basalt-ui/configs/oxlint.json"] }
JSON
cat >lint-fixture.ts <<'TS'
export const scratchLintFixture = 1
TS
# Captured to a file, then grepped from the file — same reason as `require` above: a
# `echo "$VAR" | grep -q` pipeline can report SIGPIPE (141) instead of grep's own verdict.
OXLINT_LOG=$(mktemp)
set +e
bunx oxlint lint-fixture.ts >"$OXLINT_LOG" 2>&1
set -e
cat "$OXLINT_LOG"
if grep -qiF "failed to parse" "$OXLINT_LOG"; then
  echo "FAILED: shipped oxlint preset does not parse for a real consumer (config parse failure)"
  exit 1
fi
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
bun -e "
import { deriveSpacing } from 'basalt-ui/tokens'
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
# Uses Slot<>, AsyncState + assertNever, and SeriesKey — one per published surface.
cat >dist-vantage.ts <<'TS'
import type { Slot, AsyncState } from 'basalt-ui'
import { assertNever } from 'basalt-ui'
import type { SeriesKey } from 'basalt-ui/charts'
import type { GuardKind, GuardSeverity, Finding } from 'basalt-ui/guard'

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

// GuardKind, GuardSeverity and Finding are present in the .d.ts
const _gk: GuardKind = 'raw-hex'
const _sev: GuardSeverity = 'error'
const _f: Finding = {
  relPath: 'x',
  line: 1,
  token: '#fff',
  text: 'color: #fff',
  kind: 'raw-hex',
  severity: _sev,
}

export { render, _k, _sk, _gk, _sev, _f }
TS
bunx tsc --project tsconfig.dist-vantage.json
echo "dist-vantage tsc OK"

echo "==> charts/tokens-only (no-Mantine) resolution + render"
SCRATCH2=$(mktemp -d)
cd "$SCRATCH2"
echo '{ "name": "scratch-free", "private": true, "type": "module" }' >package.json
scratch_install "$ABS_TGZ" react react-dom \
  "@visx/axis@4.0.0" "@visx/curve@4.0.0" "@visx/event@4.0.0" "@visx/grid@4.0.0" \
  "@visx/group@4.0.0" "@visx/responsive@4.0.0" "@visx/scale@4.0.0" "@visx/shape@4.0.0" \
  "@visx/threshold@4.0.0"
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

echo "==> agent-chat + root-entry minimal-peer resolution (motion required, remend genuinely optional)"
# `./agent-chat`'s optionalPeers list (surfaces.ts) cannot express that `motion` is a HARD static
# requirement while `remend` is genuinely optional — npm has no per-subpath optionality. The
# scratch-consumer step above installs every optional peer at once, so it can never catch a peer
# that is secretly required; this step is the minimal install that would catch that class of defect
# (a peer silently required, documented as optional). Models the shape of the charts/tokens-only
# step above rather than inventing a new mechanism.
#
# Ground truth (verified against the import graph, not assumed): `thread-feed.tsx` and
# `thread-detail-panel.tsx` import `motion/react` eagerly, and the root entry's `./provider` ->
# `./connectivity` chain imports `@tanstack/react-query` eagerly (ConnectivityProvider, auto-mounted
# by BasaltProvider) — both genuinely required to resolve their entries even though
# `peerDependenciesMeta` marks them optional. `remend` is NOT — `thread-message.tsx` reaches
# `content/markdown.tsx`'s `Markdown`, but markdown.tsx's own `remend` dependency is a lazy
# `import('remend')`, so the static chain stops there. This is F2: `markdown.tsx` used to have a
# STATIC top-level `import remend from 'remend'`, which meant the ROOT entry — which re-exports
# `./agent-chat` (see src/index.ts) — hard-required `remend` too, even though `peerDependenciesMeta`
# marks it optional. `remend` is deliberately NOT installed below (motion and @tanstack/react-query
# ARE, since both are genuinely required) so this step also proves F2 from outside the package
# boundary: the built, packed, INSTALLED artifact resolves and evaluates both `./agent-chat` and the
# root entry with `remend` absent — not just "absent from source", which is the strongest claim a
# source-level regression test can make.
SCRATCH4=$(mktemp -d)
cd "$SCRATCH4"
echo '{ "name": "scratch-agent-chat", "private": true, "type": "module" }' >package.json
scratch_install "$ABS_TGZ" react react-dom \
  @mantine/core @mantine/hooks \
  "motion@12.42.0" "@tanstack/react-query@^5.101.0"
if [ -d node_modules/remend ]; then
  echo "FAILED: remend ended up in a scratch install that never requested it — test setup is broken, not a package defect"
  exit 1
fi
cat >agent-chat.mjs <<'JS'
// react/react-dom + @mantine/core + @mantine/hooks + motion is the FULL peer set `./agent-chat`
// genuinely, statically requires (@tanstack/react-query is installed too, for the root-entry import
// below — it is not needed by agent-chat itself) — deliberately NOT installed: remend, ai,
// use-stick-to-bottom, react-markdown, remark-gfm, shiki, @shikijs/langs, @shikijs/themes,
// beautiful-mermaid. Every one of those is reached only via `lazy()`/dynamic `import()`, so the
// subpath must still resolve and its top-level exports must still be functions without them.
try {
  const agentChat = await import('basalt-ui/agent-chat')
  if (typeof agentChat.ThreadWorkspace !== 'function') throw new Error('agent-chat.ThreadWorkspace missing')
  if (typeof agentChat.ThreadTranscript !== 'function') throw new Error('agent-chat.ThreadTranscript missing')
  if (typeof agentChat.ThreadFeed !== 'function') throw new Error('agent-chat.ThreadFeed missing')
  if (typeof agentChat.ThreadDetailPanel !== 'function') throw new Error('agent-chat.ThreadDetailPanel missing')
} catch (err) {
  console.error(err)
  throw new Error(
    'basalt-ui/agent-chat failed to resolve/evaluate with remend NOT installed — an optional peer ' +
      'has regressed to a hard, static import (the F2 defect). This subpath must load for every ' +
      'agent-chat consumer who never installs remend.',
  )
}
console.log('agent-chat minimal-peer resolution OK (motion required, remend not installed)')

// F2 regression proof: the ROOT entry re-exports `./agent-chat` (src/index.ts), so a static `remend`
// import anywhere in that chain doesn't just break agent-chat users — it breaks EVERY consumer of
// `basalt-ui`'s root entry, including ones who never touch agent-chat at all.
try {
  const root = await import('basalt-ui')
  if (typeof root.ThreadWorkspace !== 'function') throw new Error('root entry ThreadWorkspace missing')
} catch (err) {
  console.error(err)
  throw new Error(
    'basalt-ui root entry hard-requires an optional peer: it failed to resolve/evaluate with remend ' +
      'not installed at all. The root entry re-exports ./agent-chat, so this is the F2 defect — a ' +
      'lazy dynamic import() regressed back to a static one — and it means EVERY consumer of the ' +
      'root entry now needs remend installed, not just agent-chat consumers.',
  )
}
console.log('F2 proof: root entry resolved and evaluated with remend NOT installed at all')
JS
node --import "$PKGDIR/scripts/css-noop-register.mjs" agent-chat.mjs

echo "==> tokens-only install is light (no peers at all)"
# The property this whole change exists to prove: a consumer who only wants the token layer
# installs basalt-ui and gets NOTHING else — no visx/d3 chart stack, no fonts, no Mantine. Every
# peer above (including the fourteen moved out of `dependencies` in this change) is optional, so a
# bare `bun add basalt-ui` must not pull any of them in transitively.
SCRATCH3=$(mktemp -d)
cd "$SCRATCH3"
echo '{ "name": "scratch-light", "private": true, "type": "module" }' >package.json
scratch_install "$ABS_TGZ"
if [ -d node_modules/@visx/scale ]; then
  echo "FAILED: @visx/scale present in a tokens-only install — dependency weight regression"
  exit 1
fi
cat >light.mjs <<'JS'
const tokens = await import('basalt-ui/tokens')
if (typeof tokens.buildPaletteCss !== 'function') throw new Error('tokens.buildPaletteCss missing')
if (typeof tokens.buildPaletteCss() !== 'string') throw new Error('buildPaletteCss() did not return a string')
console.log('tokens-only resolution OK, no @visx/scale in tree')
JS
node light.mjs
echo "tokens-only install is light OK"

echo "PACK TEST PASSED"
