#!/usr/bin/env bash
#
# The CLI under Node with no Bun on PATH, from the packed tarball: a scratch app installs it with npm,
# then init, sync, doctor and lint run through the local bin. It then ages the install the way an
# upgrade finds it (the shim and hook entries of an older release, a stale token sheet) and proves
# `sync` heals it and `doctor` is green again. CI runs it in a job with no Bun on PATH.
#
# Usage: bash scripts/node-cli-smoke.sh <basalt-ui-x.y.z.tgz>
set -euo pipefail

TGZ="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
if command -v bun >/dev/null 2>&1; then
  echo "bun is on PATH ($(command -v bun)): this smoke proves the CLI without it" >&2
  exit 1
fi
node -e 'const [a, b] = process.versions.node.split(".").map(Number); if (a < 22 || (a === 22 && b < 18)) { console.error("needs Node 22.18 or newer"); process.exit(1) }'

APP="$(mktemp -d)"
trap 'rm -rf "$APP"' EXIT
cd "$APP"
git init -q
git config user.email smoke@example.com
git config user.name smoke
printf '{ "name": "node-cli-smoke", "private": true, "type": "module" }\n' >package.json
# React is the app's own; init installs the profile's peers on top of it.
npm install --no-audit --no-fund --save-exact "$TGZ" react@19 react-dom@19
mkdir -p src
printf "export const title = 'smoke'\n" >src/index.ts
printf '.page { color: var(--basalt-ink); }\n' >src/styles.css

BIN=./node_modules/.bin/basalt-ui
step() { echo "==> $*"; }

step "basalt-ui --version"
"$BIN" --version
step "init --profile parts"
"$BIN" init --profile parts --root src
step "sync --check after init"
"$BIN" sync --check
step "doctor after init"
"$BIN" doctor
step "lint: a first reasoned waiver passes"
cat >src/brand.ts <<'EOF'
// oxlint-disable-next-line basalt/color-literal -- the brand mark keeps its print hex
export const BRAND_MARK = '#ff0000'
EOF
"$BIN" lint
grep -q '"waivers": 1' .basalt/budget.json

step "age the install: an older shim, older hook entries, a stale token sheet"
printf '// Managed by basalt-ui: `basalt-ui init` rewrites this file.\nprocess.exit(0)\n' >.basalt/hook.mjs
node -e '
  const fs = require("node:fs")
  const path = ".claude/settings.json"
  fs.writeFileSync(path, fs.readFileSync(path, "utf8").replaceAll("Install the dependencies, then run basalt-ui doctor.", "Run bun install, then basalt-ui doctor."))
'
printf '/* tokens:css from an older release */\n' >src/tokens.css
if "$BIN" sync --check; then
  echo "sync --check passed an aged install" >&2
  exit 1
fi
step "sync heals it"
"$BIN" sync
"$BIN" sync --check
grep -q 'basalt-ui sync' .basalt/hook.mjs
if grep -q 'Run bun install' .claude/settings.json; then
  echo "the old hook entries survived sync" >&2
  exit 1
fi
step "doctor and lint on the healed install"
"$BIN" doctor
"$BIN" lint
echo "node CLI smoke OK"
