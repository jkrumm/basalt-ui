#!/bin/zsh
# Lint cycle 1, weakened-config probes W0-W14. Run after run.sh on the same scratch dir:
#   weaken.sh <repo checkout> <scratch dir built by run.sh>
# Each case weakens the scratch app one way, then reports doctor's check 1 and 11 lines and
# whether `basalt-ui lint` still reports the dark-fork seeded in src/features/f.tsx.
set -u
REPO=${1:?repo checkout}
APP=${2:?scratch dir}
CLI="bun $REPO/packages/basalt-ui/bin/basalt-ui.mjs"
cd $APP || exit 1
# doctor's seeded check spawns a bare `oxlint` (lint-1.24), so the app's bin goes on PATH the way a package script puts it.
export PATH=$APP/node_modules/.bin:$PATH

rm -rf src/seeds score.ts lint.txt
mkdir -p src/features
print 'export const ok = 1' > src/index.ts
print 'export function F() {\n  return <div className="dark:bg-card">x</div>\n}' > src/features/f.tsx
git add -A > /dev/null && git -c user.email=cycle@example.com -c user.name=cycle commit -qm base

reset() { git checkout -q -- . ; git clean -qfd; }
run() {
  local doc fires
  doc=$($=CLI doctor 2>&1 | rg "^(✖|✓|⚠ SKIPPED) (1 manifest|11 budgets)" | cut -c1-400)
  fires=$($=CLI lint 2>&1 | rg -c "src/features/f.tsx:[0-9]+ basalt/dark-fork")
  print "## $1\ndoctor: $doc\nlint still reports the seeded dark-fork: ${fires:-0}\n"
  reset
}

run "W0 clean"
print '{}' > .oxlintrc.json; run "W1 extends dropped"
print '{ "extends": ["./.oxlintrc.basalt.json"], "rules": { "basalt/dark-fork": "off" } }' > .oxlintrc.json; run "W2 managed id off in rules"
print '{ "extends": ["./.oxlintrc.basalt.json"], "overrides": [{ "files": ["src/features/**"], "rules": { "basalt/dark-fork": "off" } }] }' > .oxlintrc.json; run "W3 managed id off in overrides"
print '{ "extends": ["./.oxlintrc.basalt.json"], "ignorePatterns": ["src/features/**"] }' > .oxlintrc.json; run "W4 ignorePatterns on a subdirectory"
print 'src/features/' > .oxlintignore; run "W5 .oxlintignore on a subdirectory"
print '{}' > src/features/.oxlintrc.json; run "W6 nested .oxlintrc.json with no extends"
print '/* oxlint-disable */\nexport function F() {\n  return <div className="dark:bg-card">x</div>\n}' > src/features/f.tsx; run "W7 blanket file disable, no reason"
print '/* oxlint-disable -- legacy screen */\nexport function F() {\n  return <div className="dark:bg-card">x</div>\n}' > src/features/f.tsx; run "W8 blanket file disable with a reason"
print '/* eslint-disable */\nexport function F() {\n  return <div className="dark:bg-card">x</div>\n}' > src/features/f.tsx; run "W9 eslint-dialect blanket disable"
print '{ "extends": ["./.oxlintrc.basalt.json"], "jsPlugins": [] }' > .oxlintrc.json; run "W10 jsPlugins emptied beside extends"
print '{ "extends": ["./.oxlintrc.basalt.json"], "rules": { "basalt/dark-fork": "warn" } }' > .oxlintrc.json; run "W11 managed id lowered to warn"
print '{ "extends": ["./.oxlintrc.basalt.json"], "overrides": [{ "files": ["src/features/**"], "plugins": ["react"] }] }' > .oxlintrc.json; run "W12 override narrows plugins for a glob"
jq '.roots = {"src/index.ts":"app"}' .basalt/manifest.json > manifest.tmp && mv manifest.tmp .basalt/manifest.json; run "W13 manifest root narrowed to one file"
jq '.roots = {"src":"tokens"}' .basalt/manifest.json > manifest.tmp && mv manifest.tmp .basalt/manifest.json; run "W14 manifest root lowered to tokens"
