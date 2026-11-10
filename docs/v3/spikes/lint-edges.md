# Spike: lint edges (S4 directives, S5 paren form, S6 `scanAllStrings`, S7 wall time, S8 hook timing)

Three of the four gated edges hold and the fourth could not be run by a lead. Block directives parse `-- reason`, the full preset costs about 190 to 200 ms on a 300-line file, and `scanAllStrings` is quiet on the Console but covers two of six bought rules. S8 (Stop-only versus PostToolUse plus Stop) is `not run`: hooks are per session, so the verdict is pending.

Harness: `bun tools/spikes/lint-edges/run.ts` (one JSON object on stdout, exit 0 = the harness ran). Concept: `docs/v3/concepts/guardrails.md` section 13, S4 to S8. Both proof outputs are in `tools/spikes/lint-edges/proof/`.

**The preset forms are synthetic.** No v3 preset exists (gr-4 waits on this spike). The harness generates one JS plugin of 59 regex rules from a data array, one per form of guardrails section 4, 88 generated lines, plus the six `@shadcn/lint` rules. The patterns are stand-ins shaped like the forms; they say what a preset of this size costs, never how well it detects.

## Question

- **S4.** Do oxlint's native directives hold the edges the waiver design leans on? (a) comment-start (I1): a comment that merely mentions the token does not disable; (b) `-- reason` on block directives is parsed (E3 stays per-line only if not); (c) what a directive for a rule configured `off` does; (d) can the suppressed count of a `deepRender` file be recovered by re-linting. Refuted if the reason is not parsed on blocks.
- **S5.** Does `shadcn/no-arbitrary-values` flag `bg-(--vx-x)`? Recorded, never refuted: `tw-off-law` (c) denies the parenthesised spelling either way.
- **S6.** Does `scanAllStrings` cover plain class arrays on a copy of the Console app without noise? Noise is a finding on a string that is not a class. Refuted above 5% of findings (then: keep the own factory visiting arrays).
- **S7.** Does the full preset on one 300-line TSX file lint in 1000 ms or less? Refuted above (then: the hook lints fewer rules, gates stay full).
- **S8.** Does PostToolUse plus Stop leave at least 2 fewer seeded offenders (mean) than Stop alone? Refuted if not (then: ship Stop only, no fingerprint filter).

## Method

Pins: oxlint 1.93.0, `@shadcn/lint` 0.2.5, tailwindcss 4.3.5, in `tools/spikes/lint-edges/package.json`. oxlint 1.93.0 is inside the 3-day install cooldown until 2026-11-12, so a fresh install needs `bun install --minimum-release-age=0`. Every scratch project lives in the OS temp dir and is removed on exit. No Chrome is involved. The harness has no `*.test.*` file.

**S4.** A probe plugin with `no-foo`, `no-bar` and `never` (configured `off`) rules on string literals, and a `waiver-needs-reason` rule that reads comments through `sourceCode.getAllComments()`. A 22-line fixture, one case per line, linted with and without `--report-unused-disable-directives`. The reason test is discriminating: a block region reads `/* oxlint-disable probe/no-foo -- reason naming probe/no-bar */`, so if the reason text were taken as rule ids, `probe/no-bar` would stop firing on the next line. `deepRender`: a file-level block directive with a reason over four `foo` sites; `oxlint --help` is searched for a switch that ignores inline directives, then the directive is overwritten with spaces (offsets and lines kept), the copy re-linted, and the findings counted.

**S5.** Seven class strings in JSX `className`, linted with `no-arbitrary-values`, `no-raw-colors` and `no-unknown-classes` on a closed `@theme` (`--color-*: initial`, `--spacing: 4px`). The bracket spellings are controls.

**S6.** `apps/console/src` of the software-factory checkout, copied to the temp dir (109 TS/TSX files, generated route tree and the vendored `components/ui` zone excluded). Two runs of `no-arbitrary-values` and `no-raw-colors`, with and without `scanAllStrings`; a probe rule reports every string literal with its parent node type so each added finding can be placed. Added findings are the second run minus the first. A string counts as a class when every whitespace token, with variants and `!`/`-` stripped, starts with a Tailwind utility head (the operational definition; a class in a non-class position still counts as a class). `noisePct` = noise findings over all findings of the `scanAllStrings` run; `noisePctOfAdded` over the added ones only. A seeded file adds one line per shape (plain array, `.join` array, object map, template literal, non-class strings, array inside `cn()`). The Console is a private repo: counts and hashed ids only.

**S7.** One fixed 300-line TSX file (25 components, six kinds of offender). `oxlint -f json` on that file, spawn to exit, 1 warm-up discarded and 11 timed runs, median. Four stacked configs split the cost: native plugins only (`bare`), plus the 59 rules (`basalt`), plus the six bought rules (`shadcn`), both (`full`). `full` is `s7.wallMs`. Native `react`, `typescript` and `jsx-a11y` plugins with the `correctness` category are on in all four, as in the repo's own config.

**S8.** Not run. `s8.ts` is the apparatus: it seeds ten files (one offender each, ten different forms, the rest of every file clean), writes the brief (rename the `label` prop to `title` in all ten files, change nothing else), writes `.claude/settings.json` for each arm, and carries the hook stub (PostToolUse lints the edited file, Stop lints `src/` once and returns 0 when `stop_hook_active`; both exit 2 with the findings on stderr) and the scorer (seeded offenders still firing, of 10). `run.ts` runs its self-check.

## Measurements

**S4.** All edges hold.

| Edge                                                                | Result                               |
| ------------------------------------------------------------------- | ------------------------------------ |
| `/* oxlint-disable-next-line x -- reason */` suppresses             | yes                                  |
| `/* oxlint-disable x -- reason */` region suppresses, `enable` ends | yes                                  |
| Reason text naming another rule disables that rule                  | no (`probe/no-bar` still fires)      |
| `// see oxlint-disable-next-line x` (line comment mention) disables | no                                   |
| `/* note: oxlint-disable-next-line x */` (block mention) disables   | no                                   |
| Directive for a rule configured `off`                               | reported unused                      |
| Directive for an unknown id                                         | reported unused                      |
| Directive with nothing to waive                                     | reported unused                      |
| Unused reports without `--report-unused-disable-directives`         | none (the flag is required)          |
| A plugin rule reading `sourceCode.getAllComments()` finds no-reason | yes, exactly the one directive       |
| 1.93.0 has a switch to ignore inline directives                     | no                                   |
| `deepRender` re-lint: findings with the directive / after blanking  | 0 / 4 of 4 expected, other rule kept |

**S5.** Not flagged. `bg-(--vx-x)`, `text-(--vx-x)` and `w-(--vx-w)` produce no finding from any of the three rules; `bg-[var(--vx-x)]`, `bg-[#fff]` and `p-[13px]` are flagged by `no-arbitrary-values`; `bg-background p-4` is clean. This is the source-read lean of guardrails section 13.

**S6.** Console copy, 109 files.

| Quantity                                                               | Value                                 |
| ---------------------------------------------------------------------- | ------------------------------------- |
| Findings without / with `scanAllStrings`                               | 111 / 122                             |
| Added (all `no-arbitrary-values`)                                      | 11                                    |
| `s6.arrayFindings` (added, in an array literal)                        | 0                                     |
| Added in object property values (class maps), `s6.classShapedByParent` | 10 (`Property`), all class-shaped     |
| Noise (`s6.noisePct` of all findings / of added)                       | 1 = 0.8% / 9.1% (a UUID regex string) |

Seeded shapes (findings off / on): plain array 0 / 2, `.join` array 0 / 1, object map 0 / 1, template literal 0 / 0, array inside `cn()` 1 / 1, four non-class strings 0 / 1 (`row-[1]`, arbitrary-value shaped by accident; the path, `user-profile` and `en-US` were not flagged). `scanAllStrings` is accepted by `no-arbitrary-values` and `no-raw-colors` only: `no-unknown-classes` and `require-static-classes` reject the option at config time.

**S7.** Medians of 11 runs, two harness runs (spawn to exit, ms).

| Config                       | Run 1 | Run 2 | Findings |
| ---------------------------- | ----- | ----- | -------- |
| `bare` (native plugins only) | 77.5  | 77.7  | 0        |
| `basalt` (+59 regex rules)   | 121.2 | 122.9 | 5        |
| `shadcn` (+6 bought rules)   | 191.6 | 189.3 | 103      |
| `full` = `s7.wallMs`         | 190.5 | 198.2 | 108      |

The JS plugin host plus the 59 rules add about 44 ms; the bought rules add about 70 ms, mostly the Tailwind theme build, which a hook pays on every process. The min-to-max spread inside a level is under 20 ms in both recorded runs. An earlier, unrecorded run had one 262 ms outlier in `shadcn`; the median absorbs it.

**S8.** `stopOnlyFindingsKept` and `postPlusStopFindingsKept` are null. Self-check of the apparatus: all 10 seeds fire, the PostToolUse stub exits 2 on a dirty file and 0 on the fixed one, the Stop stub exits 2 and then 0 when `stop_hook_active`, and one fix drops the score to 9.

## Verdict

S4: PASS
S5: recorded (not flagged)
S6: PASS
S7: PASS
S8: not run

Verdict: PENDING (not run: S8)

S4 by the rule: the reason is parsed on blocks, so E3 stays. S6 by the rule: 0.8% noise against 5%. Two limits on S6: it ran on one repo, and the rules that accept the option only flag arbitrary-value or palette shapes, so low noise is partly structural; `no-unknown-classes` would be the noisy one and cannot take it. S7 by the rule: 198 ms (run 2; 191 ms in run 1) against 1000 ms, on synthetic regex rules; real class-family rules walk more AST per string and will cost more. S8 cannot be run by a lead (hooks are per session; no headless `claude -p`).

## Then

- **S4.** E3 stands as written: file-level directive with a reason on the three named rules. `waiver-needs-reason` is buildable as a plain plugin rule over `getAllComments()`. `basalt-ui lint` must pass `--report-unused-disable-directives`, because dead, unknown-id and off-rule directives are only reported with it. `lint --stats` takes a `deepRender` file's suppressed count by blanking the directive and re-linting; there is no switch for it in 1.93.0.
- **S5.** `tw-off-law` (c) is the only owner of the parenthesised colour spelling, and `check-tokens` the only owner of an unknown `--vx-*` name. No further action.
- **S6.** `scanAllStrings` covers plain and `.join` arrays and object maps for `no-arbitrary-values` and `no-raw-colors`, quietly. It does not cover template literals (the seeded one found nothing) and cannot be set on `no-unknown-classes`. Keep the own factory for those shapes and for dead classes.
- **S7.** The hook can run the full preset. Budget the real rules against 1000 ms when they exist (gr-4); the bought rules are the larger share.
- **S8.** Run it where hooks can be varied. A session that can start two interactive Claude Code sessions with different settings runs, for each arm in `stop-only`, `post-plus-stop` and each repeat in 1 to 3: `bun tools/spikes/lint-edges/s8.ts prepare /tmp/lint-edges-s8/<arm>-<rep> <arm>`, start the session in that directory as the `implementer` role (`claude --agent implementer`), give it `BRIEF.md`, let it stop, then `bun tools/spikes/lint-edges/s8.ts score /tmp/lint-edges-s8/<arm>-<rep>` (kept of 10). Mean per arm; refuted when `post-plus-stop` does not keep at least 2 fewer. Until then guardrails section 8 stands: no fingerprint filtering is built.

## Affects

- `docs/v3/concepts/guardrails.md`: section 8 (the U on a directive for a rule configured `off`: reported unused), section 9 (the U on the suppressed-count re-lint: works by blanking), section 13 S4 to S8 rows, E3 (kept). Frozen here; the concept owner changes them.
- `gr-4` (preset generator): passes `--report-unused-disable-directives`, builds `waiver-needs-reason` over comments, keeps the factory for arrays and templates, and measures the real preset against the roughly 200 ms the synthetic one cost.
- DPO 15 (hook shape): not decided by this spike; S8 is the open evidence.
