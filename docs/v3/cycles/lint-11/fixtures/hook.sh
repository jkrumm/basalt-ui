#!/bin/zsh
# Lint cycle 11 (cycle 10's, from cycle 9's, from cycle 8's, from cycle 7's, from cycle 6's, from cycle 5's, from cycle 4's, from cycle 3's), editor-hook probe (lint-2.25): feed `.basalt/hook.mjs` the Claude Code hook input
# for each weakening the weakened-config check reports, and for an offender after an edit.
#   hook.sh <repo checkout> <scratch dir built by run.sh>
# Prints one block per case: the event, the exit code (2 is a deny or a report) and stderr.
set -u
REPO=${1:?repo checkout}
APP=${2:?scratch dir}
cd $APP || exit 1
rm -rf src/seeds score.ts lint.txt
mkdir -p src/features
print 'export const ok = 1' > src/index.ts
print 'export function F() {\n  return <div className="bg-card">x</div>\n}' > src/features/f.tsx
# A stylesheet under the subdirectory, so a .stylelintignore over it names a file (H4).
print '.list {\n  overflow-y: auto;\n}' > src/features/f.module.css
# The shim looks for the local bin the way an installed app has it.
ln -sf ../basalt-ui/bin/basalt-ui.mjs node_modules/.bin/basalt-ui
export CLAUDE_PROJECT_DIR=$APP

probe() {
  local name=$1 event=$2 tool=$3 file=$4 content=$5 out rc
  out=$(jq -nc --arg t "$tool" --arg f "$APP/$file" --arg c "$content" --arg cwd "$APP" \
    '{session_id: ("cycle-5-" + ($f | split("/") | last) + "-" + (now | tostring)), tool_name: $t, tool_input: {file_path: $f, content: $c}, cwd: $cwd}' |
    node .basalt/hook.mjs $event 2>&1 >/dev/null)
  rc=$?
  print "## $name\n$event rc=$rc\n${out[1,400]}\n"
}

probe "H1 managed id off in .oxlintrc.json" pre-edit Write .oxlintrc.json \
  '{ "extends": ["./.oxlintrc.basalt.json"], "rules": { "basalt/dark-fork": "off" } }'
probe "H2 ignorePatterns over a root subdirectory" pre-edit Write .oxlintrc.json \
  '{ "extends": ["./.oxlintrc.basalt.json"], "ignorePatterns": ["src/features/**"] }'
probe "H3 blanket oxlint-disable atop a file" pre-edit Write src/features/f.tsx \
  $'/* oxlint-disable */\nexport function F() {\n  return <div className="dark:bg-card">x</div>\n}'
probe "H4 .stylelintignore over a root subdirectory" pre-edit Write .stylelintignore 'src/features/'
probe "H5 nested .oxlintrc.json without extends" pre-edit Write src/features/.oxlintrc.json '{}'
probe "H6 manifest root lowered to tokens" pre-edit Write .basalt/manifest.json \
  "$(jq -c '.roots = {"src":"tokens"}' .basalt/manifest.json)"
probe "H7 budget ceiling raised by hand" pre-edit Write .basalt/budget.json \
  "$(jq -c '.waivers = 9' .basalt/budget.json)"
probe "H8 a reasoned line waiver (the Next: rung)" pre-edit Write src/features/g.tsx \
  $'export function G() {\n  // oxlint-disable-next-line basalt/dark-fork -- the logo keeps its own dark tone\n  return <span className="dark:bg-inset">x</span>\n}'
# After the edit lands: post-edit and stop read the file on disk.
print 'export function F() {\n  return <div className="dark:bg-card">x</div>\n}' > src/features/f.tsx
probe "H9 an offender after the edit" post-edit Write src/features/f.tsx ''
probe "H10 stop with the offender on disk" stop Write src/features/f.tsx ''
# Cycle 4 (lint-3.14): a generated file under a root may go into ignorePatterns; a hand-written one may not.
probe "H11 ignorePatterns naming one generated client file" pre-edit Write .oxlintrc.json \
  '{ "extends": ["./.oxlintrc.basalt.json"], "ignorePatterns": ["src/generated/api.gen.ts"] }'
probe "H12 ignorePatterns naming a hand-written file" pre-edit Write .oxlintrc.json \
  '{ "extends": ["./.oxlintrc.basalt.json"], "ignorePatterns": ["src/features/f.tsx"] }'
probe "H13 ignorePatterns naming a generated folder by glob" pre-edit Write .oxlintrc.json \
  '{ "extends": ["./.oxlintrc.basalt.json"], "ignorePatterns": ["src/generated/**"] }'
# The same glob once a hand-written file sits beside the generated one.
mkdir -p src/generated
print 'export const api = 1' > src/generated/api.gen.ts
print 'export function H() {\n  return <div className="dark:bg-card">x</div>\n}' > src/generated/helpers.tsx
probe "H14 the generated-folder glob over a hand-written file" pre-edit Write .oxlintrc.json \
  '{ "extends": ["./.oxlintrc.basalt.json"], "ignorePatterns": ["src/generated/**"] }'
# Cycle 8 (lint-7.2): the core rule the preset turns on, switched off by hand.
probe "H15 core no-use-before-define off in .oxlintrc.json" pre-edit Write .oxlintrc.json \
  '{ "extends": ["./.oxlintrc.basalt.json"], "rules": { "no-use-before-define": "off" } }'
probe "H16 a reasoned line waiver of the core rule" pre-edit Write src/features/h.tsx \
  $'export function h() {\n  // oxlint-disable-next-line no-use-before-define -- read on submit, after the binding exists\n  const clear = () => set(0)\n  const set = (n: number) => n\n  return clear\n}'
