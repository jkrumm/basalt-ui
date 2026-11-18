# Review: the table

Owner's eye on the rendered table exemplar, [data-table section 9](../concepts/data-table.md#9-proof) (S1, S3, S4). Non-blocking: nothing waits on this page, and a change is a token-table or token edit in a follow-up Issue.

The subject is the playground route `/table` (`apps/playground/src/routes/table.tsx`), rendered from playground fixtures.

## Shots

Taken from a production playground build with `apps/playground/scripts/shots.ts` (the `basalt-ui shot` matrix). The PNGs live outside the repo, in `/tmp/basalt-verdict-table/` on the mini, and are not committed. Reproduce them with:

```sh
bun --filter basalt-ui build && bun --filter @basalt-ui/playground build
bun apps/playground/scripts/shots.ts /table --out /tmp/basalt-verdict-table
```

| Scheme | 1800x1200                                               | 390x844                                               |
| ------ | ------------------------------------------------------- | ----------------------------------------------------- |
| light  | `/tmp/basalt-verdict-table/table--light--1800x1200.png` | `/tmp/basalt-verdict-table/table--light--390x844.png` |
| dark   | `/tmp/basalt-verdict-table/table--dark--1800x1200.png`  | `/tmp/basalt-verdict-table/table--dark--390x844.png`  |

The matrix for one route is four files (two schemes, two viewports); the brief's "eight" counts two routes, as in the StatCard page. Every file for this route is listed above.

## Not built

Resize, reorder, shared views, tree, export. Each is additive and waits for a consumer ([data-table section 1](../concepts/data-table.md#1-decision-summary)).

Built after owner review 1 (2026-11-18, Issue 2282): filters from the column header for every filterable kind, the `range` operator (numeric min and max with an optional slider, date ranges with quick ranges and an injected day picker), a checklist with counts for enum kinds, Any/Yes/No for booleans, and a status column's category order the user rearranges from the header (`rank.<col>`). The demo columns on `/table` carry all of them.

S1 (VoiceOver on explicit roles under CSS projection): no owner result recorded yet. Not run by the lead; it needs a physical iPhone.

## Questions

1. **Phone default.** At 390x844 the table renders as `cards`, with Select mode and the detail sheet (S4). Do the derived cards read as the right default, and is the detail sheet the right place for what the card drops?
2. **Fixed-layout tiers.** At 1800x1200 the kind widths set the layout (S3). Do the column widths and tier steps hold against argo's catalog table (14 columns), or does a `text`/`entity` column need a `content` width option?
3. **Grouping summary and the editor.** Does the grouping summary row match `docs/v3/inspo/x-reference.jpg`, and is the single `c.select` editor enough for in-cell edits?

## Verdict

Accept, accept with changes or reject. Comments go in as signals.

Verdict:
