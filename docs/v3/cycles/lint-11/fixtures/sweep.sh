#!/bin/zsh
# Lint cycle 11 (cycle 10's, from cycle 9's, from cycle 8's, from cycle 7's, from cycle 6's, from cycle 5's, from cycle 4's, from cycle 3's sweep), false-alarm sweep: copy apps/playground/src and examples/react/src into a scratch
# app (built by run.sh) as one root per shipped profile, sync, and lint every root.
#   sweep.sh <repo checkout> <scratch dir built by run.sh>
# Output: <scratch>/sweep.txt, one finding per line, `<root>/<path>:<line> <id>: <message>`.
set -eu
REPO=${1:?repo checkout}
APP=${2:?scratch dir}
CLI="bun $REPO/packages/basalt-ui/bin/basalt-ui.mjs"
cd $APP
rm -rf src/seeds
for p in app parts bridge; do
  rm -rf pg-$p ex-$p
  mkdir -p pg-$p ex-$p
  cp -R $REPO/apps/playground/src/. pg-$p/
  cp -R $REPO/examples/react/src/. ex-$p/
done
jq '.roots = {"src":"app","pg-app":"app","pg-parts":"parts","pg-bridge":"bridge","ex-app":"app","ex-parts":"parts","ex-bridge":"bridge"}' \
  .basalt/manifest.json > manifest.tmp && mv manifest.tmp .basalt/manifest.json
$=CLI sync > /dev/null
$=CLI lint > sweep.txt 2>&1 || true
for r in pg-app pg-parts pg-bridge ex-app ex-parts ex-bridge; do print "$r $(rg -c "^$r/" sweep.txt)"; done
