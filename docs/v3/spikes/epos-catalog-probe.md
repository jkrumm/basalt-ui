# Spike: the epos `show` catalog on `defineCatalog` (P6)

Verdict: **fits**. The ten `show` types port onto `defineCatalog` with epos's own zod schemas, its `schema.contract.test.ts` passes byte for byte, a refusal carries the schema's own advice to the model, and no block needs `$state` or an action seam. The json-render escape hatch (`catalog.toJsonRender()`) is not needed. The port is not clean as shipped, though: three engine limits refuse payloads the epos server accepts, and the engine sits four code lines over its target. Each is listed under Findings and none is fixed here (no `src` change in this Issue).

Harness: `EPOS=<epos checkout> bun tools/spikes/epos-catalog-probe/run.ts` (one JSON object on stdout, about a second). Concept: `docs/v3/concepts/ai-mdx.md` section 7, P6. The epos checkout was read, never written: `git status --porcelain` there (empty) hashes the same before and after the run (the harness checks it and exits 1 otherwise), and no epos file is committed here. The harness stages the files it needs into `.scratch/` (gitignored), so the repo holds only the port.

## Question

Does the catalog engine, as `defineBlock` and `defineCatalog` specify it, carry a real server's catalog: ten block types (stat, chart, table, list, board, diagram, callout, ticket, vega, layout) with a Python server that owns the tool, the prompt and `schema.json`? If it needs `$state`, actions, or an error text that cannot carry advice, json-render core goes under `catalog.toJsonRender()`.

## Method

The port is `port/catalog.tsx` (28 lines: ten `defineBlock` over epos's own `tableSpec`, `chartSpec` and the rest, imported from the staged copy, with epos's fixtures as `sample`) and `port/schema.ts` (22 lines: `showSpec` derived from the blocks' `props`, and `parseShowSpec` as `catalog.validate`). Rendering is a marker element per block: the epos components are the G6 migration, so what is measured is the engine contract. Two adapters were needed, both one line: the discriminator, and the vitest import (a shim re-exports `bun:test` so the unchanged test file runs on bun).

Measurements are `port/probe.tsx` (not a gate, it records into `metrics.json`).

## Result

| Check                                                  | Result                                                                                                                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Engine size (`src/ai/catalog/{define,validate,block}`) | 351 lines; 254 without blanks and comments (define 37, validate 116, block 101). Target 250: **4 code lines over**, 101 over by raw count                                                                                                  |
| Port size                                              | 50 lines (catalog 28, schema 22)                                                                                                                                                                                                           |
| `schema.contract.test.ts` unchanged                    | **yes** (sha256 equal to epos's), its 13 tests pass (22 of 22 across both files); it reads `showSpec`, which is `block.props` of the catalog                                                                                               |
| The ten fixtures through `validate`                    | 9 of 10 accepted and equal to epos's own `parseShowSpec` result; `table` refused (finding 3)                                                                                                                                               |
| Each fixture through `catalog.Block`, ready            | 9 drawn; `table` shows the quiet "could not be displayed"                                                                                                                                                                                  |
| `expectCatalog(catalog)`                               | 1 failure: the `table` sample (finding 3); samples, padding and nesting checks otherwise pass                                                                                                                                              |
| Advice to the model                                    | unknown block lists the names; a schema violation names the path; a refine on `layout` (`span 3 is wider than the 2 columns`) arrives verbatim; a custom zod message (`A chart shows at most 4 series: send two charts.`) arrives verbatim |
| Hostile URLs                                           | `//evil.example` in a list `url` and `javascript:` in a ticket `href` refused; `https://` in a board `url` accepted; vega `data.url` (an https URL, so the engine's policy lets it through) refused by epos's own `vegaSpec` rule          |
| `$state` or actions                                    | none needed: pin, comment, locale and the Jira host reach a block by React context and store, read inside `render`; table filters are local state                                                                                          |

## Findings

1. **`limits` cannot reach the server's own ceiling.** `defineBlock` accepts limits only at or below 32 KiB and depth 6. The epos server accepts a spec up to 300,000 bytes (`MAX_SPEC_BYTES`), a table up to 500 rows, a chart up to 200 points. Measured: a table of 20 rows by 6 columns is 5,993 bytes (accepted), 100 rows by 6 columns 29,193 (accepted, a hair under), **500 rows by 3 columns 73,115 refused** ("is 73131 bytes, over its limit of 32768"); a chart of 200 points by 4 series is 10,652 (accepted). Depth: a `layout` of a stat or a chart is exactly 6 (accepted); a `layout` whose table has a `spark` cell is 7 and **refused** ("nests 7 levels"). The ceiling should be raisable per block, to what the server holds, with the default staying 32 KiB.
2. **One URL-named key refuses a whole block for a text cell.** `validate` walks every `href`, `src`, `url` and `link` string at any depth through the url policy, so a table column keyed `url` holding `http://insecure.example/EP-2` refuses the table. Epos draws that one cell as text and keeps the table (its fixture has exactly this row). A plain label under `link` or `src` passes, since only schemes and `//host` are blocked. The refusal is safe and its text is good advice; the cost is that a data column named like a url key is a whole-block failure.
3. **The discriminator is fixed to `block`.** Epos names a block by `type`. The port sends both (`{ ...spec, block: spec.type }`) so the props schema still sees its `type` literal; that is one line, but a catalog that needs it everywhere should take the key as an option.
4. **Dashboard variants are not in the catalog.** Epos picks a wider schema for the same `type` by what the spec holds (`controlledSchema`: coloured chart, thresholds on a stat, `controls` on a chart or table). The ten `show` types are the contract's; the variants are one block name with several schemas, or sibling blocks (`chart`, `chart-controlled`). Not measured here.
5. **A block cannot raise an event.** `render(p, box)` gets `{ height, phase }` and nothing to emit with; only the engine emits (`invalid`, `error`). Epos does not need it (finding above), so this is a note, not a blocker.
6. A message ending in a full stop gets a second one before "Fix these fields" (`...send two charts.. Fix these fields`). Cosmetic.

## Verdict

**fits.** No `$state`, no action seam and no advice gap showed up, so `catalog.toJsonRender()` stays unbuilt. The follow-up is the engine, not the design: raise the `limits` ceiling per block (finding 1), decide whether a url-named data key refuses the block or the cell (finding 2), and take the discriminator as an option (finding 3). Findings 1 and 2 decide whether G6 can delete epos's `heights.ts` and `safeUrl` or only part of them.

## Reproduce

`cd tools/spikes/epos-catalog-probe && bun install && EPOS=<epos checkout> bun run.ts`. It prints the metrics above; exit 1 if the contract test file differs from epos's, a test fails, or the epos status hash moves.
