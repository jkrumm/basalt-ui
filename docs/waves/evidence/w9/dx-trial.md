# W9 DX trial — a fresh agent with only the shipped layer

**Setup (each run):** `bun create vite <app> --template react-ts`, `bun add <packed basalt-ui tarball from master>`,
`./node_modules/.bin/basalt-ui init`, then a fresh Claude Code agent (Sonnet, `rd wave`, the owner's global
`~/.claude` layer loaded as in any real session) gets one prompt and nothing else:

> Build a dashboard route at /dashboard in this app: a line chart of daily active users over the last 30 days, a
> table of the top 20 accounts (name, plan, MRR, last seen), and an AI chat panel where I can ask questions about the
> data. Use mock data (no backend); the chat uses a mock transport that streams a canned reply. When you are done,
> `bun run build`, `bun run lint:basalt` and `./node_modules/.bin/basalt-ui doctor` must all pass. Do not start a dev
> server.

Wrong turns were read from the session transcript (failed commands, reverted edits, reads of
`node_modules/basalt-ui/dist`), then fixed at the source before the next run.

| Run | Package at | Wall time | Tool calls | `dist` reads | Failed build / tsc errors | Lint errors | Gates at end |
| --- | ---------- | --------- | ---------- | ------------ | ------------------------- | ----------- | ------------ |
| 1   | after #166 | 3 m 13 s  | 40         | ~25          | 1 / 6                     | 0           | green        |
| 2   | after #169 | 1 m 28 s  | 20         | 9            | 1 / 6                     | 1           | green        |
| 3   | after #172 | 1 m 17 s  | 13         | 3            | 0 / 0                     | 1           | green        |

Run 3's one lint error is `basalt/raw-breakpoint` on `cols={{ base: 1, lg: 2 }}`; the message names the
container-query fix and the agent applied it on the next call (the rule doing its job). Its two
`only-export-components` warnings were fixed at the source in #173 after the run.

## Findings and their source fixes

| #   | Wrong turn (run)                                                                                                | Fix at the source                                                               | PR         |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------- |
| 1   | `init` skipped `main.tsx`/`__root.tsx`/`nav.tsx` though the router peers were installed (scaffold)              | router seeds unconditional for an app profile; flags deleted                    | #167       |
| 2   | create-vite's own `.oxlintrc.json` kept → shipped preset off (scaffold)                                         | `init` merges the preset by default, `--no-merge-lint` opts out                 | #167       |
| 3   | stock `main.tsx` kept, `doctor` still "All checks passed" (scaffold)                                            | hard `doctor` check `app-wiring` (entry + router plugin)                        | #167       |
| 4   | `DESIGN.md` snippet `paletteGroups = { 'app-': … }` (1)                                                         | template: `paletteGroups = [series]`                                            | #168       |
| 5   | TanStack Table v8 `sortingFn` (1)                                                                               | batteries rule bullet + checked table snippet                                   | #168, #172 |
| 6   | `exactOptionalPropertyTypes` vs `summary?: string`, `resumeToken?: string` → `summary=''`, omit-destructure (1) | every public optional in `basalt-ui/agent` is `?: T \| undefined`               | #169       |
| 7   | router plugin and `routeTree.gen.ts` undocumented (1)                                                           | `basalt-app` skill step                                                         | #168       |
| 8   | 12 subpath peers found by reading `package.json` (1)                                                            | `llms.txt` emits one `Install: bun add …` line per subpath                      | #168       |
| 9   | chat wiring undocumented → 59-line hand-rolled store after ~13 `dist` reads (1)                                 | checked chat snippet in `basalt-app` (store contract, transport per thread)     | #168       |
| 10  | `AgentTransport` not exported → untyped mock transport, TS2305/TS7006 (2)                                       | `AgentTransport`, `ResumableAgentTransport` exported; TextPart delta JSDoc      | #170       |
| 11  | `tsc -b && vite build` fails before the first `vite build` (TS2307 `./routeTree.gen`) (1, 2)                    | `init` rewrites the stock script to `vite build && tsc -b`                      | #171       |
| 12  | invented `count` prop on `BasaltDataTable` from its `title` JSDoc (2)                                           | JSDoc fixed; table snippet                                                      | #170, #172 |
| 13  | `only-export-components` on every route file (1–3)                                                              | preset `allowExportNames: ['Route']` (#171); seeds/snippet export the component | #171, #173 |
| 14  | notifications/spotlight unstyled unless the consumer imports their layer CSS (pre-trial review)                 | `styles.css` `@import`s every layer bundle the provider mounts                  | #165       |

Every snippet in the shipped skills marked `// @check` is extracted and type-checked against the built package
under the shipped `tsconfig.base` in `bun test` (#168), so a renamed prop fails CI instead of a consumer.

**Not fixed, on purpose:** `ThreadsStore` has 13 required members, so the in-memory store in the `basalt-app` chat
snippet is ~45 lines. A shipped `createMemoryThreadsStore` would be a new export with no named consumer outside the
playground (adopt-or-delete); W11 decides it with argo. The skill snippets grew `basalt-app` from 100 to 217 lines.

**Harness notes:** headless `claude -p` cannot refresh OAuth from a tool shell on the mini, so each run is an
`rd wave` agent in `~/SourceRoot/basalt-dx-trial` with a one-line `docs/waves/PLAN.md`; the scratch app is deleted
after the wave.
