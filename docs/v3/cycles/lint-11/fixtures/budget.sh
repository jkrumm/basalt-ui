#!/bin/zsh
# Lint cycle 11 (cycle 10's, from cycle 9's, from cycle 8's, from cycle 7's, from cycle 6's, from cycle 5's, from cycle 4's, from cycle 3's), waiver-budget probe (v3-lint-2-waiver-ceiling): a fresh scratch app (built by
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
$=CLI lint --raise waivers --consumer "lint cycle 11 probe" 2>&1 | rg -v '^\s*$'; print "rc=$pipestatus[1]"
print '## 3 lint again'
$=CLI lint 2>&1 | rg -v '^\s*$'; print "rc=$pipestatus[1]"
print '## 4 budget.json'
cat .basalt/budget.json
print '## 5 doctor check 11'
$=CLI doctor 2>&1 | rg '^(✖|✓|⚠)' | rg '11 ' | cut -c1-300
# Cycle 8 (lint-7.2): a reasoned waiver of the core rule the preset turns on counts against the ceiling.
git checkout -q -- . ; git clean -qfd
rm src/features/logo.tsx
print 'export function draft() {\n  // oxlint-disable-next-line no-use-before-define -- read on submit, after the binding exists\n  const clear = () => setValue(0)\n  const setValue = (n: number) => n\n  return clear\n}' > src/features/core.tsx
print '## 6 lint with one reasoned waiver of the core rule at the base ceiling'
$=CLI lint 2>&1 | rg -v '^\s*$'; print "rc=$pipestatus[1]"
print '## 7 lint --stats'
$=CLI lint --stats 2>&1 | rg -i 'waiver'
