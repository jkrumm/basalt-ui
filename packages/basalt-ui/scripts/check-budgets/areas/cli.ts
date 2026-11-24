/**
 * Area: cli — non-test lines of the `basalt-ui` CLI (`src/cli/**`).
 */
import { join } from 'node:path'

import { PKG_ROOT, totalLines, walkFiles } from '../lib'
import type { Raises, RowDef } from '../lib'

export const rows: readonly RowDef[] = [
  // 4000 -> 4250: the AGENTS.md block move + the doctor checks (the CLAUDE.md migration was removed in 2.0).
  // 4250 -> 4350: doctor's `exact-peers` and `config-keys` (argo friction rows 1-3).
  // 4350 -> 4450: `resolveAppDir` + the app-dir seeds/doctor check (argo friction rows 4-5).
  // 4450 -> 4525: the import-graph `app-wiring` follow + the Makefile-aware CI gate (argo friction rows 11-12).
  // 4525 -> 4589: doctor's `oxlint-floor` and the CSS + dropped-list scan in `dropped-subpaths` (argo friction rows 61, 63, 66).
  // 4589 -> 4628: the Start-app seed skip in `init`/`sync` and doctor's Start `app-wiring` (argo friction rows 62, 67).
  // 4628 -> 4674: Start `app-wiring` rejects a `router=` provider, plus the `queryClient` heuristic warning (rows 62, 67).
  // 4674 -> 4710: any-tag `router=` + spread detection in Start `app-wiring`, and `sync`'s stale-seed warning (rows 62, 67).
  // 4710 -> 4726: literal-aware provider tags, sticky spread match, and the split stale-seed warning (rows 62, 67).
  // 4726 -> 4859: #261's `router-wiring` module and `source-text` helper (rows 71, 72, 74) — comments restored rather than condensed.
  // 4859 -> 4890: `installRootAbove` (cli/install-root.ts) — one predicate for doctor and sync, with the same-install check (row 77, review of #267).
  // 4890 -> 4955: the declared `basalt.shell: false` — config key, seed skip, shared seed-retire notice and the doctor finding (ledger row 82, linewatch W2).
  // 4955 -> 5020: `app-wiring` accepts one provider in the root or a pathless layout, fails an untyped `createRootRoute` and a missing root (ledger rows 113, 115, weatherorb W37).
  // 5020 -> 5165: `app-wiring` follows one import hop (relative or tsconfig `paths`) to a provider wrapper; `sync` judges a Start seed by content (ledger rows 121-123, weatherorb W39); the hop resolver and provider-tag reader are leaf modules.
  // 5165 -> 7073 (W31): `basalt-ui shot` +1691 (cli/shot/: capture with per-state crops, contact sheets, the in-page measurer and theme scale incl. basalt's own `--basalt-*` steps, the board, out-dir safety, the launcher; SPEC § 9.5); the reviewer install and rule `paths:` from `basalt.roots` +75 (rows 135-136); doctor's stale-board notice and optional Playwright line +142 (cli/board-freshness.ts).
  // 7073 -> 7098 (W32): `shot` reports a full-round radius as "full" — the raw radius reading, `radiusReading` and its two call sites in cli/shot/ (+25).
  // 7098 -> 7100 (W32): `radiusReading`'s zero-size and percentage branches (+2).
  // 7100 -> 7124 (W33): `shot` hovers a declared `data-shot-at` point and probes for a rendered readout only (+24).
  // 7124 -> 7132 (W33 review): `data-shot-at` parsed by one anchored pattern within [0, 1] (+8).
  // 7132 -> 7478 (fix/shot-real-data): `shot` on a real, signed-in app (+346). Owner-requested (2026-10-17), consumer: argo. cli/shot/real-data.ts +165 (`@env`/`@file` resolution, header and `--api` validation, the read-only proxy with its depth-only log, status classes and timeout, the origin-guarded absent-only seed script), capture.ts +89 (one `visit` that loads, auto-anchors and checks the data; per-visit problem scoping with `collect`/`flagProblems`; `--wait`), index.ts +46 (six flags and their rules, proxy wiring), serve.ts +25 (Host/Origin/Fetch-Metadata guard), help.ts +20 (flags, `multiple` in the option type, the real-app example).
  // 7478 -> 7512 (W36): `managedFiles` walks `agent/skills/<name>/` so a skill's `references/**` are managed files too; injectable `pkgRoot` on init/sync/renderContext; upward empty-dir prune (+34).
  // 7478 -> 8006 (w36 reviewer-detector): `basalt-ui shot detect` (cli/shot/detect.ts: the LLM-free [measured] rules, oxlint JSON, severity and score, history trend), the `absent` anchor status (capture.ts), the help text and `--lint` flag (+528).
  // 8006 -> 8050 (w36 review round 1): detect's atomic history/detect.json write with `.bak` recovery and clean I/O errors, `craft-1/scale-missing`, P0/P1-only exit (+44).
  // 8084 -> 8087 (W36 palette-guard): `check-theme` routes the series module to `series-palette` through one helper (+3).
  // 8087 -> 8091 (w36 button-section-inset): `shot` measure skips text inside a disabled control, WCAG 1.4.3 (cli/shot/measure.ts +4).
  // 8091 -> 8427 (w37 harness): shot hides chrome and frames tall anchors, reveals in-page with a short step timeout and reports `absent`, warns and detects a route with no data-shot-states; `init` seeds a stock Vite main.tsx and its peers (+336: 8427 - 8091).
  // 8427 -> 8443 (w37 harness-hover): the launcher passes blink pointer settings so a desktop context reports `hover: hover` / `pointer: fine` (cli/shot/playwright.ts +16).
  // 8443 -> 8457 (w37 harness-hover r2): `craft-7/no-declared-states` is P2 and names the anchors holding a state surface (`stateful` on the shot record, cli/shot/capture.ts + detect.ts +14).
  // 8457 -> 8463 (w43 shot-strip, argo UPSTREAM Wave 53 row 2): an anchor first seen in a URL state gets a `rest` `absent` record, so the board never calls a legitimate absence "not captured" (cli/shot/capture.ts +6). Consumer: argo body composition.
  // 8463 -> 8480 (w44 shot-scrollport): a full-page shot grows only by the page scrollport's hidden height, never a nested scroll box's (cli/shot/capture.ts +17). Consumer: every `basalt-ui shot` user — found on the playground S3 item timeline at 390; argo boards shoot the same harness.
  // 8480 -> 8668 (w48 friction rows 168-179, argo-friction.md): `shot` rejects a whitespace route, names the project in --out errors, auto-anchors fall back to main/section/header/form, `shot detect` prints "nothing measured" and a per-out-dir trend with finding counts, warns when every route renders the same content, names the contrast threshold (cli/shot/ + help.ts +77); `doctor --from <version>` and the stale tokens/fonts sheet warning (cli/doctor*.ts +112); sync's read-only root-template report paid for itself by trimming comments (-1). Consumers: linewatch, rollhook, obsidian, rb (the 2.28 bumps).
  // 8668 -> 8843 (w49 cli, argo-friction rows 186 + W48 P3): `init` wires the router plugin into vite.config, runs the lockfile's install and one vite build for routeTree.gen.ts (cli/init.ts + the injected, time-boxed `run` in index.ts; the pending install/build is read from artifacts so a re-run says what is left, the pm read from the nearest lockfile, `--no-install`, +140); a hover/tooltip crop first clears the previous anchor's tooltip (cli/shot/capture.ts, +24); `no-declared-states` is per anchor (capture.ts + detect.ts, +11). Consumers: every stock-Vite `init` and `shot` user (argo, linewatch, rollhook).
  // 8843 -> 8870 (w50 table, PR 538): a hover crop mutes every other visible tooltip while it is taken and restores exactly those (cli/shot/capture.ts +27). Consumers: every `basalt-ui shot` user.
  // 8870 -> 8879 (w51 shot): a hover/tooltip crop with no `aria-describedby` claims the readout inside its own trigger, so an earlier chart's stale one never wins `.first()` (cli/shot/capture.ts +9). Consumers: every `basalt-ui shot` user.
  // 8879 -> 8923 (v3 verb stubs): `eject`, `migrate` and `lint` registered as not-implemented verbs (cli/verbs-v3.ts +39, the dispatcher case +5). Consumer: shutterflow and image-gateway, whose direct 1.x jump runs `migrate --from`.
  // 8923 -> 9691 (v3-mig-cli): `basalt-ui migrate` (cli/migrate/: row reader and chain fold, import census, report and `--check`, +763) replaces the stub case. Consumer: shutterflow and image-gateway, whose direct 1.x jump runs `migrate --from`.
  // 9691 -> 9836 (v3 sync, v3-sk-2-sync): the manifest reader/writer (cli/manifest.ts) and the render-and-compare engine with its block splice (cli/sync/, +512) replace the 2.x cli/sync.ts (-342); the 2.x ledger engine in index.ts stays until v3-sk-3 rewrites `init`, the only caller left (+145 net). Consumer: rollhook (the first G0 `bridge` install).
  // 9836 -> 11138 (v3-prim-p7-eject): `basalt-ui eject` with `--all`, `--adopt`, `--undo`, `--raise` (cli/eject/: flag parse, root and app resolution, the JSONC paths writer, the ledger row and budget raise, +987) and the merge helpers `sync` imports (cli/merge/: header, seed digest and import rewrite, `git merge-file` wrapper, formatter resolve, the root-export check, +305) replace the stub case (+1 net in index.ts and verbs-v3.ts; totalLines counts each new file one line longer than wc). Consumer: console (`--adopt` of its base-nova files) and rb (`--adopt --raise` for the PIN entry).
  // 11138 -> 11309 (v3-sk-3b-budget): the consumer budget module (cli/budget/: the `.basalt/budget.json` type, seed, reader, writer, breach count and the base-ref ratchet `landBudget`, +171). Consumer: rollhook (`init` seeds it and `lint` counts it on the first G0 `bridge` install).
  // 11309 -> 11637 (v3-tok-t4-cli): `tokens:css` is rewritten onto the v3 emitters with `--format json` and `--extra` (cli/tokens-css.ts +103 net, the app-token loader and emitter cli/tokens-css-extra.ts +214, the flag schema in cli/help.ts +10). Consumer: rb (`--basalt-confidence-*` through `--extra`) and weatherorb (`--basalt-weatherorb-*`).
  // 11637 -> 11886 (v3-cli-sibling): the temporary `basalt.sibling` key: the resolver (cli/resolver.ts), the sibling placement and prefix (cli/sync/sibling.ts, render and engine `repo:` paths), `init` and doctor's sibling branches, the manifest `sibling` field (+249). Consumer: argo and shutterflow, whose second install runs after the 3.0.0 publish; removed with the last cutover.
  // 11886 -> 11933 (v3-lint-1-eject-zones): `sync` and `eject` write the consumer oxlint preset through `buildPreset`, so a bridge root's vendored zone and an ejected primitive's structure zone are in it (cli/presets.ts +37, cli/eject/index.ts +10: eject rewrites the preset when a row changes). Consumer: console, whose ejected primitives lint clean right after `eject`.
  // 11933 -> 12047 (v3-wiring-1-init-scaffold): `init --profile app` writes the router scaffold its templates promise (cli/init/router-seeds.ts, the seed-to-template map in cli/router-wiring.ts, the router plugin in the Vite patch, +113). Consumer: shutterflow's `app` install, which wrote these seven files by hand.
  // 12047 -> 12245 (v3-wiring-1-wiring): `init` installs the `app` profile's runtime and build peers from one table (cli/peers.ts), patches the stock Vite config and stylesheet to the one entry and wires the lint script (cli/init/steps.ts +153); doctor resolves `oxlint` from the project's bin and passes the ratchet on a repo with no base. Consumer: a fresh create-vite `app` install, which needed each of these by hand.
  // 12245 -> 12281 (v3-wiring-2-generated-tree): `init --profile app` writes the router's generated tree (`src/routeTree.gen.ts` under each declared root) into the `.oxlintrc.json` and formatter ignores (cli/init/steps.ts +30 net) and doctor reads the vite config's `generatedRouteTree` (cli/router-wiring.ts +7). Consumer: a built create-vite `app`, whose doctor check 11 failed on TanStack's own `/* eslint-disable */`.
  // 12281 -> 12418 (v3-wiring-2-wiring): `init` keeps a declared peer version that meets the profile's range instead of pinning it down, deletes create-vite's stock `App.tsx` and `App.css` once the entry is replaced (cli/init/steps.ts +21, cli/init/router-seeds.ts +44), and doctor check 3 holds every declared peer to its range and names the spec to add, both through one range matcher (cli/peers.ts +67, cli/doctor/install.ts +5). Consumer: a create-vite `app` whose README step installs a newer router plugin before `init`.
  // 12418 -> 12517 (v3-lint-2-waiver-ceiling): `lint --raise <field> --consumer` lifts the waivers and escapes ceilings through a raises row (cli/budget/index.ts `raiseCeiling` and `raiseCommand`, cli/lint/index.ts, +99); every breach message names the command for its field. Consumer: an app that follows a rule's last `Next:` rung to a reasoned waiver and has no command to answer the gate.
  // 12517 -> 12641 (v3-wiring-3-route-tree): `init --profile app` writes the first `src/routeTree.gen.ts` through the router plugin's own generator and swaps create-vite's `tsc -b && vite build` to `vite build && tsc -b` (cli/route-tree.ts +59, cli/init/steps.ts +31, cli/init/index.ts +15); doctor check 12 fails a script that runs `tsc` before the tree exists (cli/doctor/app.ts +23). Consumer: a create-vite `app` whose own build was red right after `init` and after every new route.
  // 12641 -> 12869 (bench-blocks): `basalt-ui add` installs a shipped block with its merge base and ledger row (cli/add/: catalog, flag parse, plan, help, +240) and `sync` merges an added block file by file (cli/sync/blocks.ts +150); the primitive readers skip block rows (ledger, vite ejects, doctor, +30); the shared three-way helpers are exported, not moved; eject's manifest location and root picking move to cli/install-root.ts, shared with add. Consumer: an app copying a reference page, which had only recipes no compiler checks.
  // 12869 -> 12905 (bench-theme-attributes, Issue 3105): `tokens:css --accents <names>` emits the accent sheet, one :root[data-accent] block per named accent (cli/tokens-css.ts +33, cli/help.ts +3). Consumer: an app that offers its readers an accent picker.
  // 12947 -> 12970 (trial 2 kit defects): shot detect reads the frames the rest shot draws in their empty phase (measure.ts +9, detect.ts +13, types.ts +1).
  // 12905 -> 12947 (shot-overlap): `shot`'s measurer clips each text box by its clipping ancestors and its own ellipsis before the overlap test (measure.ts, +42).
  // 12970 -> 13272 (ga-agent-layer, Issue 3167): `init --profile app` installs lucide-react for the icon provider its root templates mount (init/steps.ts +13); `shot detect --facts <dir>` counts the words, phrases and constants a page says in several places (shot/facts.ts +208, shot/detect.ts +79, help.ts +2). Consumer: a basalt-design page whose fact count was a shell one-liner.
  // 13272 -> 13285 (init-sibling-oxfmt): a sibling app's new `.oxfmtrc.json` copies the repo root's formatter settings, so oxfmt does not read a file holding only ignorePatterns (cli/init/steps.ts +13).
  // 13285 -> 13308 (init-layout-seeds, Issue 3171): `init` seeds no `_app` layout or nav beside a root route the app keeps or a page that already serves `/`, and names the skip as a to-do (cli/init/router-seeds.ts +23). Consumer: the playground, moved onto init by Issue 3164, which kept its own `__root.tsx` and could not build.
  // 13308 -> 13311 (Issue 3162): `shot` names a DataTable's `table-root` the `data-table` anchor its help promises (capture.ts +2, types.ts +1).
  // 13311 -> 13338 (Issue 3164): `init --profile app` installs the two peers `basalt-ui/shell` imports (cli/peers.ts +2), and the peer fix line of the `basalt()` gate and doctor check 3 adds a pin exactly and a declared range as the range (cli/peers.ts `peerAddLine` +19, cli/package-manager.ts `exact` +6). Consumer: a create-vite `app` whose build failed in the gate after `init`, on a line that put `--exact` beside a caret.
  {
    id: 'cli-lines',
    order: 110,
    label: 'CLI non-test lines (src/cli/**)',
    ceiling: 13338,
    measure: () =>
      totalLines(
        walkFiles(join(PKG_ROOT, 'src/cli'), /\.tsx?$/).filter((p) => !/\.test\.tsx?$/.test(p)),
      ),
  },
]

export const raises: Raises = {
  'cli-lines': [
    {
      from: 8879,
      to: 8923,
      consumer: '`migrate --from` on a direct 1.x jump',
      repo: 'shutterflow',
    },
    {
      from: 8923,
      to: 9691,
      consumer: '`migrate --from` on a direct 1.x jump',
      repo: 'shutterflow',
    },
    {
      from: 9691,
      to: 9836,
      consumer: '`sync --check` render-and-compare on a G0 `bridge` install',
      repo: 'rollhook',
    },
    {
      from: 9836,
      to: 11138,
      consumer: '`eject --adopt` of the base-nova files on a G1 `parts` install',
      repo: 'console',
    },
    {
      from: 11138,
      to: 11309,
      consumer: '`init` seeding and `lint` counting `.basalt/budget.json` on a G0 `bridge` install',
      repo: 'rollhook',
    },
    {
      from: 11309,
      to: 11637,
      consumer: '`tokens:css --extra` for app-owned vars and `--format json` for manifest hex',
      repo: 'rb',
    },
    {
      from: 11637,
      to: 11886,
      consumer: '`init` and `sync` in a declared `basalt.sibling` app beside the root install',
      repo: 'shutterflow',
    },
    {
      from: 11886,
      to: 11933,
      consumer: '`sync` and `eject` writing the ejected-primitive and bridge-root lint zones',
      repo: 'console',
    },
    {
      from: 11933,
      to: 12047,
      consumer: '`init --profile app` writing the router scaffold on a fresh Vite app',
      repo: 'shutterflow',
    },
    {
      from: 12047,
      to: 12245,
      consumer: '`init --profile app` and `doctor` on a fresh create-vite app, with no hand edit',
      repo: 'shutterflow',
    },
    {
      from: 12245,
      to: 12281,
      consumer:
        '`init --profile app` and `doctor` on a built create-vite app with a generated route tree',
      repo: 'shutterflow',
    },
    {
      from: 12281,
      to: 12418,
      consumer:
        '`init --profile app` on a create-vite app that already installed a newer router plugin, and `doctor` on its peers',
      repo: 'shutterflow',
    },
    {
      from: 12418,
      to: 12517,
      consumer:
        '`lint --raise waivers` on an app whose first reasoned waiver breaches the seeded ceiling 0',
      repo: 'shutterflow',
    },
    {
      from: 12517,
      to: 12641,
      consumer:
        '`bun run build` right after `init --profile app` and after a new route file on a create-vite app',
      repo: 'shutterflow',
    },
    {
      from: 12641,
      to: 12869,
      consumer:
        '`basalt-ui add <block>` copying a reference page into an app, and `sync` merging the block upstream into its edited copy',
      repo: 'basalt-ui',
    },
    {
      from: 12869,
      to: 12905,
      consumer:
        '`tokens:css --accents`: an app ships the accents its readers can pick (AppearanceSwitcher), as a tokens output of its manifest',
      repo: 'basalt-ui',
    },
    {
      from: 12947,
      to: 12970,
      consumer:
        'a trial page whose stat cell drew its empty text over loaded data and scored 100 in shot detect: the rest shot now names every frame in its empty phase (craft-7/empty-at-rest)',
      repo: 'basalt-ui',
    },
    {
      from: 12905,
      to: 12947,
      consumer:
        '`basalt-ui shot` rounds on the schedule page (Issue 3103): text a scroller clips or an ellipsis cuts is measured as the box the reader sees, not its full run',
      repo: 'basalt-ui',
    },
    {
      from: 12970,
      to: 13272,
      consumer:
        '`init --profile app` mounts the lucide icon defaults and installs lucide-react; `shot detect --facts <dir>` replaces the shell fact count the basalt-design skill carried',
      repo: 'basalt-ui',
    },
    {
      from: 13272,
      to: 13285,
      consumer:
        '`init` in a sibling app (apps/playground, Issue 3164) writing its own .oxfmtrc.json',
      repo: 'basalt-ui',
    },
    {
      from: 13285,
      to: 13308,
      consumer:
        'the playground, moved onto init by Issue 3164, kept its own __root.tsx and could not build (Issue 3171)',
      repo: 'basalt-ui',
    },
    {
      from: 13308,
      to: 13311,
      consumer:
        '`basalt-ui shot` rounds on any page with a DataTable (Issue 3162): the table is an anchor, as the help says',
      repo: 'basalt-ui',
    },
    {
      from: 13311,
      to: 13338,
      consumer:
        '`init --profile app` installs the two peers `basalt-ui/shell` imports (trial 2, entry 5), and the peer fix line (`basalt()` gate, doctor check 3) saves a declared range as the range, never `--exact` beside a caret (Issue 3164)',
      repo: 'basalt-ui',
    },
  ],
}
