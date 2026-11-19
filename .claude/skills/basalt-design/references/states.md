# States

The phase vocabulary and the words each phase carries. The shapes are owned by the parts; you own what they say. Docs: [QueryState](node_modules/basalt-ui/docs/query-state.md), [EmptyState](node_modules/basalt-ui/docs/empty-state.md), [Skeleton](node_modules/basalt-ui/docs/skeleton.md).

## The phases

- `ready`: data on screen. `loading`: the first load, drawn as a skeleton in the loaded shape. `stale`: saved data on screen while a refetch runs or has failed, flagged as old. `error`: a failed load with a retry. [type:Phase]
- `empty` is derived from the cause you pass, never set by hand: it cannot exist without a reason. [type:FrameState]
- A frame ([StatCard](node_modules/basalt-ui/docs/stat-card.md), [ChartCard](node_modules/basalt-ui/docs/chart-card.md), [DataTable](node_modules/basalt-ui/docs/data-table.md)) takes the query or a phase and draws every phase at its loaded height. A region without a frame goes inside [QueryState](node_modules/basalt-ui/docs/query-state.md). [type:QueryStateLike]
- Branch precedence is loading, error, empty, data; a failed query reads as a failure, never as an empty list. [type:FrameState]

- A part declares the same slots in every phase (`sub`, `rows`, `delta`, `footer`; every [StatCell](node_modules/basalt-ui/docs/stat-cell.md) of a strip alike), so its skeleton holds the loaded height: a slot that appears only when data does grows the strip 40 px (n19 .49), and a dropped one shrinks a loading frame (n16's strip lost 56 px and its cards 137 px). The loaded summary is at most as tall as its skeleton at 390 (n20 .62, n08 .24).
- The slot is held and left empty before ready: the page passes the phase and the frame draws the skeleton, while a hand-passed dash, a "partial" pill or a green "-80 pts" on an empty page states a measurement nobody made (n15 .33, n08 .23, c16 .8, n17 .60, n03 .6, n18 .72, n13). A figure, pill, status word or footer value derived from rows is computed in the ready phase only. Every part keeps its place in every phase, a table included: n10's loading dropped the table.

- A loading frame passes every slot the ready frame draws, the footer and status rows included: n25 left the footer row out of loading and the frame stood 36 px short of the loaded card (n25 .65; n22 .22 charged the same jump), and cycle 11 did it again with `footer={ready ? [...] : undefined}` on n45's chart card and on n47's chart and longest-wait cards, which ended 35 px short (n45 .5, n47 .24). The phase gates the values and the slot is always passed: pass the same labels with empty values (`ready ? [{ label: 'Peak', value }, ...] : [{ label: 'Peak', value: '' }, ...]`, as n44 did), or the same pill with a held word. Run `rg -nU '(footer|sub|rows|delta|status)=\{\s*[\w.!]+\s+(\?|&&)' <page dir> -g '*.tsx'` once before the loading shot: every hit is a slot that vanishes in loading, and each is changed to a held slot.

- A title or figure reads only from loaded data: n28's loading and error frames printed "Energy per month" and "€1,606 in 12 months" from rows still in flight (.18). The title is a fixed noun, the figure a held slot, and every phase declares the same slots, so the error footer holds its place rather than blanking the contract it already knows (n30 .41).

## What each state says

- Empty: the cause, then the next step. A filter caused it: name the filter and offer its reset. "No decisions are waiting. New ones appear when an agent asks for a verdict."
- Loading: a skeleton in the loaded shape and height; the title row stays put, and every slot of the ready frame is passed, the subtitle included: `subtitle=''` during loading drops the header line and ends the card 16 px short of ready (n61 .48).
- Error: one title, "Could not load <thing>", the cause in one line, one Retry. n28, n30 and n32 shipped an error that named neither its cause nor a retry (.18, .41, .57).
- Every part names its own empty cause and next step. A part on the kit default ("No rows to show") or on `empty={null}` beside a chart that states its cause fails: a [BarList](node_modules/basalt-ui/docs/bar-list.md) with `empty={null}` drew eight zero rows (n54 .36), and a [DataPanel](node_modules/basalt-ui/docs/data-panel.md) `empty` takes a `cause` that replaces the default for the panel and its table together (n52 .15, n56 .59).
- Check it as a list: write each part's empty sentence beside its part, and fail any that lacks a cause or a step, or says only "X readings yet" beside a sibling that names its step. State the cause the data can show: n57 said "No sites listed yet." where the sites existed (the empty was a night without a forecast) and "No night to show yet." named neither; n59's disk, memory, load and network cards said only "No X readings yet." (n57 .4, n59 .28).
- Empty says the next step on one line (n32 printed it on three, .57; n30's named none, .41).
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
