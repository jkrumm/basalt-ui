# Spike: the epos bridge probe (G0, DPO 16)

Verdict: **no tenant, `--neutral` and `--selector` go at G2**, unless the owner names a tenant. The brand navy needs a fill tone: the derived fill sits about 28 tone points above it. Epos's own working tree was not touched: `git status --porcelain` and `HEAD` there hash the same before and after each run, and nothing of epos is committed here.

Harness: `bun tools/spikes/epos-bridge-probe/run.ts` (one JSON object on stdout; exit 0 means the harness ran, not that a hypothesis held; `EPOS=<checkout>` overrides the default location). Concept: `docs/v3/concepts/migration-release.md` section 5, G0; DPO 16 in `docs/v3/DIRECTION.md`.

## Question

Does epos, a committed v3 consumer that rejected basalt over required peers, select more than one brand token set (a tenant)? If not, `--neutral` and `--selector` have no consumer and DPO 16 deletes them at G2. And does epos's navy survive as a hue-only `--accent` without a separate fill tone?

## Method

- An OS-temp copy of the epos UI directory: no `.git`, `.env*`, `node_modules`, `dist`, and no lockfile (so nothing resolves against a pinned registry). Removed at the end of the run.
- Install: a `bun pm pack` tarball of `packages/basalt-ui` at the base commit, `npm install --legacy-peer-deps --ignore-scripts` against the public registry. No employer registry or credential. `frozenInstallRun` is false: a frozen install was not claimed.
- `peersAdded` is derived: the tarball's non-optional `peerDependencies` that the copy's `package.json` does not carry.
- In the copy: `init --profile bridge --root src --accent <seed>`, `doctor`, `lint`, `tokens:css --accent <seed> --format json`. The seed is the navy's hue at fixed chroma 48 and tone 50, so only the hue comes from epos.
- `navyNeedsFillTone` is true when, in either scheme, the emitted `brand-fill` tone (`hct.ts`) is more than 10 points above the navy's, or `tokens:css` exits non-zero on the fill gate.
- `tenantSets`: distinct selections that declare a brand token in epos's own CSS, read before `init` rewrites `tokens.css`. A selection is the selector with its scheme part (`data-theme`, the dark media rule) removed; 1 means one brand.
- Numbers and rule ids only: no source line, file name, host or customer name is printed.

## Measurements

Two runs, same base commit; `diff` of the two outputs is empty.

```json
{
  "base": "bc65b79c",
  "basaltVersion": "2.29.0",
  "peersAdded": [
    "@mantine/core",
    "@mantine/hooks",
    "@mantine/modals",
    "@mantine/notifications",
    "@mantine/spotlight",
    "@tanstack/react-query",
    "@tanstack/react-router"
  ],
  "peerCounts": {
    "declared": 43,
    "optional": 31,
    "requiredAdded": 7
  },
  "frozenInstallRun": false,
  "initExit": 0,
  "doctorExit": 1,
  "doctorChecks": [
    {
      "id": "manifest",
      "result": "pass"
    },
    {
      "id": "install-parity",
      "result": "pass"
    },
    {
      "id": "preset",
      "result": "pass"
    },
    {
      "id": "agents-block",
      "result": "pass"
    },
    {
      "id": "skills-rules",
      "result": "pass"
    },
    {
      "id": "hook",
      "result": "pass"
    },
    {
      "id": "tokens-css",
      "result": "pass"
    },
    {
      "id": "peers",
      "result": "fail"
    },
    {
      "id": "lint-scan",
      "result": "fail"
    },
    {
      "id": "formatter-ignore",
      "result": "skipped"
    },
    {
      "id": "budgets",
      "result": "fail"
    },
    {
      "id": "app-wiring",
      "result": "fail"
    }
  ],
  "lintExit": 1,
  "lintFindingsByRule": {
    "shadcn/no-arbitrary-values": 243,
    "basalt/viewport-keyed": 404,
    "shadcn/no-restyle": 402,
    "shadcn/no-inline-styles": 124,
    "basalt/tw-off-law": 104,
    "shadcn/require-static-classes": 25,
    "basalt/waiver-needs-reason": 2,
    "basalt/dark-fork": 14,
    "stylelint/declaration-property-value-disallowed-list": 15,
    "basalt/colour-literal": 148,
    "shadcn/no-raw-colors": 1,
    "basalt/fixed-colour": 1,
    "shadcn/no-unknown-classes": 4,
    "stylelint/declaration-property-value-allowed-list": 11,
    "stylelint/selector-disallowed-list": 2,
    "stylelint/declaration-no-important": 5,
    "stylelint/at-rule-disallowed-list": 15
  },
  "lintFindingsTotal": 1520,
  "tokensExit": 0,
  "navyTone": 20.1,
  "fillTone": {
    "light": 47.7,
    "dark": 47.7
  },
  "toneMargin": 10,
  "navyNeedsFillTone": true,
  "tenantSets": 1,
  "tenant": false,
  "flags": "delete-at-G2",
  "eposStatusUnchanged": true,
  "problems": []
}
```

| Measure              | Value                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `peersAdded`         | 7 of 43 declared peers are required and absent from epos (5 Mantine packages, 2 TanStack)                                                         |
| `doctorExit`         | 1: 7 pass, 4 fail (`peers`, `lint-scan`, `budgets`, `app-wiring`), 1 skipped (`formatter-ignore`)                                                 |
| `lintFindingsByRule` | 1,520 findings over 17 rules; `basalt/viewport-keyed` 404, `shadcn/no-restyle` 402, `shadcn/no-arbitrary-values` 243, `basalt/colour-literal` 148 |
| `tokens:css`         | exit 0; fill tone 47.7 in both schemes against a navy tone of 20.1                                                                                |
| `navyNeedsFillTone`  | true (+27.6, margin 10)                                                                                                                           |
| `tenantSets`         | 1                                                                                                                                                 |

Reading the numbers: the tarball is the 2.x package at the base commit, so `peersAdded` answers the 2.29 surface, not the v3 target; the v3 table (0 required peers, contract 3) has to be re-measured at G6. The `peers` check fails on a tailwind pin one patch behind, and `lint-scan` fails because the copy wires nothing to call `lint`; neither is a finding about epos. The lint count includes test files, which the bridge roots scan.

## Verdict

Tenant: no
Flags: delete-at-G2

Epos selects one brand token set; light and dark are the same selection. The navy as an `--accent` seed needs a fill tone (`navyNeedsFillTone` true): the derived fill is a mid-tone, the navy a dark one, so a navy primary button is not what `--accent` yields.

## Then

- The orchestrator files the `--neutral` and `--selector` deletion after `v3-freeze-g1`.
- DPO 16's navy: a fill-tone input (or a second seed) is needed for the navy, or epos accepts the lighter fill. That is the owner's look decision, not decided here.
- Re-run this probe against the v3 tarball before G6 so `peersAdded` is measured on the surface that ships.

## Affects

`docs/v3/DIRECTION.md` DPO 16; `docs/v3/concepts/migration-release.md` section 5 (G0 and G6 exit proofs); `tokens:css` flags at G2; `v3-freeze-g0`, which lists this probe in `after`.
