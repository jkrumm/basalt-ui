#!/bin/zsh
# Lint cycle 1: build a scratch app outside the repo, init it at profile `app`, copy the seeded
# offenders in and score them. Usage: run.sh <repo checkout> <scratch dir, created fresh>.
# Needs a built package (`bun install && bun run build` in packages/basalt-ui).
set -eu
REPO=${1:?repo checkout}
APP=${2:?scratch dir}
FIX=$REPO/docs/v3/cycles/lint-1/fixtures
PKG=$REPO/packages/basalt-ui
mod() { [ -e $PKG/node_modules/$1 ] && echo $PKG/node_modules/$1 || echo $REPO/node_modules/$1; }

rm -rf $APP
mkdir -p $APP/src/seeds $APP/node_modules/@shadcn $APP/node_modules/.bin
cd $APP
print '{ "name": "lint-cycle-scratch", "private": true, "type": "module",
  "dependencies": { "basalt-ui": "*", "react": "*" },
  "devDependencies": { "oxlint": "*", "@shadcn/lint": "*", "stylelint": "*" } }' > package.json
ln -s $PKG node_modules/basalt-ui
for dep in oxlint stylelint postcss postcss-html react; do ln -s $(mod $dep) node_modules/$dep; done
ln -s $(mod @shadcn/lint) node_modules/@shadcn/lint
ln -s ../oxlint/bin/oxlint node_modules/.bin/oxlint
ln -s ../stylelint/bin/stylelint.mjs node_modules/.bin/stylelint
git init -q .
bun $PKG/bin/basalt-ui.mjs init --profile app --root src --no-install > init.log 2>&1

# The stylesheet entry init's to-do names, so shadcn/no-unknown-classes reads the basalt theme.
print "@import 'basalt-ui/tailwind.css';" > src/index.css
for f in $FIX/*.tsx.txt; do cp $f src/seeds/$(basename $f .txt); done
for f in $FIX/*.css.txt; do cp $f src/seeds/$(basename $f .txt); done
cp $FIX/score.ts.txt score.ts

bun $PKG/bin/basalt-ui.mjs lint > lint.txt 2>&1 || true
bun score.ts lint.txt
