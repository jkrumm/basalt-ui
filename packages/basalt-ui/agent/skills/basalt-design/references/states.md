# States

The phase vocabulary and the words each phase carries. The shapes are owned by the parts; you own what they say. Docs: [QueryState](node_modules/basalt-ui/docs/query-state.md), [EmptyState](node_modules/basalt-ui/docs/empty-state.md), [Skeleton](node_modules/basalt-ui/docs/skeleton.md).

## The phases

- `ready`: data on screen. `loading`: the first load, drawn as a skeleton in the loaded shape. `stale`: saved data on screen while a refetch runs or has failed, flagged as old. `error`: a failed load with a retry. [type:Phase]
- `empty` is derived from the cause you pass, never set by hand: it cannot exist without a reason. [type:FrameState]
- A frame ([StatCard](node_modules/basalt-ui/docs/stat-card.md), [ChartCard](node_modules/basalt-ui/docs/chart-card.md), [DataTable](node_modules/basalt-ui/docs/data-table.md)) takes the query or a phase and draws every phase at its loaded height. A region without a frame goes inside [QueryState](node_modules/basalt-ui/docs/query-state.md). [type:QueryStateLike]
- Branch precedence is loading, error, empty, data; a failed query reads as a failure, never as an empty list. [type:FrameState]

- A part declares the same slots in every phase (`sub`, `rows`, `delta`, `footer`; every [StatCell](node_modules/basalt-ui/docs/stat-cell.md) of a strip alike), so its skeleton holds the loaded height: a slot that appears only when data does grows the strip 40 px, and a dropped one shrinks a loading frame (one strip lost 56 px and its cards 137 px). The loaded summary is at most as tall as its skeleton at 390, except a sentence-less loading summary, which is one line (a `sentence` passed while loading holds the loaded line count).
- The slot is held and left empty before ready: the page passes the phase and the frame draws the skeleton, while a hand-passed dash, a "partial" pill or a green "-80 pts" on an empty page states a measurement nobody made. A figure, pill, status word or footer value derived from rows is computed in the ready phase only. Every part keeps its place in every phase, a table included: one page's loading dropped the table.

- A loading frame passes every slot the ready frame draws, the footer and status rows included: a loading frame that left the footer row out stood 36 px short of the loaded card, and `footer={ready ? [...] : undefined}` on a chart card and on a chart and a longest-wait card ended 35 px short. The phase gates the values and the slot is always passed: pass the same labels with empty values (`ready ? [{ label: 'Peak', value }, ...] : [{ label: 'Peak', value: '' }, ...]`), or the same pill with a held word (a `Delta` of an empty value, `{ value: '', polarity: 'neutral', label: '' }`, as one page's HELD constant did; another dropped its pills by hand in empty and its table moved up 72 px). Run `rg -nU '(footer|sub|rows|delta|status)=\{\s*[\w.!]+\s+(\?|&&)' <page dir> -g '*.tsx'` once before the loading shot: every hit is a slot that vanishes in loading, and each is changed to a held slot.

- A title or figure reads only from loaded data: one page's loading and error frames printed "Energy per month" and "€1,606 in 12 months" from rows still in flight. The title is a fixed noun, the figure a held slot, and every phase declares the same slots, so the error footer holds its place rather than blanking the contract it already knows.

## What each state says

- Empty: the cause, then the next step. A filter caused it: name the filter and offer its reset. "No decisions are waiting. New ones appear when an agent asks for a verdict."
- Loading: a skeleton in the loaded shape and height; the title row stays put, and every slot of the ready frame is passed, the subtitle included: `subtitle=''` during loading drops the header line and ends the card 16 px short of ready.
- Error: separate sources keep separate `retry` functions, so each source's error frame keeps its own Retry; one shared `retry: noop` draws one Retry for six cards.
- Error: one title, "Could not load <thing>", the cause in one line, one Retry. Three pages shipped an error that named neither its cause nor a retry.
- One reading for an empty page: the first part (the strip or the lead card) says the cause and the one next step in one sentence, and every other part stays quiet (a held-height dash or a short caption that leaves the cause to the first). A part that stands alone, or a page of one part, names its own cause. A part on the kit default ("No rows to show") or on `empty={null}` beside a chart that states its cause fails: a [BarList](node_modules/basalt-ui/docs/bar-list.md) with `empty={null}` drew eight zero rows, and a [DataPanel](node_modules/basalt-ui/docs/data-panel.md) `empty` takes a `cause` that replaces the default for the panel and its table together.
- Check it as a list: write each part's empty sentence beside its part. Exactly one carries the cause and the step; fail a page where two parts carry it (a strip, a list and a chart on one page; five places on another; two cards on a third) and a page where zero parts do, and fail a part that says only "X readings yet" beside a sibling that names its step. State the cause the data can show: one page said "No sites listed yet." where the sites existed (the empty was a night without a forecast) and "No night to show yet." named neither; another page's disk, memory, load and network cards said only "No X readings yet."
- Empty says the next step on one line (one page printed it on three lines; another's named none).
- Stale: the data stays and the line says it is old and when it was fresh.
- A zero fixture keeps its cause and skips the empty pill: a "-" headline beside a pill shape with an empty value, a blank card box with a dotted line and a bare "-" without a cause each read as a fault. The held-pill rule is for loading and empty frames; a ready zero drops the pill or states it. A missing value prints a dash and a caption that names the gap ("No sleep logged since Tue."); a zero reads as a measurement. A day without a report is a gap with a caption, and the rolling total skips it and says so: one report counted its missing 30 Oct as 0, so the team total of US$558 undercounted and the figure flagged nothing.

## Say it once

- Say once what is missing and what to do. The same sentence in every cell of a grid is one sentence too many: put it on the container and let the cells stay quiet.
- One missing source has one wording on every card that depends on it; write it once and pass it to the first part only.
- The sentence is written once and passed to the first part only; "written once, passed to every part" prints it on every part, as two pages did that kept it in the read-aloud as "the shared cause". One empty cause with one next step across the parts of a page: one page's table said "Nothing to list until the report loads", its chart "Export the usage, then reload", and the strip cells left the step out.
- A titled host names the thing itself ("Could not load revenue" from the title); outside a host the title must name it.

## Show every state

- A fixture draws each state at least once: loaded, loading, empty with its cause, filtered empty, error, stale. A shot that skips a state cannot fail it.

not guarded:

- Never "No data", "Something went wrong" or "Oops".
- Never an accent spinner or "Loading…" text inside a card; never a second button on an error.
- Never an empty-state glyph on a failure, and never a red panel for one.
