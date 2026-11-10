# Spike: Q1 provider skeleton under 5 KB gz

Q1 passes. A `BasaltProvider` with scheme, locale and lang costs 298 B gzip over a bare React `createRoot`, 6.0% of the 5.0 KB cap. The `provider-v3` budget row is 500 B and the cap stays untouched.

Harness: `bun tools/spikes/provider/run.ts` (one JSON object on stdout, always exit 0). Concept: `docs/v3/concepts/quality-contract.md` section 10, Q1.

## Question

Can the provider carry scheme, locale and lang in at most 5.0 KB gzip, with no `cn` tables, message tables, Intl caches or `en` catalog in its chunk, and no `persisted` or Base UI Toast in its closure? Refuted above 5.0 KB gz; that is a Contract amendment request, never a raised cap.

## Method

- Skeleton: `packages/basalt-ui/src/core/provider.tsx`. `BasaltProvider` takes `scheme` (`light|dark|auto`), `locale` (default `en`) and `lang` (default `locale`). Context is `{ scheme, locale, lang }`, with an English / `auto` default so leaves render without a provider. `lang` is written to `<html>` in an effect. A `scheme` prop stamps `data-theme` (removed for `auto`) and stores the raw string under `basalt:scheme` in an effect, storage errors swallowed; no prop writes nothing, the boot script owns the first paint. No localStorage read in render, so server and client markup match.
- Fixture: `scripts/fixtures/provider-v3.tsx` imports `src/core/provider` directly (the root `.` still serves the 2.x provider) and renders it with `createRoot`. `provider-v3-base0.tsx` is the same page without the provider.
- Measure (`scripts/check-budgets/provider-v3.ts`, section 6): Vite 8.3.4 production build, minified, peers bundled, `gzipSync` default level over every emitted chunk, `//#region` path comments stripped first (Rolldown keeps them through minification and their path depends on the cwd: the same build gzipped 16 B apart from two directories; the number is now 298 B from four); provider = fixture minus `base0`, built in the same run. React and react-dom 19.3.0.
- Row: measured +5%, rounded up to 0.5 KB (1 KB = 1000 B, as the cap is 5,000 B), at most 5,000. Lives in `areas/provider.ts` as `provider-v3`, with a zero row `provider-v3-banned` beside it. The 2.x `provider-only` row (20,468) stays until the Issue deleting `src/provider` retires it.
- Banned content, checked against every module the build loaded (a transform hook, so tree-shaken modules count): `persisted`, `@base-ui/react/toast`, `core/cn`, `tailwind-merge`, `class-variance-authority`, `core/messages`, `catalog`, `messages/en`, `core/format`; plus an `Intl.*` constructor in the emitted code that `base0` lacks.
- Tests: `src/core/provider.budget.test.ts` (chunk <= row, row <= cap, hard zeros) and `provider.closure.test.ts` (no `persisted`, no Toast; two positive controls build a stub `persisted.ts` and a Toast path in a temp dir and must be found).
- Browser: `run.ts` serves the built fixture in Chrome and reads `lang`, `data-theme` and `localStorage['basalt:scheme']`. `base0` is the control and must show none of them.

## Measurements

Two runs, byte-identical stdout, both exit 0 (`tools/spikes/provider/out/run-1.json`, `run-2.json`).

```json
{
  "providerGzipBytes": 298,
  "rowCeilingBytes": 500,
  "bannedInChunk": [],
  "verdict": "pass",
  "detail": {
    "capBytes": 5000,
    "fixtureGzipBytes": 77032,
    "base0GzipBytes": 76734,
    "chunkCount": 1,
    "withinRow": true,
    "reactVersion": "19.3.0",
    "browser": {
      "ran": true,
      "fixture": { "lang": "de-DE", "dataTheme": "dark", "stored": "dark", "errors": [] },
      "control": { "lang": "en", "dataTheme": null, "stored": null, "errors": [] },
      "held": true,
      "detectorWorks": true
    }
  }
}
```

| Check                                                  | Result                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Provider share, gzip                                   | 298 B (row 500 B, cap 5,000 B)                                              |
| Stub `src/core/persisted.ts` imported into the fixture | `provider.closure` and `provider.budget` red: `persisted: .../persisted.ts` |
| Same stub removed                                      | both green                                                                  |
| `base0` is 76,734 B here; the contract quotes 67.8 KB  | not a gate: `base0` is built in the same run, so React bumps cancel         |

## Verdict

Q1: PASS

Verdict: PASS

By the rule: 298 B is at most 5,000 B. The skeleton leaves 4.70 KB of the cap for what the provider still has to carry. The contract's own estimate for the new context fields was <= 0.6 KB; this skeleton uses about half of that, with no formatter, no catalog and no router.

Caveats. This is a skeleton: the row (500 B) is a ratchet that the provider Issue raises with a named consumer, not a forecast of the final size. The scheme parser and `setScheme` that `src/core/scheme` will own (legacy key, cookie) are not in it; the provider only writes the raw key. `timeZone` and `messages` are not in it either (section 7). The leaf split for scheme was not needed.

## Then

- Provider Issue: grow `src/core/provider.tsx` toward `timeZone`, `messages` and the lazy `createFormat` path; each addition lands against the `provider-v3` row and raises it only through a `raises` entry with a consumer outside argo.
- `src/core/scheme` Issue: when `setScheme` and the shared parser land, the provider calls it instead of its inline `applyScheme`; re-run `bun tools/spikes/provider/run.ts` and keep the closure test green.
- The Issue that deletes `src/provider` retires `PROVIDER_ONLY_CEILING` (20,468) and moves the fixture import from `src/core/provider` to the root entry.
- weatherorb `/map` (Q2) takes the provider at its real size; its 704 KiB bar is proved by that build, not by this row.

## Affects

- `docs/v3/concepts/quality-contract.md` sections 6 and 10, Q1: pass; frozen, unchanged. No Contract amendment request.
- `scripts/check-budgets/areas/provider.ts`: two new rows, `provider-v3` (500) and `provider-v3-banned` (0).
- Gate G1: the provider-only line holds with 4.70 KB of room.
