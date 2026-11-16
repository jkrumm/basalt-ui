# GA checks: master is green except `examples/react`

The evidence for the owner's go on the first 3.0.0 publish ([migration-release section 4.5](../concepts/migration-release.md), steps 1 and 2). Nothing was published, released or dispatched. The page is a record, not a gate: the version gate is untouched.

Recorded on master at `6a028564dd858aab412d118a427d7754b4457bee`, in a clean worktree after `bun install --frozen-lockfile`.

## Checks

| Check                                                                   | Exit | Result                                                                       |
| ----------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `make check` (build, pre, layout, coverage, agent-doc-drift, pack-test) | 0    | `PACK TEST PASSED`; coverage 11 of 11 assertions; agent-doc-drift 0 failures |
| `bun --filter @basalt-ui/playground build`                              | 0    | built in about 1 s                                                           |
| `bun test scripts/release.test.ts`                                      | 0    | 62 pass, 0 fail                                                              |
| `bun test packages/basalt-ui/tests/required-peers.test.ts`              | 0    | 13 pass; the required-peer set is asserted empty                             |
| `rg -n "@mantine" packages/basalt-ui/src`                               | 0    | one hit, see below                                                           |
| `examples/react`: install and build                                     | 1/2  | left out of the green claim, see below                                       |

A first `make check` on the previous master tip failed `check-contract-frozen` on `core/ports.ts` and `table/contract.ts`. That was an artefact: master gained contract-amendment commits while the run was in flight, so the tree sat behind the pin base. After a rebase onto `6a028564` the same gate and the rest of `make check` passed. A branch that is behind master fails that gate by design; the recorded run is on master's tip at the time.

## The `@mantine` hit

`packages/basalt-ui/src/lint/rules/structure/import-boundary.ts:73` holds `'@mantine/hooks': new Set([...])`, a string key in the lint rule's table of banned imports. It is not an import and no package code reaches Mantine; `required-peers.test.ts` and the pack-test's tokens-only install confirm it. The brief's wording ("returns nothing") is therefore not literally met: one match, and it is the ban list that names Mantine so a consumer cannot import it.

## `examples/react`: left out

It is the only directory under `examples/` that declares `basalt-ui` (`"basalt-ui": "workspace:*"`), and it is outside the workspace globs (`packages/*`, `apps/*`). It is pre-v3 and cannot build against the v3 package:

- `bun install` in the directory fails: `basalt-ui@workspace:* failed to resolve` (exit 1).
- With the dependency pointed at a tarball of the current package, `bun install` passes but `bun run build` fails in `tsc -b` (exit 2): 25 errors, none in basalt-ui. They are in the example's own vendored Tremor charts (`Cannot find namespace 'NodeJS'` ×21, three `TS2322`, one `TS2769` from the Recharts types).
- Its stylesheet imports `../../../../packages/basalt-ui/src/index.css`, a file that does not exist in v3 (`src/styles.css` replaced it), so `vite build` would fail next.

No other `examples/*` exists. The example is excluded from the green claim: GA is green on `make check` and the playground; the example is red and stays red until someone ports it or deletes it. Neither is in this Issue's scope.

## For the owner's go

- Evidence for the go: `make check` 0, playground build 0, release gate tests 0, required peers empty.
- Open on the page: `examples/react` is red and left out; the `@mantine` string is a ban-list entry.
- After merge, on a clean master (orchestrator): `GA=1 make release-dry` should print 3.0.0, and without `GA=1` the gate should refuse it. The publish is `GA=1 make release`, the owner's.
