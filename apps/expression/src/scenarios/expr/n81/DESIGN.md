# Study stats (expr-n81)

## The three lines

- Who opens it: a learner between sessions. The question: is practice building up, how sure is the learner across the catalogue, how many reviews are due now. The decision: which review to take first, and which item to practise next.
- The figures that answer: 2 reviews due now (of 3 scheduled), 60 sessions with +18 against the 15 days before, a mean confidence of 2.5 of 5 with none at 5.
- Reads from DESIGN.md: the zinc Identity; no narrowing deviation.

## Surface

- Practice: the answer to "building up". Bars per day for 30 days, the most practised item in the accent against everyone else in an ink step. 25 of the 60 sessions sit on one item, so the stack shows it and the footer says its share. A zone names the last 15 days that the pill compares with the 15 before.
- Confidence: the answer to "how sure". Items per confidence 1 to 5 and none, stacked by status in three ink steps. The 5 bar is a zero with a baseline tick. The unrated stack (23) is capped at 8 with the kit's off-scale caret and keeps its true total.
- Reviews: the answer to "how many due". A day axis a week either side of today, past-due in the status red, not-yet-due in an ink step, a dashed rule at today, ticks on the review days only.
- Items: the 40 items as a table, weakest first, joined to the Confidence chart (`focusItems`: a row holds its confidence level, a bar holds the rows at that level). It is the list the learner acts from.
- Fixtures: default (the case), `?fixture=fresh` (no session, no confidence, no review; every item not started). `?shot-state=empty` draws the fresh library.

## One view (1800x1200, content column)

| part       | question                      | x,y w×h          | joins                                         |
| ---------- | ----------------------------- | ---------------- | --------------------------------------------- |
| Practice   | is practice building up       | 264,72 1004×584  | its own focus (day); no list at the day grain |
| Confidence | how sure across the catalogue | 1280,72 496×584  | focus over the 6 levels; Items rows           |
| Reviews    | how many are due now          | 264,668 496×412  | its own focus (day)                           |
| Items      | which items to act on         | 772,668 1004×412 | Confidence focus (`focusItems`)               |

Table sum: the Items cell is 1004 px wide, over the 800 px at which every column shows, so the 480 px rule for a half-width table does not bind. At 390 the table is phone cards in the panel's own scroll box (Item, Status, Confidence, Practised); Sessions sits in the row's detail. `phone: 'columns'` clipped its third column at 390.

## colour: meaning

- blue: the most practised item (Practice only).
- red: a review past due (Reviews only).
- dark, mid and pale ink: done, learning, not started (Confidence); mid ink: the rest of the sessions and the reviews not yet due.

## Fact count

- First run (before the cuts): `8 item`, `6 items`, `5 confidence`, `4 practised`, `4 last`, `3 [most practised]`, `2 =not_rated`, `2 [last 30]`, `2 [30 days]`.
- Last run: empty.
- Measures and their words: confidence (one word; "set" for a value given, "none" for a missing one), sessions, reviews, items, due ("due now", "Past due", "Not yet due").

## Read aloud (1800 rest frame, top to bottom)

- Window, 30 days | the Practice subtitle only (the axis ticks say the ends)
- Window, last 15 days | the zone caption; the pill names its base "vs the 15 before" (the base, not the window)
- Sessions, 60 | the Practice figure
- Change, +18 | the Practice pill
- Most practised item and its share | the Practice footer (name, 42%); the blue bars and legend entry carry the name once more as the key
- Mean confidence, 2.5 of 5 | the Confidence figure
- Items at each confidence | the bar labels (3, 5, 6, 3, 0, 23); no figure or footer repeats them
- Set 17, graded and none set 4 | the Confidence footer
- Reviews due, 2 | the Reviews figure; the pill says "2 of 3 scheduled"
- Who is due and who is next | the Reviews footer (names); the ticks carry the dates
- Today | the dashed rule and its tick
- Status of an item | the Items status column; the Confidence legend keys the same three words from one map

Greps run on the final source: `dayLabel(` is called by the x ticks and the hover readouts (a stamp, not a rest slot); `STATUS_LABEL` is read by the table column and the three legend entries (one map, two parts: a key and a per-row state); `levelKey(` is the only place the text "None" is written; `noun(` prints the singular or plural inside hover readouts and announcements only.

## Pass criteria

1. The Practice card carries the signed change and names its base.
2. The Confidence card draws the zero at 5 and the capped 23 with its true value.
3. The Reviews card shows the two past-due days in the status red and today as a rule.
4. Loading holds every slot of the ready frame; each source has its own Retry (sessions, items, reviews).
5. Keyboard: each chart is one tab stop and the arrows step its readout; the Items rows step the Confidence focus.

## Kit gaps met

- A `DataPanel` row stretched to its neighbour leaves a band under the table (about 30 px at 1800).
- `CardGrid` has no span: a wide cell is a wrapper with `@wide:col-span-2`, which breaks between a 800 and a 976 px container (one track plus a span of two).
- A `ChartCard` figure cannot hold a sentence of meaning ("of 5 on average" crowds the value at 390), so the word moved to the period slot.
