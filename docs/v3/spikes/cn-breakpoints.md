# Spike: compiled `cn` versus `clsx` (F6), the dead `sm:`/`lg:` reset (F7), the zone A colour denial (S4)

F6 is refuted, F7 and S4 pass. Keep the compiled `cn`: 31 of 460 `cn` calls in console and epos can emit two utilities of one group outside any `className` that `no-restyle` guards, and Chrome shows `clsx` hands the winner to the stylesheet, not to the author. The breakpoint reset (`md` 840, `xl` 1200, the rest dead) is safe to ship: a standalone `no-unknown-classes` catches 89 of 89 dead classes with no false positive. The zone A colour denial costs 0.29 waivers per 300 lines, a third of the bar.

Harness: `bun tools/spikes/cn-breakpoints/run.ts` (one JSON object on stdout, exit 0 when the harness ran). Both runs are in `tools/spikes/cn-breakpoints/out/` and are byte-identical. Concept: `docs/v3/ARCHITECTURE.md` section 11 F6 and F7, `docs/v3/concepts/tokens-visual.md` section 8 S4.

## Question

- **F6.** May `cn` flip from the compiled conflict table to bare `clsx`? Refuted when a call can emit two utilities of one CSS property group and is not a `className` handed to a bought primitive: `no-restyle` denies restyling there, nothing else does. Also: does `inline-flex` after `hidden` behave the same in both class orders?
- **F7.** With `--breakpoint-*` reset to `md` and `xl`, does a standalone `no-unknown-classes` catch every dead `sm:` and `lg:` class? A dead class compiles to nothing and fails silently, so the reset waits on it. Refuted unless caught equals total and total is above 0.
- **S4.** How many sites does the zone A colour denial of `tw-off-law` flag in app code, TS colour included? Refuted above 1 per 300 lines: then `text-(good|warn|bad)` is re-allowed.

## Method

**Repos.** Read-only scratch copies in the OS temp dir (deleted after the run) of the tracked `.ts` and `.tsx` files under the app source of four consumers: console (`software-factory/apps/console`, Tailwind, public), epos (the teamchat UI, Tailwind, counts only), argo (`apps/dashboard`, Mantine, public) and linewatch (`web`, Mantine, public). Tests, `.d.ts` and generated files are out. `components/ui/` is in for F6 (a bought primitive's own source is where `cn` merges variants) and out for S4 (zone S for the denial). Epos is located by shape under the home `IuRoot` (`EPOS_ROOT` overrides) and appears as counts only; private repos would appear as hashed ids. Repo heads are in the JSON: console's head moved during the work, so a re-run only reproduces the figures below while the heads match.

**F6, call sites.** A TypeScript AST walk finds every `cn(` call. Each call becomes a tree of class strings (emitted together), branches (ternary, `&&`, `||`) and unknowns. A call with a local `cva` definition (collected repo-wide by name) is expanded: base, then one value per variant group (the literal choice when the call names one, the default otherwise, all values when dynamic), then compound classes. A conflict is an ordered pair of tokens, the earlier one in an earlier argument or earlier in the string, that basalt-ui's compiled `cn` (`packages/basalt-ui/src/core/cn.ts`) collapses and `clsx` would keep side by side. Branches of one ternary are never paired with each other. Tokens that Tailwind 4.3.5 emits nothing for under the v3 sheet are skipped, because the compiled `cn` reads an unknown `text-*` as a colour and would invent conflicts (`text-2xl` against `text-muted-foreground`). A call is covered by `no-restyle` iff it is the whole value of `className` on an element imported from `components/ui/` or `basalt-ui/ui`. Everything else with a conflict is `conflictsBeyondNoRestyle`. A `className` pass-through and an argument the walk cannot read (a call, a member access) are not counted as conflicts: the number is a lower bound, and `openCalls` says how many calls it cannot decide.

**F6, emit case.** The v3 sheet (`tailwind.css` of the package, fonts import dropped) is built with `@tailwindcss/cli` 4.3.5 for `hidden` and `inline-flex`. One page holds both class orders; Chrome (playwright-core 1.63.0, `channel: 'chrome'`, the layout harness pattern) reads the computed `display`. The same is run for `flex` and `hidden`, the shape of a collapsing sidebar in console.

**F7.** The corpus is every class token in a class context (`className`, `cn`/`clsx`/`cva` arguments, class-shaped arrays, `.join(' ')`, template literals) whose variant chain has `sm`, `lg`, `max-*` or `min-*`, or whose utility starts with `max-` or `min-`. Partial template pieces are dropped. Ten seeded dead classes (`sm:hidden`, `lg:hidden`, `2xl:hidden`, `max-sm:hidden`, `min-lg:hidden`, `max-w-screen-sm`, `text-xl`, `bg-red-500`, `shadow-md`, `rounded-lg`) and ten seeded live controls (`md:hidden`, `xl:hidden`, `max-md:hidden`, `min-xl:hidden`, `max-w-2xl`, `text-md`, `bg-card`, `text-good`, `p-4`, `min-h-row`) are added. Two routes decide what is dead:

- ground truth: the `tailwindcss` compile API, one class at a time, v3 sheet; a class is live iff it emits a rule selector for itself;
- the matcher: the real CLI builds the v3 sheet over a file listing every candidate; `noUnknownClasses` flags each candidate whose class is not a selector of that CSS. It knows nothing about Tailwind.

`deadClassesTotal` is the ground-truth dead set, `deadClassesCaught` the part of it the matcher flags. Chrome checks the seeded ones: a dead class must leave the computed style unchanged at 600 and 1600 px, a live one must change it, and the same dead ones must change it under Tailwind's default scale (so the reset, not the class, is what kills them).

**S4.** The matcher is generated from the same table as the rule (`zoneADenial()` from `src/tokens/emit.ts`: 25 colour names, 15 prefixes). A class is flagged when, after variants, `!`, a leading `-` and `/NN` are stripped, it is `<prefix>[-side|offset]-<earned name>` or is denied outright (`bg-current`, `from-*`, `via-*`, `to-current`, ...); `fill-current`, `stroke-current` and `text-current` stay legal. TS colour is a JSX `c` or `color` attribute whose expression reads `VX.…`: the `c={VX.` and `color={VX.` patterns, plus conditional forms (`c={x ? VX.a : VX.b}`). `waiversPer300Lines` = flagged sites x 300 / scanned lines (TS and TSX, `components/ui/` excluded). Every flagged site is counted as a waiver, which is the upper bound: a site fixed by a primitive or `link` needs none.

## Measurements

Scanned: console 12,825 lines, epos 61,671, argo 49,335, linewatch 10,944.

**F6.**

| Repo    | `cn` calls | With a conflict | Covered by `no-restyle` | Beyond | Of those in primitive source | Via `cva` | Open calls |
| ------- | ---------- | --------------- | ----------------------- | ------ | ---------------------------- | --------- | ---------- |
| console | 112        | 12              | 1                       | 11     | 3                            | 4         | 10         |
| epos    | 348        | 21              | 1                       | 20     | 5                            | 9         | 49         |
| total   | 460        | 33              | 2                       | **31** | 8                            | 13        | 59         |

`f6.conflictsBeyondNoRestyle` = 31 (18 written out in the call, 13 through a `cva`). 192 calls pass a `className` through unread. The pairs are the shapes you would expect: a base class and a variant (`border-transparent` then `border-border`, `text-md` then `text-sm`, `opacity-0` then `opacity-100`), a default and a state (`px-2` then `px-0` when collapsed), and `flex` then `hidden` in console's sidebar.

Emit case, computed `display` in Chrome:

| Class order          | `display`     |
| -------------------- | ------------- |
| `hidden inline-flex` | `inline-flex` |
| `inline-flex hidden` | `inline-flex` |
| `flex hidden`        | `none`        |
| `hidden flex`        | `none`        |

The class attribute order changes nothing. The stylesheet puts `hidden` before `inline-flex` and `flex` before `hidden`, so the later one in the sheet wins. `cn('inline-flex', 'hidden')` returns `hidden` and renders hidden; `clsx` returns both and renders `inline-flex`. The author's order only survives when it happens to match the sheet's.

**F7.**

| Kind        | Uses in console + epos | Dead under the reset |
| ----------- | ---------------------- | -------------------- |
| `sm:`       | 62                     | 62                   |
| `lg:`       | 46                     | 46                   |
| `max-*:`    | 228                    | 30                   |
| `min-*:`    | 129                    | 1                    |
| `max-` util | 184                    | 22                   |
| `min-` util | 618                    | 10                   |

1,229 uses, 375 unique classes (console 182 uses, epos 1,047). 82 unique classes are dead (154 occurrences; console 42, epos 112). With the ten seeded ones (three also occur in real code) the dead set is 89: `f7.deadClassesTotal` 89, `f7.deadClassesCaught` 89, no false positive, no miss. Seeded: 10 of 10 dead verified and flagged; 10 of 10 live verified and not flagged. Chrome: all 10 seeded dead classes change nothing at 600 and 1600 px; all 10 live ones do; all 10 dead ones do change the page under Tailwind's default scale. Every `sm:` and `lg:` use is dead, as designed. The dead `max-*:` variants are `max-sm:` plus one `max-2xl:`. The dead `max-` and `min-` utilities are `max-w-screen-*` and sizes from the apps' own `@theme` (`max-w-<name>`, `min-h-<name>`), which the v3 sheet does not define; container sizes such as `max-w-2xl` stay live.

**S4.**

| Repo      | Lines  | Class sites | TS colour | Flagged |
| --------- | ------ | ----------- | --------- | ------- |
| argo      | 49,335 | 0           | 24        | 24      |
| console   | 12,110 | 36          | 0         | 36      |
| linewatch | 10,944 | 0           | 9         | 9       |
| total     | 72,389 | 36          | 33        | 69      |

`s4.waiversPer300Lines` = 0.286. Counting only the literal `c={VX.` and `color={VX.` patterns: 0.265. Counting only TS colour that names an earned hue (status, accent, line, series) and leaving neutral inks (`VX.muted`, `VX.faint`): 0.249. All three sit at about a quarter of the bar. Console's 36 class sites are 23 `focus-visible:ring-ring` (bespoke focus styles next to the primitive's), 5 `text-destructive`, 3 `focus-visible:border-ring`, 2 `bg-destructive`, 2 `bg-good`, 1 `bg-warn`. Argo and linewatch are Mantine and carry no Tailwind colour class: their sites are all `c`/`color` props.

Limits.

- F6 reads call sites, not behaviour. A conflict is "can emit two utilities of one group", as the falsifier defines it. How many of the 31 render differently under `clsx` depends on the stylesheet order of each pair, which was measured for two pairs only. The verdict does not need it: the falsifier is 0.
- The 59 open calls and 192 pass-throughs hide arguments the walk cannot see. The 31 is a floor.
- The oracle is the compiled `cn` of this branch. It can invent a conflict for a utility it groups wrongly; the v3 liveness filter removes the known cause (unknown names read as colours), and the pairs read in review were real. A residue of false positives is possible; zero is not.
- F7 ground truth and matcher both come from Tailwind 4.3.5, by two routes. The seeded classes and Chrome are what show the two agree with the world. The matcher sees only the classes handed to it: it needs every class token of the project listed, as the real rule would take them from the AST.
- S4 counts every flagged site as a waiver (upper bound) and uses a class-context walk of the lint's reach, not the lint. Epos is not in S4 (the falsifier names argo, console, linewatch).

## Verdict

F6: REFUTED
F7: PASS
S4: PASS

Verdict: REFUTED

F6 by the rule: 31 conflicts beyond `no-restyle`'s reach against 0. F7: 89 caught of 89, total above 0. S4: 0.286 waivers per 300 lines against the bar of 1. `Verdict` is `PASS` only if all three pass, so it is REFUTED on F6 alone; F7 and S4 stand.

## Then

- **F6, keep the compiled `cn`.** `cn` stays the conflict-aware merge written for the v3 theme; the architecture's "F6 may flip to `clsx`" does not happen. The 9 KB buys 31 sites (a collapsing sidebar's `flex` then `hidden`, base and variant colour, default and state spacing) whose winner `clsx` would hand to stylesheet order.
- **F7, the reset stands.** Ship `md` 840, `xl` 1200 and nothing else. `no-unknown-classes` needs the emitted CSS, not a hand list. The migration carries 154 dead occurrences, all 62 `sm:` and 46 `lg:` uses first; they rewrite to container variants, `md:` or a dropped class.
- **S4, the denial goes in at error.** Do not re-allow `text-(good|warn|bad)`. The cost sits in console's bespoke focus rings (use the primitive's ring), 5 status fills and 5 `text-destructive`, and in Mantine's `c={VX.…}` props, which `Num tone` and `Status` replace.

## Affects

- `ARCHITECTURE.md` section 5 (Merge row: drop "F6 may flip to `clsx`"), section 11 (close F6 REFUTED, F7 PASS, S4 PASS, 2026-11-11), section 12 `cn` row (J2/J3 condition: compiled by default holds). Not edited here.
- `tokens-visual.md` section 8: S4 closed as run, PASS.
- `v3-tok-t3-css` / `src/css`: the `--breakpoint-*` reset needs no change; `--container-*` stay extended.
- `v3-gr-1-rule-table`: `no-unknown-classes` as an emitted-CSS lookup; `tw-off-law` zone A colour denial at error, generated from `table.ts`, with a fixture that includes `focus-visible:ring-ring` and `c={VX.status.warn}`.
- `cn` in `src/core`: no change. The `OVERRIDES` table is the contract (shorthand clobbers longhand only when it comes later); the F6 pairs make a ready fixture set.
- Migration: a codemod row for `sm:` and `lg:` before the reset lands in a consumer.
