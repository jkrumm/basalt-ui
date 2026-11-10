# Spike: `no-restyle` on the `basalt-ui/ui/*` specifier

Harness: `tools/spikes/no-restyle/` (`bun tools/spikes/no-restyle/run.ts`). Concept: `docs/v3/concepts/guardrails.md` section 13 S1. Contract: `docs/v3/ARCHITECTURE.md` section 4.1.

## Question

Does the bought `shadcn/no-restyle` (`@shadcn/lint` 0.2.5, run under oxlint 1.93.0) fire on `import { Button } from 'basalt-ui/ui/button'` carrying a restyling `className`, when `componentImports` names the npm specifier, and does it still fire when a `tsconfig` `paths` eject maps that specifier to a local file? Contract 4.1 (primitives ship in npm, imported as `basalt-ui/ui/<name>`) holds only if it does. The basis so far was a source read; an earlier scratch run on oxlint 1.90.0 produced no findings and decided nothing.

## Method

`run.ts` builds a scratch project per case in the OS temp dir, copies the `*.fixture.txt` files in as `.tsx`, writes an `.oxlintrc.json`, lints with the spike's own `oxlint` and removes the directory.

| Case                 | Layout                                                                                            | File content                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npmSpecifier`       | `node_modules` is the spike's (stub `basalt-ui` exporting `ui/button`); no `tsconfig`             | `<Button variant="outline" className="h-12 bg-red-500">`                           |
| `pathsEject`         | no `node_modules`; `tsconfig` `paths` `"basalt-ui/ui/button"` to `./src/components/ui/button.tsx` | same file                                                                          |
| `valid`              | `paths` layout                                                                                    | `<Button variant="outline" className="w-full">`                                    |
| `unmatchedSpecifier` | no resolution at all                                                                              | the restyle file with `other-lib/ui/button` (negative control, not in the verdict) |
| `positiveControl`    | all four files carry `export const probe: any = 1`                                                | `typescript/no-explicit-any` must fire in every file                               |

Config under test: `shadcn/no-restyle` with `componentImports: ["^basalt-ui/ui/"]`, top-level `allow: ["layout"]`, one contract `{ pattern: "^Button$", allow: ["w-full"], deny: ["h-*", "bg-*"], message }`. Every case is run a second time with `settings.shadcn.ui: ["basalt-ui/ui"]` added (reported under `settingsUi`).

Pins: oxlint 1.93.0, `@shadcn/lint` 0.2.5, eslint 10.14.0 (peer), `@typescript-eslint/parser` 8.72.1 (peer; 8.72.2 was inside the 3-day install cooldown). oxlint 1.93.0 was also inside it, so `tools/spikes/no-restyle/bunfig.toml` exempts oxlint and its bindings only.

## Measurements

`run.ts` ran twice; the two outputs are byte-identical (`diff` empty). Exit 0 both times. Run 1:

```json
{
  "tool": { "@shadcn/lint": "0.2.5", "oxlint": "1.93.0" },
  "npmSpecifier": "fired",
  "pathsEject": "fired",
  "valid": "silent",
  "unmatchedSpecifier": "silent",
  "positiveControl": "fired",
  "deny": {
    "npmSpecifier": [
      "6:39 Button owns its height and fill: use a variant.",
      "6:39 Button owns its height and fill: use a variant."
    ],
    "pathsEject": [
      "6:39 Button owns its height and fill: use a variant.",
      "6:39 Button owns its height and fill: use a variant."
    ],
    "valid": []
  },
  "settingsUi": {
    "npmSpecifier": "fired",
    "pathsEject": "fired",
    "valid": "silent",
    "unmatchedSpecifier": "silent"
  },
  "verdict": "pass"
}
```

(Abridged: the full object also carries per-case `diagnostics` and `stderr`; stderr is empty everywhere.) The deny text is the contract `message`, reported once per denied token (`h-12`, `bg-red-500`) at the `className` string, 6:39.

Observations that change how the real rule is written:

- **The specifier is matched as text.** In 0.2.5 `componentFromImport` tests `componentImports` against the import source string. The `paths` case fires without any resolution (the negative control, same file and an unnamed specifier, stays silent), and `@shadcn/lint` never reads a `tsconfig`. `pathsEject` therefore proves "an eject that keeps the specifier stays guarded", not that `paths` was followed.
- **A contract with `deny` and no `allow` is closed.** The first `valid` run fired on `w-full`: "its contract allows no classes". Layout needs the top-level `allow: ["layout"]` or an explicit per-contract `allow`. gr-1 generates contracts from cva, so it must always emit `allow`.
- **`settings.shadcn.ui` is not needed.** Results are identical with and without it.
- **A relative import of an ejected file** (`../components/ui/button`) does not match `^basalt-ui/ui/`. Contract 4.2 keeps the specifier through `paths`, so this is not a 4.1 failure, but call sites must not be rewritten to relative paths.

## Verdict

Verdict: PASS

`npmSpecifier` fired with the deny message, `pathsEject` fired with the deny message, `valid` silent, `positiveControl` fired.

## Then

Contract 4.1 holds on this axis: nothing in the rule table or in 4.1 changes. The REFUTED actions (`settings.shadcn.ui`, an own specifier-keyed rule of about 60 lines) are not needed and the own rule was not built. v3-gr-1-rule-table uses `componentImports: ["^basalt-ui/ui/"]` directly and emits `allow` with every generated contract.

## Affects

- v3-gr-1-rule-table: `componentImports` as above; every generated contract carries `allow`; add a `RuleTester`-style case for the unmatched specifier so a pattern typo cannot go silent.
- v3-prim-p1-core: the eject writes the `tsconfig` `paths` entry and must leave the specifier in call sites.
- `guardrails.md` section 13 S1: close it as run (PASS, 2026-11-10). Not edited here.
