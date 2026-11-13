# States

The phase vocabulary and the words each phase carries. The shapes are owned by the parts; you own what they say. Docs: [QueryState](docs/query-state.md), [EmptyState](docs/empty-state.md), [Skeleton](docs/skeleton.md).

## The phases

- `ready`: data on screen. `loading`: the first load, drawn as a skeleton in the loaded shape. `stale`: saved data on screen while a refetch runs or has failed, flagged as old. `error`: a failed load with a retry. [type:Phase]
- `empty` is derived from the cause you pass, never set by hand: it cannot exist without a reason. [type:FrameState]
- A frame ([StatCard](docs/stat-card.md), [ChartCard](docs/chart-card.md), [DataTable](docs/data-table.md)) takes the query or a phase and draws every phase at its loaded height. A region without a frame goes inside [QueryState](docs/query-state.md). [type:QueryStateLike]
- Branch precedence is loading, error, empty, data; a failed query reads as a failure, never as an empty list. [type:FrameState]

## What each state says

- Empty: the cause, then the next step. A filter caused it: name the filter and offer its reset. "No decisions are waiting. New ones appear when an agent asks for a verdict."
- Loading: a skeleton in the loaded shape and height; the title row stays put.
- Error: one title, "Could not load <thing>", the cause in one line, one Retry.
- Stale: the data stays and the line says it is old and when it was fresh.
- A missing value prints a dash and a caption that names the gap ("No sleep logged since Tue."); a zero reads as a measurement.

## Say it once

- Say once what is missing and what to do. The same sentence in every cell of a grid is one sentence too many: put it on the container and let the cells stay quiet.
- One missing source has one wording on every card that depends on it; write it once and pass it to each.
- A titled host names the thing itself ("Could not load revenue" from the title); outside a host the title must name it.

## Show every state

- A fixture draws each state at least once: loaded, loading, empty with its cause, filtered empty, error, stale. A shot that skips a state cannot fail it.

not guarded:

- Never "No data", "Something went wrong" or "Oops".
- Never an accent spinner or "Loading…" text inside a card; never a second button on an error.
- Never an empty-state glyph on a failure, and never a red panel for one.
