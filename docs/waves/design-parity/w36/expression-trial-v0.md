# Expression trial v0 (Wave 36)

**Setup:** `bun create vite basalt-expr-trial --template react-ts` outside the repo, `bun add` a tarball packed from
`master` at `1bd2992d` (every Wave 36 procedure PR landed: #374 router and references, #377 reference placement, #379
`shot detect` and the two-pass reviewer, #378 the palette guard), then `./node_modules/.bin/basalt-ui init`. A fresh
Claude Code agent (Sonnet, `rd wave` in the scratch repo, the owner's global `~/.claude` layer loaded as in any real
consumer session) got one prompt and three JSON files. The prompt named no component, no skill, no procedure:

> This app needs one page at /storage-health for our on-call engineer. It must answer three things at a glance: how
> close we are to the storage quota, how the public API has behaved over the last 14 days, and which customers have
> the most open support tickets. The data is mock JSON in data/ … make it look professional. When you are done,
> `bun run build`, `bun run lint:basalt` and `./node_modules/.bin/basalt-ui doctor` must pass. Do not start a dev
> server.

The three datasets are the catalogue shapes the plan names: a ratio against a limit (storage used vs quota, with a
growth rate), a status over time (336 hourly up/degraded/down readings) and a ranked list (open tickets, top 10).
Weatherorb's W45 trial was the template (one prompt, data only, gates at the end).

## Result

| Question                                                                                   | Answer                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Found the procedure?                                                                       | Yes: it invoked `/basalt-design` and read all five references (`concept`, `catalogue`, `stat-tile`, `encoding-rules`, `anti-defaults`)                                                                                            |
| Wrote a concept first?                                                                     | Yes: `docs/design/storage-health.md` in the shipped template (question, decision, datasets table with shape → encoding → export → reason, layout at 1440 and 390, copy, six pass criteria) before any page code, plus a round log |
| Ratio against a limit                                                                      | `Meter` with `segments` (used, then a lighter 30-day forecast) ending at the quota, full width (catalogue: progress to a target / committed vs forecast)                                                                          |
| Status over time                                                                           | `Heatmap` in a `ChartCard`, day × hour, three named states (catalogue: status over time → band strip, a heat grid for dense periodic data)                                                                                        |
| Ranked list                                                                                | `BarList`, default thin rows (catalogue: ranked list, top N)                                                                                                                                                                      |
| Headline numbers                                                                           | `StatGroup variant="strip"`, four cells with qualifiers, and a summary sentence carrying live numbers                                                                                                                             |
| Fallback to a default (number in a box, line chart, plain table)?                          | None                                                                                                                                                                                                                              |
| Rounds                                                                                     | Three shot rounds, the detector on each, the `basalt-design-reviewer` subagent four times (scores 91 → 97)                                                                                                                        |
| Gates                                                                                      | `bun run build`, `lint:basalt`, `doctor` green; committed                                                                                                                                                                         |
| Independent score (lead, a fresh reviewer reading the shipped Assessment-A doc, no source) | Every component and the page pass; score 97; `shot detect` clean (score 100)                                                                                                                                                      |

Boards: `.design-parity/w36/trial-v0/` (local only).

## Friction (ledger rows for the next wave)

| #   | Wrong turn                                                                                                                                                                                                | Source to fix                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 72 reads of `node_modules/basalt-ui/dist/**` and 27 of `llms.txt`; most on `tokens/core.d.ts`, `status-text.d.ts`, `palette.d.ts`: how to colour a categorical status grid (up/degraded/down) with tokens | the catalogue's status-over-time row names no colour recipe for named states; `Heatmap` has no categorical-state mode documented in `llms.txt`     |
| 2   | `init` on a stock Vite app left `main.tsx`, the router plugin, the nav entry and the peers (fonts, Mantine, TanStack) unwired; the agent wired them by hand from `agent/templates/main.tpl` (9 reads)     | same as W9 finding 3: `doctor` flags it (`app-wiring`), `init` still does not seed over a stock `main.tsx`                                         |
| 3   | No `data-shot-states` declared: 136 shots `not declared`; empty, loading and error never rendered or scored                                                                                               | `SKILL.md` step 5 says to declare states but nothing fails without them; the detector or the reviewer should fail a page with zero declared states |
| 4   | P2 from the independent reviewer: heat cells separate up/degraded/down by hue alone (the legend and tooltip carry the words)                                                                              | encoding rule "status colours always icon + label, never colour alone" has no basalt answer for a dense grid                                       |
| 5   | The focus-state tooltip covers the caption under the Meter and the grid; the agent left it as engine-owned                                                                                                | chart/Meter tooltip placement (argo Wave 23 reports the same on `BandStrip`)                                                                       |

**Limitation:** one run, one domain, Sonnet. The owner's global `~/.claude` layer was loaded (it routes basalt vs
`/dataviz` in `rules/frontend-routing.md`), which can bias toward the shipped skill; the AGENTS block now states the
same precedence on its own (#377).
