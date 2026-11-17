#!/bin/zsh
# Lint cycle 8 (cycle 7's, from cycle 6's, from cycle 5's, from cycle 4's, from cycle 3's), eject probe (v3-lint-2-eject-clean): a fresh scratch app (built by run.sh, seeds
# removed) ejects every shipped primitive unedited, then `basalt-ui lint` runs over it.
#   eject.sh <repo checkout> <scratch dir built by run.sh>
# Output: <scratch>/eject.txt (the eject log) and <scratch>/eject-lint.txt (the lint output).
set -u
REPO=${1:?repo checkout}
APP=${2:?scratch dir}
CLI="bun $REPO/packages/basalt-ui/bin/basalt-ui.mjs"
cd $APP || exit 1
export PATH=$APP/node_modules/.bin:$PATH
rm -rf src/seeds score.ts lint.txt
print 'export const ok = 1' > src/index.ts
# eject needs basalt() from basalt-ui/vite in the app's vite.config to alias the file.
print "import { defineConfig } from 'vite'\nimport { basalt } from 'basalt-ui/vite'\nexport default defineConfig({ plugins: [basalt()] })" > vite.config.ts
print '{ "compilerOptions": { "jsx": "react-jsx", "strict": true } }' > tsconfig.json
git add -A > /dev/null && git -c user.email=cycle@example.com -c user.name=cycle commit -qm base
$=CLI eject --all --reason "cycle probe" --raise "lint cycle 8 probe" > eject.txt 2>&1
print "eject rc=$?" >> eject.txt
$=CLI lint > eject-lint.txt 2>&1
print "lint rc=$?" >> eject-lint.txt
print "ejected files: $(ls src/components/ui/*.tsx 2>/dev/null | wc -l | tr -d ' ')"
print "findings: $(rg -c '^src/' eject-lint.txt || print 0)"
