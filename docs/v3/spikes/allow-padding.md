# Spike: utility allowlist (F5), padding form (F5P), own-form false positives (S2)

F5 and S2 are refuted, F5P passes on the rubric as filed. F5 fails on 34.0% genuine need, nearly all of it sites whose value has no px (`w-[100%]`, `max-w-[75ch]`, dynamic Mantine props), which the rubric counts as need. S2 fails on three forms, each because the matcher looks wider than a class context. F5P passes only because the value rubric cannot see the structure that sank padding on argo, so it is no evidence for flipping E4.

Harness: `bun tools/spikes/allow-padding/run.ts` (one JSON object on stdout, exit 0 when the harness ran). Both runs are in `tools/spikes/allow-padding/out/` and are identical. The epos location is not tracked: set `EPOS_ROOT` (and `EPOS_SCAN_DIR`, default `src`) to include it; without them epos is skipped and the numbers below do not reproduce. Concept: `docs/v3/concepts/guardrails.md` sections 4, 13 (F5P, S2) and 15 (E4); `docs/v3/ARCHITECTURE.md` section 11 F5.

## Question

- **F5.** Does the closed type, weight and spacing allowlist (`tokens-visual.md` section 3) force waivers in app code? Refuted above 15% genuine need among sampled denied sites, or above 1 waiver per 300 TSX lines. Otherwise zone A could move from denylist plus `app-spacing` to an allowlist.
- **F5P.** The same for the padding form that E4 holds off.
- **S2.** What share of each own lint form's hits are false positives? Refuted when any form is above 10%; that form narrows or goes, and a form with no hit goes first.

## Method

**Repos.** Read-only scratch copies in the OS temp dir (deleted after the run) of the tracked `.ts`/`.tsx` files under the app source of four consumers: console (`software-factory/apps/console`, Tailwind), epos (the teamchat UI, Tailwind), linewatch (`web`, Mantine) and argo (`apps/dashboard`, Mantine). Tests, `.d.ts`, generated files and `components/ui/` (zone V or E) are out. Visibility from `gh repo view --json isPrivate`: console, linewatch and argo public (file and line listed), epos counts only. Nothing from epos but counts is printed anywhere.

**Allowlist.** Type `text-{micro,xs,sm,md,base,lg,display}` (11, 12, 13, 15, 16, 18, 30 px), any `/modifier` on a size denied. Weight `font-normal`, `font-medium`, `font-semibold` (400, 500, 600: the concept names the three weights, not their values). Spacing: `--spacing` 4 px, integers plus 0.5 steps below 4, token classes `h-ctl size-ctl min-h-row size-icon`. Keywords, fractions and container names (`w-full`, `max-w-prose`) are outside the namespace and not counted. Arbitrary values, off-ladder numbers and `px` are denied.

**Mantine.** The codemod is not built. `mapping.ts` (80 lines) reproduces its emit from Mantine layout props (`fz="xl" lh={1.55}` becomes `text-xl/[1.55]`, `p={18}` becomes `p-4.5`). It is applied to all candidate sites, not only the sample, because a site is denied or not only after the emit. The sample is then drawn from the denied ones.

**Rubric, fixed in code before sampling.** A denied site is `genuine need` iff its px value equals no allowed value and the nearest allowed step is more than one rung away; otherwise `no need`; a value with no px (`unclear`) counts as need. Inside a ladder a value is at most half a rung from a step, so need arises only beyond the end of a bounded ladder (type under 11 or over 30, weight under 400 or over 600) or from `unclear`.

**Sample.** The pool is every denied site across the four repos, sorted, shuffled with mulberry32 seeded 42, first 100. F5P's pool is every padding class or `p*` prop. `waiversPer300Lines` = genuine-need share of the pool x pool size x 300 / pooled TSX lines (79,314).

**S2.** 54 matchers in `forms.ts` over every scanned file, against the 59 forms the concept books. Not measurable standalone: the engine outside the 19-subpath list, `control-home`, the `ui/table` sort/slice rows, the chart root of `DataPanel`, the deprecated Query set. The class forms see the lint's reach (class contexts plus class-shaped arrays, `.join(' ')` and any template literal); a hit is a false positive when its string is not in a strict class context (`className`, `cn`, `cva`, `clsx`, `twMerge`, one hop through a same-file const). A few forms add a stated predicate (see `s2.forms[id].oracle`): `matchMedia` queries without `width`, hex-like strings used as ids or anchors, `text-sm/6` as an opacity, type-only imports, hidden or file inputs, storage adapters. Every other form is `syntactic`: false positives are 0 by definition there, so a low number says the matcher is precise, not that the fix is satisfiable.

## Measurements

Scanned: 1,010 files, 548 TSX files, 79,314 TSX lines (console 7,903; epos 37,990; linewatch 6,446; argo 26,975).

| Probe | Denied sites | Sampled | Genuine need | Need % | Waivers per 300 lines | Off-step % |
| ----- | ------------ | ------- | ------------ | ------ | --------------------- | ---------- |
| F5    | 323          | 100     | 34           | 34.0   | 0.42                  | 89         |
| F5P   | 1,437        | 100     | 1            | 1.0    | 0.05                  | 1          |

**F5 by reason (sample of 100).** `equals-allowed` 11, `within-rung` 49, `beyond-end` 8 (2 need), `unclear` 32. So 32 of the 34 needs are `unclear`; without them the rate is 2%. In the listed (non-epos) sites, 24 of 24 needs are unclear: 13 are percent, `ch`, `vh` or `fit-content` lengths (`max-w-[75ch]`, `w-[100%]`, `min-h-[60vh]`), 11 are Mantine props with a dynamic value (`gap-[dynamic]`, `w-[dynamic]`). Epos supplies the other 10 needs of 61 sampled sites, counts only. By repo, sampled and need: console 11 and 5, epos 61 and 10, linewatch 3 and 2, argo 25 and 17.

**F5P.** 99 of 100 sampled padding sites are `equals-allowed` (`p-4`, `px-6`: the value is a ladder step, which the rubric reads as expressible). The one need is `pb-[env(safe-area-inset-bottom)]`. By repo the pool is console 159, epos 1,237, linewatch 15, argo 26; the sample drew 0 from linewatch and argo.

**S2.** 54 forms measured: 36 with hits, 18 with none, 3 above 10%.

| Form                   | Hits | False positives | %    | Why                                                                                                                                                 |
| ---------------------- | ---- | --------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tw-off-law/template`  | 75   | 74              | 98.7 | Any template quasi ending in `-` before `${`: ids, keys, map layer names (argo 34, console 24, epos 12, linewatch 4). One hit is in a class context |
| `viewport-keyed/js`    | 28   | 20              | 71.4 | `matchMedia('(prefers-color-scheme: dark)')`, reduced motion, pointer queries; console 4 of 7, epos 16 of 21                                        |
| `tw-off-law/important` | 38   | 11              | 28.9 | Trailing `!` on a word in prose templates and arrays; all 11 in epos. The 27 class-context hits are all true                                        |

Other forms with hits are at or under 0.7%: `app-spacing/margin` 1,070 hits, 2 false positives (0.2%); `primitive-bypass/raw-control` 134, 1 (0.7%). Forms with no hit in these four repos, in `s2.noHitForms`: `data-primitive/chart-fallback`, `fixed-colour/black-white`, `import-boundary/{radix,sonner,streamdown,use-chat,use-react-table,visx}`, `primitive-bypass/role-table`, `router-search/{validate-search,view-transition}`, `status-fill-as-text/text-on-fill`, `tw-off-law/alpha-on-text`, `untrusted-markdown/{inner-html,mdx-evaluate,rehype-raw,trusted}`, `waiver-needs-reason/file-level`.

Limits. The F5 verdict rests on a rubric that makes any unit-less-px value need. The S2 oracle is syntactic: it measures whether the matcher fired on the construct it names, not whether the fix is satisfiable. Epos is 60% of the F5 pool (195 of 323 sites) and 86% of the F5P pool (1,237 of 1,437); its sites are not inspectable from this doc.

## Verdict

F5: REFUTED
F5P: PASS
S2: REFUTED

Verdict: REFUTED

F5 by the rule: 34.0% genuine need against 15%. The waiver rate (0.42 per 300 lines) is under the bar of 1, so only the need share refutes. F5P by the rule: 1.0% and 0.05 per 300 lines. Do not read it as the answer to E4: E4 refused padding because 23% of argo's padding props had no satisfiable fix (owned by a primitive, `Page` offsets, optical), a structural test. The value rubric counts any ladder-valued padding as expressible, so it could not have produced that 23%. S2 by the rule: `tw-off-law/template`, `viewport-keyed/js` and `tw-off-law/important` above 10%.

## Then

The denylist plus `app-spacing` stays; the zone A allowlist does not flip, and neither does E4.

- **Remove first (no hit): `router-search/view-transition`.** Zero hits here; `guardrails.md` section 3 already names it as the first to go, on a record of zero consumer hits. The other 17 no-hit forms rest on records from other consumers (rollhook, shutterflow, the AI repos) that these four cannot speak to; drop one only when its record in section 3 is as thin.
- **Narrow second: `tw-off-law/template`** to template quasis inside class contexts (`className`, `cn`, `cva`, `clsx`). That leaves 1 of 75 hits and keeps the `bg-${tone}-600` case the form exists for.
- **Narrow third: `viewport-keyed/js`** to queries whose literal argument contains `width`; 8 of 28 hits remain and are true. Non-literal arguments need a decision (the harness counted them false).
- **Narrow fourth: `tw-off-law/important`** to utility-shaped tokens in class contexts; 27 of 38 remain.
- **F5 retest.** The refutation is mostly `unclear`. Percent, `ch`, `vh` and `fit-content` lengths are layout, like `w-full` and `max-w-prose`, which the namespace already leaves out; keeping them out would clear 13 of the 24 listed needs. The other 11 are dynamic Mantine props the codemod cannot resolve, which is a codemod gap, not an allowlist cost. Epos's 10 needs are not broken down here. This is a hypothesis to retest with a rubric that scores dynamic and unit-less values separately, not a re-score.
- **F5P retest** needs a structural rubric (element owns a primitive, is a flex or grid parent, is a page offset) before E4 can move either way.

## Affects

- `docs/v3/concepts/guardrails.md`: section 4 forms `tw-off-law` (g, template), `viewport-keyed` (JS), `tw-off-law` (f, important); section 13 S2, F5P and the F5 mention; E4 (not flipped). Frozen here; changed by a later amendment.
- `docs/v3/ARCHITECTURE.md` section 11 F5 row and the zone A default (denylist plus `app-spacing`, unchanged).
- The 59-form count: removing `router-search/view-transition` makes 58 and needs a `check-budgets` update by the issue that builds `table.ts`.
- `mig-codemod`: dynamic Mantine props are 11 of the listed F5 needs; its emit for them decides whether F5 can be retried.
