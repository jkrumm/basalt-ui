#!/bin/zsh
# Lint cycle 5 (cycle 4's, from cycle 3's), waiver-budget probe (v3-lint-2-waiver-ceiling): a fresh scratch app (built by
# run.sh, seeds removed) takes the `Next:` rung every table rule names, one reasoned line waiver,
# then follows the breach message to raise the ceiling.
#   budget.sh <repo checkout> <scratch dir built by run.sh>
set -u
REPO=${1:?repo checkout}
APP=${2:?scratch dir}
CLI="bun $REPO/packages/basalt-ui/bin/basalt-ui.mjs"
cd $APP || exit 1
export PATH=$APP/node_modules/.bin:$PATH
rm -rf src/seeds score.ts lint.txt
mkdir -p src/features
print 'export const ok = 1' > src/index.ts
print 'export function Logo() {\n  // oxlint-disable-next-line basalt/dark-fork -- the logo keeps its own dark tone\n  return <span className="dark:bg-inset">x</span>\n}' > src/features/logo.tsx
git add -A > /dev/null && git -c user.email=cycle@example.com -c user.name=cycle commit -qm base

print '## 1 lint with one reasoned waiver'
$=CLI lint 2>&1 | rg -v '^\s*$' ; print "rc=$pipestatus[1]"
print '## 2 the raise the breach message names'
$=CLI lint --raise waivers --consumer "lint cycle 5 probe" 2>&1 | rg -v '^\s*$'; print "rc=$pipestatus[1]"
print '## 3 lint again'
$=CLI lint 2>&1 | rg -v '^\s*$'; print "rc=$pipestatus[1]"
print '## 4 budget.json'
cat .basalt/budget.json
print '## 5 doctor check 11'
$=CLI doctor 2>&1 | rg '^(✖|✓|⚠)' | rg '11 ' | cut -c1-300
