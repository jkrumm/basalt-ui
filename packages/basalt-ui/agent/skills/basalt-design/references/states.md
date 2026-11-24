# States

The phase vocabulary and the words each phase carries. The shapes are owned by the parts; you own what they say. Docs: [QueryState](node_modules/basalt-ui/docs/query-state.md), [EmptyState](node_modules/basalt-ui/docs/empty-state.md), [Skeleton](node_modules/basalt-ui/docs/skeleton.md).

## The phases

- `ready`: data on screen. `loading`: the first load, drawn as a skeleton in the loaded shape. `stale`: saved data on screen while a refetch runs or has failed, flagged as old. `error`: a failed load with a retry. [type:Phase]
- `empty` is derived from the cause you pass, never set by hand: it cannot exist without a reason. [type:FrameState]
- A frame ([StatCard](node_modules/basalt-ui/docs/stat-card.md), [ChartCard](node_modules/basalt-ui/docs/chart-card.md), [DataTable](node_modules/basalt-ui/docs/data-table.md)) takes the query or a phase and draws every phase at its loaded height. A region without a frame goes inside [QueryState](node_modules/basalt-ui/docs/query-state.md). [type:QueryStateLike]
- Branch precedence is loading, error, empty, data; a failed query reads as a failure, never as an empty list. [type:FrameState]

## Every slot in every phase

- A part declares the same slots in every phase (`sub`, `rows`, `delta`, `footer`, `subtitle`; every [StatCell](node_modules/basalt-ui/docs/stat-cell.md) of a strip alike), so its skeleton holds the loaded height: a slot that appears only with data grows the part when it arrives. Every part keeps its place in every phase, a table included.
- The slot is held and left empty before ready: the page passes the phase and the frame draws the skeleton. A figure, pill, status word or footer value derived from rows is computed in the ready phase only; a hand-passed dash or pill before ready states a measurement nobody made. A title is a fixed noun that holds before the rows arrive.
- The phase gates the values and the slot is always passed: the same footer labels with empty values (`ready ? [{ label: 'Peak', value }] : [{ label: 'Peak', value: '' }]`), the same pill with a held value (`{ value: '', polarity: 'neutral', label: '' }`), the subtitle's fixed words with only the value gated. Run `rg -nU '(footer|sub|rows|delta|status)=\{\s*[\w.!]+\s+(\?|&&)' <page dir> -g '*.tsx'` before the loading shot: every hit is a slot that vanishes in loading.
- With a query, `empty` takes effect only once `data` is an empty array, so it can be passed unconditionally to a part whose doc says so; read the part's doc before gating it.

## What each state says

- Empty: the cause, then the next step, on one line. A filter caused it: name the filter and offer its reset. "No decisions are waiting. New ones appear when an agent asks for a verdict."
- Loading: a skeleton in the loaded shape and height; the title row stays put.
- Error: one title, "Could not load <thing>", the cause in one line, one Retry. A [PageSummary](node_modules/basalt-ui/docs/page-summary.md) takes the error as `phase={{ tag: 'error', message, retry }}`; a bare `{ tag: 'error' }` holds the line empty. Separate sources keep separate `retry` functions, so each error frame keeps its own Retry.
- Stale: the data stays and the line says it is old and when it was fresh.
- A zero fixture keeps its cause and drops the pill; a missing value prints a dash and a caption that names the gap ("No sleep logged since Tue."). A day without a report is a gap with a caption, and a rolling total skips it and says so, so the gap stays visible.

## One reading for an empty page

- The first part (the strip or the lead card) says the cause and the one next step in one sentence, and every other part stays quiet: a held-height dash or a short caption. A part that stands alone names its own cause.
- Exactly one part carries the cause and the step. A part on the kit default ("No rows to show") or on `empty={null}` fails: a [BarList](node_modules/basalt-ui/docs/bar-list.md) with `empty={null}` draws zero rows, and a [DataPanel](node_modules/basalt-ui/docs/data-panel.md) `empty` takes a `cause` that replaces the default for the panel and its table together.
- State the cause the data can show, and give one missing source one wording: write the sentence once and pass it to the first part only. The same sentence in every cell of a grid goes on the container.
- A titled host names the thing itself ("Could not load revenue" from the title); outside a host the text must name it.

## Show every state

- A fixture draws each state at least once: loaded, loading, empty with its cause, filtered empty, error, stale. A shot that skips a state cannot fail it; `shot detect` reports a state the page ignored (`craft-7/states-ignored`).

not guarded:

- Never "No data", "Something went wrong" or "Oops".
- Never an accent spinner or "Loading…" text inside a card; never a second button on an error.
- Never an empty-state glyph on a failure, and never a red panel for one.
