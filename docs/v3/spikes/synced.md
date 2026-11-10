# Spike: createSyncedState against two sync flows (S1)

One core with an injected transport serves both flows. Argo gym passes 7 of 7 cases and epos settings 5 of 5, and the baseline core written for argo needed no edit for epos, so `createSyncedState` ships as a symbol. Two findings change the concept text, not the decision: epos has no server-side per-field stamp, and the core's per-field guard is what carries the epos case.

Harness: `bun tools/spikes/synced/run.ts` (one JSON object on stdout, always exit 0). Concept: `docs/v3/concepts/state-persistence-forms.md` section 9, S1; DPO 13 in `docs/v3/ARCHITECTURE.md` section 12.

## Question

Do two divergent sync protocols share one `createSyncedState` core, with each flow supplying only a transport?

- Argo gym: the server row is null until a client seeds it, whole-state GET and PUT, 5 s poll, server `updated_at`, last write wins, no 409.
- Epos settings: four per-field keys (`theme`, `send_key`, `level`, `density`), GET returns the fields, PUT sends only the changed fields, no rev in any response, no poll, reload on owner change only. The file's `changedAt` is a counter.

Refuted if either flow needs a core change beyond widening `load` or `save`. Then the symbol ships as a recipe and the copy count stays 3 recipes.

## Method

- **Core.** `core.ts`, 237 lines, no React and no Query. Written from the "Behaviour of `createSyncedState`" list in section 6: serial debounced writer, null-server seed once per runtime, poll that skips while a save is pending or in flight, per-field adoption of a load, `storage` event that updates memory only, owner switch that drops everything in flight. Scheduler, storage and transport are injected.
- **Transports.** `flows/argo-gym.ts` (30 lines) and `flows/epos-settings.ts` (41 lines). Paraphrased and synthetic: paths are `/gym` and `/settings`, the gym state is four invented fields, epos contributes only its four key names. The fake servers live in `run.ts`.
- **Browser.** Chrome through playwright-core, one fresh context per scenario, virtual scheduler per page. Two pages in one context are the two tabs, so the `storage` event is the real one. Requests cross to a Node fake server that can park a request (`hold`) and write as another device (`remoteWrite`).
- **Cases, fixed before the first run.** Argo 7: `null-seed`, `poll-pauses-while-saving`, `serial-order`, `lww-rev`, `remote-ignored-while-editing`, `no-echo-two-tabs`, `owner-switch-isolates`. Epos 5: `serial-order`, `per-field-changedAt`, `remote-ignored-while-editing`, `no-echo-two-tabs`, `owner-switch-isolates`. Not applicable to epos: null seed (GET always answers the fields), poll (none), `lww-rev` (no rev). Not applicable to argo: per-field stamps.
- **Core-change ledger.** `core.ts` was iterated until the argo cases passed, then frozen as `core.v0.ts`. Epos ran on `core.v0.ts` first (`eposOnV0`), and any later edit would be a `coreChanges` entry: `widening` only if it adds an optional field to `load` or `save` and argo still passes unchanged, else `core`. The argo suite runs on both cores.
- **Mutation check.** Reducing the busy rule to pending and in-flight fields only (no touch counter, no settle window) fails `lww-rev` and `remote-ignored-while-editing` on argo, `per-field-changedAt` and `remote-ignored-while-editing` on epos, and flips `decision` to `recipe`. The cases measure those rules.
- **Scope.** Hide-flush, the 64 KiB body, backoff, 409 rebase, UI and the epos `frame` flow are out. 409 rebase is also not applicable to either flow: neither server answers 409.

## Measurements

Two runs, byte-identical output (`cmp` clean, sha256 `65054305cb0d…d9b3f`, `coreMatchesV0: true`).

| Result                            | Value               |
| --------------------------------- | ------------------- |
| `argoGym`                         | 7 of 7              |
| `eposSettings`                    | 5 of 5              |
| `eposOnV0` (before any core edit) | 5 of 5, failed `[]` |
| `argoOnV0`, `argoOnFinal`         | 7 of 7 each         |
| `coreChanges`                     | `[]`                |
| `decision`                        | `symbol`            |

Evidence per case (from the JSON):

| Flow | Case                     | Evidence                                                                                                                                                               |
| ---- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| argo | null-seed                | 1 PUT with body equal to the mirror, rev equals that `updated_at`; non-null server: 0 PUT                                                                              |
| argo | poll-pauses-while-saving | GETs 2 while a PUT is held 15000 ms, 3 five seconds after release, none inside the debounce window                                                                     |
| argo | lww-rev                  | revs `.002` < `.003` < `.004`; stale-base save accepted, server equals local; after settle the remote `.005` is adopted                                                |
| argo | no-echo-two-tabs         | B storage events 1, B mirror `setItem` 0, PUTs 1, A storage events 0                                                                                                   |
| epos | per-field-changedAt      | read in flight; theme adopted from the other device, density kept (`compact`); PUT keys `["density"]`; a stale snapshot landing after 3000 ms leaves density `compact` |
| epos | serial-order             | maxInFlight 1, one request parked, PUT#2 body `{"send_key":"mod-enter","density":"compact"}`                                                                           |
| epos | no-echo-two-tabs         | same as argo: B 1 event, 0 mirror writes, PUTs 1                                                                                                                       |

What each transport had to supply beyond a fetch:

- Argo: the null row maps to `value: null` and `updated_at` to `rev`; `save` merges the patch into the base and PUTs whole. Nothing else.
- Epos: `rev` is always `null` on load, and `save` synthesises its whole result, `{ value: {...base, ...patch}, rev: String(++counter) }`, because the PUT answers `{}`. The counter has no meaning to any server. The cases pass with it, and the core only stores the string.

## Verdict

Evidence line that decided it (`forcedBy`, the closest call; no case failed):

> serial-order (closest call, 2 synthesised saves): maxInFlight(PUT) 1, parked 1, PUTs 2, PUT#2 body {"send_key":"mod-enter","density":"compact"}, server==local true

Epos is the closer flow because both of its saves return a result the transport made up. Everything else it needs was already in the core.

Decision: symbol

Three reservations the decision rule does not capture:

1. **By construction, in part.** The core was written from the concept's behaviour list, which already says "silent per field unless that field is edited". So S1 shows that this spec serves both flows, not that an independent core would. The per-field guard that makes epos pass lives in the core and is exercised by argo too (`lww-rev`).
2. **The concept's epos claim is wrong.** Section 10 says epos needs no server work because "per-field `rev` stamps already exist (`changedAt`)". In the settings file `changedAt` is a client-side counter that stops an in-flight read from undoing a newer local edit. It is not sent and not stamped by a server. The transport cannot stamp `rev` per field, because there is nothing to read. The core does that job.
3. **No case edits in two tabs one after the other.** The no-echo case has one writer. The hazard that leaves is a core defect common to both flows, listed under Then.

## Then

`createSyncedState` is not blocked. Issue 3 builds the production symbol, with the findings below folded into its contract suite.

- **Write down what epos means by rev.** `rev: string` is required of `save`, but an unversioned server has none. Either the contract says "transport may return any monotonic string, the core only stores it", or `save` makes `rev` optional, which is a widening (an optional field on `save`'s result) and argo passes unchanged.
- **Base when the first load has not landed (found by reading, no case).** The core passes `remote` as `base`, which is null before the first load. Both transports then fall back to `initial`, so an edit made before the first load would PUT initial defaults over the rest of an argo row. The original `useGyms` uses `fetched ?? mirror`. The production core should pass the resolved value as `base.value` when `remote` is null. Not forced by any listed case.
- **A slow load can regress `rev` (found by reading, no case).** A load that began before a save and lands after it replaces `remote.value` and `rev` with the older snapshot. Local value and mirror stay correct.
- **A cross-tab edit is reverted by the next save in the other tab (found in review, no case).** `onStorage` updates the local value but not `remote`, and the transport builds a save result from `base` (`remote`). Tab A sets `theme`, tab B shows it through the `storage` event, then B sets `density`: B's save returns `{...remote.value, density}` with the old `theme`, the core adopts that over the local value, rewrites the mirror, and A shows the old `theme` again while the server holds the new one. Epos has no poll to recover; argo recovers on the next 5 s poll, but its whole-state PUT built from the stale base has already overwritten the other tab's field on the server. This hits both flows equally, so it is a core defect and not a divergence between the protocols. The cases never edit in two tabs one after the other. Issue 3's suite needs a two-tab edit-then-edit case; the fix is to reconcile `base` and the save result with the current local value, and to update `remote` in `onStorage`.
- **Unsent edits are dropped on an owner switch**, by the spec, along with the old runtime.
- **Epos behaviours outside the case list**, all app-side or widenings, none run: an extra GET field outside the four keys has no slot in `load`'s result, an optional `meta` on `load` would be a widening; the server-or-browser-only mode (no route, offline, guest) has no `status`; the one-time carry of a local theme to the server is a per-field conditional seed; a failed save puts the values back and toasts, whereas the core keeps the pending patch and sets `status: 'error'`.
- **Size.** The core came to 237 lines against a 200-line target, with the transports at 30 and 41. Per-flow code is 71 lines in total. Every file starts with a `fallow-ignore-file` line, which the fallow gate asks for on a throwaway harness (unused files, complexity, the frozen copy of the core).
- **Ledger note.** Two lint errors forced a behaviour-neutral edit to `core.ts` after `core.v0.ts` was frozen (`!= null` to `!== null`, and `send()` from `.then` to async/await); both files carry it and are identical. The epos run on the baseline was recorded before that edit, and the current harness re-runs it on the edited `core.v0.ts` with the same 5 of 5.

## Affects

Owned by other Issues. This spike names the changes and makes none.

- `docs/v3/concepts/state-persistence-forms.md`: section 9 S1 row (passes, `symbol`); section 6, `createSyncedState` (`rev` for unversioned servers, `base` before the first load); section 10 migration row for epos `settings` (the "per-field rev stamps already exist" claim); section 11.
- `docs/v3/ARCHITECTURE.md` section 12, DPO 13: `createSyncedState` ships in `./data`, the recipe alternative is not taken.
- Issue 3 (`createSyncedState` plus its contract suite): unblocked, with the base-before-load and rev-regression cases added to the suite.
