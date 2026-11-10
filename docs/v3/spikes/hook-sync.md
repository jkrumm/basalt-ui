# Spike: hook delivery, render-then-compare sync, shadcn co-install (S2, S5, S6)

S5 and S6 hold; S2 stays pending one interactive session. The hook side is proven: exit 2 carries the text, the shim works from a subdirectory cwd and with the bin missing, and no Stop guard loops. The spike also found three things the concept does not say: a plain hook entry fails open in three modes, oxfmt 0.72 does not read `.oxfmtignore`, and 8 of the 16 shipped files are not oxfmt-clean at default settings. Changes are under Then.

Harness: `bun tools/spikes/hook-sync/run.ts` (one JSON object on stdout, exit 0 = the harness ran). Concept: `docs/v3/concepts/skills-agent-layer.md` section 8, S2, S5, S6. The brief cites decisions 5, 6 and 13; the co-install text sits in decision 11 (13 is the skill kill criterion).

## Question

- **S2.** Does a PostToolUse exit 2 reach the model? Does the shim work from a subdirectory cwd and with the bin missing? Does Stop terminate: `stop_hook_active` in the event, or a per-session counter bounding it to one block? How big is the terse output? Refuted if Stop loops with the counter in place (drop Stop, keep PostToolUse). Pending while the model-acts check needs an owner run.
- **S5.** Does render-then-compare `sync` give zero false drift on a one-root repo, a workspace with one root, a workspace with several, a derived-roots workspace, a desktop app with one root, and root `.`; under oxfmt and bun's isolated linker; across a `settings.json` merge? Is a roots change detected? Refuted on any false drift (then lean on the E1 digest).
- **S6.** Do the shadcn skill and the basalt skills give contradicting instructions, and can one precedence rule order every one?

## Method

**Sources.** `/research` on 2026-11-10 (`agw research`, run `01a1c564`). The hooks reference page itself returned no content to the fetch tool, so the hook semantics rest on search snippets of it, two pages quoting it verbatim and four Claude Code issues (#81458, #85547, #99012, #105799); confidence is medium and each claim below says which. The shadcn skill is `shadcn-ui/ui` `skills/shadcn/SKILL.md` at commit `4233ed1c` (the last commit touching it before `shadcn@4.23.0`, 2026-10-14); the skill has no version field, the CLI it drives is 4.23.0.

**S2.** The stub shim (`hook.mjs`, 57 lines as the repo formatter leaves it, 43 before it wrapped them at width 100) and a stub `basalt-ui` bin run through `/bin/sh` with event JSON on stdin and `CLAUDE_PROJECT_DIR` set, in scratch projects whose path contains a space and whose bin sits beside the dependent package (the isolated-linker layout). The harness supplies the cwd; it does not observe what a real session does with it. Stop is simulated as Claude Code documents it: exit 2 re-fires Stop with `stop_hook_active: true`, and the turn ends after 8 consecutive blocks. The offender never gets fixed, the worst case.

**S5.** A stub renderer fills the `paths:` list of each managed rule from the roots and leaves every other byte alone; it equals the 2.x `renderRulePaths` on three root sets. The managed set is the 16 shipped 2.x files (6 rules, 10 skill files). Compare = render in memory, read the file, classify by the E1 digest: current, missing, stale (digest unchanged, render moved) or edited. Per shape: first sync, check, a second sync (tree digest identical), check from the deepest directory, then a run of oxfmt 0.72 over the tree. Roots change: add, remove or replace, edited file plus change, reorder. The isolated linker is real: `bun install` with `linker = "isolated"` over a `file:` tarball of a stub package. The `settings.json` merge runs on synthetic fixtures (a desktop app's live-library guard, a legacy marker-less entry, compact arrays, a trailing comma, a comment).

**S6.** A static scan. 16 topics, each a pair of instructions found by pattern in the real texts (a pattern matching nothing is reported as `unmatched`). The basalt side is the 2.x skills and rules, which are the stand-ins; the v3 skills do not exist yet.

## Measurements

### S2

| Check                                                                                            | Measured                                                            |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| PostToolUse offender, project-root cwd                                                           | exit 2, 162 chars on stderr, stdout empty                           |
| Same from `packages/app`, absolute and relative `file_path`; clean file                          | exit 2 and exit 2; exit 0                                           |
| Bin missing                                                                                      | exit 2, the line names `bun install`                                |
| Crash in the bin, unknown event, bad stdin, manifest missing                                     | exit 2 each, each with a `basalt hook:` fix line                    |
| Plain entry: shim file gone, `node` gone, `CLAUDE_PROJECT_DIR` unset, unquoted path with a space | exit 1, 127, 1, 1: all non-blocking per the docs, so they fail open |
| Wrapped entry, same three first modes                                                            | exit 2 each; a real finding adds no extra line                      |

The wrapped entry is `node "$CLAUDE_PROJECT_DIR/.basalt/hook.mjs" <event>; s=$?; case $s in 0|2) exit $s;; esac; echo 'basalt hook: the shim did not run (exit '$s'). Run bun install, then basalt-ui doctor.' >&2; exit 2`.

Stop, four turns with a persistent offender:

| Guard                    | Blocks per turn | Max consecutive                     |
| ------------------------ | --------------- | ----------------------------------- |
| none                     | 8, 8, 8, 8      | 8 (the platform cap ends each turn) |
| `stop_hook_active` only  | 1, 1, 1, 1      | 1                                   |
| per-session counter only | 1, 0, 0, 0      | 1                                   |
| both                     | 1, 0, 0, 0      | 1                                   |

The counter bounds Stop to one block per session, and so also silences every later turn of that session. Without a `session_id` all sessions share one key and the second session is silenced too; a new `session_id` blocks once again. Per the docs `stop_hook_active` is in the Stop event and is true while Claude continues because of a stop hook; a real session has not shown it (owner run).

Output size: 1 finding is 163 chars, 10 are 1,631, 50 and 500 are 1,665 and 1,666 (the shim keeps 10 lines and 2,000 chars and adds `…and N more`). The docs cap hook text at 10,000 chars per string, with a 2,000-char preview and a file path beyond; the sources do not say whether the cap applies to exit-2 stderr.

Model acts: **needs owner run.** Repro, exact commands and pass criteria are in the `ownerRun` object of the JSON; the fixture comes from `bun tools/spikes/hook-sync/run.ts --owner-fixture ~/basalt-hook-fixture`, then `cd` there, `git init -q`, `claude` (interactive), two prompts, `cat .basalt/hook.log`.

### S5

| Shape                    | False drift | Roots add / replace | Edited plus change |
| ------------------------ | ----------- | ------------------- | ------------------ |
| single root `src`        | 0           | 6 of 6 stale        | edit kept, 5 stale |
| root `.`                 | 0           | 6 of 6 stale        | edit kept, 5 stale |
| workspace, one root      | 0           | 6 of 6 stale        | edit kept, 5 stale |
| workspace, three roots   | 0           | 6 of 6 stale        | edit kept, 5 stale |
| workspace, roots derived | 0           | 6 of 6 stale        | edit kept, 5 stale |
| desktop app, one root    | 0           | 6 of 6 stale        | edit kept, 5 stale |

Six of the 16 files carry `paths:`; a roots change flips exactly those, nothing else, and `--force` finishes the edited one. The digest separates stale from edited in every case. Reordering the same roots makes all 6 stale for a plain renderer and none for one that sorts.

The consumer's formatter, false-drift files per shape (identical in all six):

| Formatter state                                                       | Files                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `ignorePatterns` for `.claude/**` and `.basalt/**` in `.oxfmtrc.json` | 0                                                          |
| `.prettierignore` naming them                                         | 0                                                          |
| `.oxfmtignore` naming them (not read without `--ignore-path`)         | 8                                                          |
| No ignore, default settings                                           | 8 (all 6 rules, `basalt-app` and `basalt-charts` SKILL.md) |
| No ignore, the repo's own settings (width 100, single quotes)         | 0                                                          |

The E1 digest cannot tell a formatter from a person: a rewritten file reads as edited. It does not rescue the unignored case; the ignore does.

Isolated linker: the package resolves from `apps/dashboard` through `node_modules/.bun/…`, not from the root; the bin exists beside the app and not at the root; rendering from the resolved store path gives a `.claude` tree identical to rendering from source.

`settings.json` merge, six cases: foreign entries and keys survive, a second merge is a no-op, a foreign entry appended after the basalt one does not move it, `sync --check` ignores a foreign edit and sees a removed basalt entry. Re-serialising rewrote 2 lines of the compact-array fixture. A trailing comma and a comment are left untouched.

### S6

16 pairs, none unmatched. Quotes are cut at 19 words.

| Surface       | Basalt (2.x stand-in)                                                 | shadcn skill                                                     | Tier          |
| ------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------- |
| tokens        | "the palette is derived, never authored."                             | "Map its tokens onto the shadcn variables in `tailwindCssFile`." | prose / prose |
| DESIGN.md     | "the law is `.claude/rules/basalt-*.md` and `./DESIGN.md`."           | "When the user asks for a design system from a `DESIGN.md`"      | prose / prose |
| theme         | "the theme owns them (`VX.shadowCard`, `VX.radiusCard`)."             | "Restyle components by editing their `cva` variants."            | guard / prose |
| presets       | "Fonts change only through `createBasaltTheme(_, { fonts })`;"        | "`apply <code> --only theme,font`"                               | guard / prose |
| shell         | "never build `AppShell.*` parts or a `Burger`"                        | "Dashboard = Sidebar + Card + Chart + Table."                    | guard / prose |
| charts        | "`@visx/*` is banned."                                                | "`Chart` (wraps Recharts)"                                       | guard / prose |
| forms         | "A field is two calls: `key={fieldKey(form, path)}`"                  | "Forms use `FieldGroup` + `Field`."                              | guard / prose |
| tables        | "Tables are `BasaltDataTable` with columns from `createColumnHelper`" | "Data display: `Table`, `Card`, `Badge`, `Avatar`"               | guard / prose |
| overlays      | "A form dialog is a `defineOverlays` entry"                           | "Dialog, Sheet, and Drawer always need a Title."                 | guard / prose |
| notifications | "Register every kind in `defineNotifications`"                        | "Toast follows the project base."                                | guard / prose |
| card headers  | "A section, card or table title is a `WidgetHeader`;"                 | "Use full Card composition."                                     | guard / prose |
| registry      | "A gap is reported, not routed around;"                               | "`search` to check registries before writing custom UI."         | prose / prose |
| finish check  | "Done only when both passes are clean"                                | "Verify in a browser: typecheck, no console errors"              | prose / prose |
| layout        | "Lay out with `Box`/`Flex`/`Grid`/`Stack`/`Group`"                    | "No `space-x-*` or `space-y-*`."                                 | guard / prose |
| colors        | "Write no `#hex`, `rgb()` or `hsl()`;"                                | "Use semantic colors."                                           | guard / prose |
| inputs        | "Inputs come from `@mantine/core`, never `<input>`"                   | "Form inputs: `Input`, `Select`, `Combobox`"                     | guard / prose |

Layout, colors and inputs are vocabulary clashes that exist because the stand-in is Mantine; the other 13 are about who owns a surface or a step. Beyond the pairs: shadcn's `SKILL.md` runs `npx shadcn@latest info --json` each time it loads and triggers on any project with a `components.json`, so on every v3 consumer it loads beside `basalt-design`. It weighs 21.5 KB (107 KB with its rule files) against 82 KB for the whole 2.x basalt set. It installs to `.claude/skills/shadcn` (derived from the skills CLI agent table, not run here), outside the managed `basalt-*` namespace, so `sync` never prunes it.

The ordering is applied, not discovered: the harness finds both lines in the real texts and checks that the paragraph below names every surface, but `winner` is `basalt` by construction. What the scan shows is that no pair needed a second rule. The four `prose / prose` rows (tokens, DESIGN.md, registry, finish check) have no guard on the basalt side and rest on the same-install tie-break, the weakest step; a basalt guard behind each would make them stronger.

Precedence text, checked by the harness to name every surface above:

When the shadcn skill and the basalt skills are both installed, the narrowest guarded owner wins. A surface basalt names (tokens, colors and the theme including presets and `apply`, DESIGN.md, layout, the shell, charts, forms and inputs, tables, overlays, notifications, card headers, and the finish check) is basalt's, and the shadcn text for it is background to read, never an order. Where both sides carry a guard (a lint id, a type or a hook) the generated basalt preset arbitrates; where neither does, basalt's skill wins because it ships in the same install and the shadcn skill is third-party. Everything basalt names nothing for (primitives, variants, icons, base versus radix, the shadcn CLI mechanics) stays shadcn's, and what it adds or edits must then pass the basalt gate. A gap in basalt's composites is reported, never filled from a registry.

## Verdict

S2: pending
S5: PASS
S6: PASS

Verdict: PENDING

S2: the hook side passes every check and no guard loops (counter: 1 block per session, max 1 consecutive), so it is not refuted; it stays pending because whether the model acts on the exit-2 text needs an interactive session. S5: zero false drift on all six shapes with the formatter ignoring the managed paths, every roots change detected, the isolated linker and the merge clean. S6: all 16 pairs ordered by one rule, no unmatched topic, every surface named in the precedence text.

## Then

- **Hook entry (4.2, decision 5).** Register the wrapped command above, not the bare `node … <event>`: the bare form fails open when the shim file, `node` or `CLAUDE_PROJECT_DIR` is missing. Add a doctor fixture for each.
- **Stop guard (issue 4).** Use `stop_hook_active` as the per-turn bound and keep the session counter as a ceiling, not the bound: the counter alone gives one re-check per session. If the owner run shows the field absent, fall back to the counter. Key the counter on `session_id`; when it is missing, do not block.
- **Shim budget.** The stub is 57 formatted lines (43 unwrapped) against the ≤40 in 4.2. About 8 of the 57 are spike-only (the `HOOK_SPIKE_LOG` line, the `HOOK_SPIKE_STOP_POLICY` switch and its three uses), so the shipped shim lands near 50 formatted. Either restate the budget as ≤50 formatted lines or move the output cap into `lint --hook`.
- **Formatter ignore (doctor check 9).** `.oxfmtignore` is not read by oxfmt 0.72 without `--ignore-path`; the check must run `oxfmt --list-different` on a managed path, not look for a file. `init` writes `ignorePatterns` for `.claude/**` and `.basalt/**` into `.oxfmtrc.json` (or `.prettierignore`). Alternatively ship the templates oxfmt-clean at default settings; 8 of 16 are not today.
- **Renderer.** Sort the roots when rendering; otherwise a reordered `basalt.roots` is 6 files of stale.
- **Package resolution.** `sync` resolves the shipped sources from the manifest's package directory, as the bin is resolved; from the root it finds nothing under the isolated linker.
- **`settings.json` merge.** Replace basalt entries in place and keep foreign entries; re-serialising costs lines on a hand-formatted file, so splice text if that churn matters. Leave unparseable files untouched.
- **Precedence (decision 11).** Put the paragraph in the managed `basalt-design` skill preamble. Its surface list names 2.x composites; regenerate it from the v3 rules, where the basalt surfaces are shadcn-based. The rule (narrowest guarded owner) stays.
- **Owner run.** Run the S2 repro in `ownerRun`; if the model ignores the text or Stop re-engages more than twice in a turn, S2 is refuted and Stop goes.

## Affects

- `skills-agent-layer.md` decisions 5, 6 and 11, section 4.2 (hook entries JSON, `hook.mjs` budget, merge rule), section 4.3 checks 8 and 9, section 8 rows S2, S5, S6.
- `guardrails.md` section 15, E1: the digest is sufficient for stale versus edited; it needs the formatter ignore to avoid false edited.
- Issue 4 (hook shim, `lint --hook`, `settings.json` merge) and the `init`/`sync` issue (renderer, package resolution, ignore).
- S7 (activation outside trial conditions): shadcn's skill is a second skill in the same session; run S7 with it installed.
