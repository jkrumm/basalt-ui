---
name: basalt-design
description: Design and build a page in a basalt-ui app: a dashboard, list, detail, settings or analysis page, or any card, table or chart on one. Gives the order of work, which reference to read before each kind of part, and the checks that decide when the page is done.
when_to_use: Before writing or restyling any page, card, table or chart in a basalt-ui app, and when a UI looks generic, crowded or inconsistent. Load basalt-charts as well before the first chart.
---

This file is the order of work and a map. The law is `.claude/rules/basalt-*.md` and `./DESIGN.md`; props live in `node_modules/basalt-ui/docs/<name>.md` and the shipped `.d.ts`. Each reference below holds the rules of one kind of part with worked examples: read it before you write that part, because the reviewer scores against it. A whole page starts from the block of its archetype, built from shipped parts with no waiver and no `c.custom`: run `basalt-ui add list-page` for a list page, `add notes-list` for a list of documents that opens as a panel, a window or a page, `add record-page` for a record page, `add settings-page` for a settings page, `add create-flow` for a create flow, `add assistant` for an assistant thread and `add mailbox` for a mailbox (a list of mail beside a reader, a thread and a composer) (`basalt-ui add --list` names every block). The block lands in `src/blocks/<name>/` as your code: wire the ports `add` prints, edit freely, and `sync` merges its upstream changes. A workflow builder copies `apps/playground/src/routes/ref/flow.tsx` in the basalt-ui repo, and a schedule of dated events copies `apps/playground/src/routes/ref/schedule.tsx` there.

## Order of work

1. **Question.** Before code, write three lines: who opens this page, the one question it answers, the figures that answer it. The answer at rest is one hero figure that is the answer, not a count of things ([concept](references/concept.md)).
2. **Surface.** List the parts the answer needs (the mark, the figure, the detail list or table), where each sits and what they share. Parts that show the same items share one focus, and parts that answer one question sit beside each other ([concept](references/concept.md) § Plan the surface).
3. **Form.** Pick each form from the shape of the data with the question-to-form table in the AGENTS block ([encoding](references/encoding.md)). A figure that fits no shipped form is reported to the user, never faked with a hand-built box. Open the doc of every part before you write its props: [stat-card](node_modules/basalt-ui/docs/stat-card.md), [stat-group](node_modules/basalt-ui/docs/stat-group.md), [chart-card](node_modules/basalt-ui/docs/chart-card.md), [cartesian-chart](node_modules/basalt-ui/docs/cartesian-chart.md), [bar-list](node_modules/basalt-ui/docs/bar-list.md), [row-list](node_modules/basalt-ui/docs/row-list.md), [data-table](node_modules/basalt-ui/docs/data-table.md), [section](node_modules/basalt-ui/docs/section.md).
4. **Parts.** Write each part from its reference in the next section. Compose the shipped parts with theme tokens; the rules guard colour, spacing and imports.
5. **States and copy.** Every part takes its phase from the query and keeps every slot in every phase ([states](references/states.md)). Then cut the words until each fact sits in one slot ([copy](references/copy.md)).
6. **Look.** Build, shoot, open every frame, fix at the source and shoot again, until the Done list at the end holds.

## Read before you write

- **A chart, a sparkline, a heat grid or any drawn mark:** load the `basalt-charts` skill for the code, and read [charts](references/charts.md) for the form, the colour budget, the label on the mark, linked parts and honest marks.
- **A card, a figure or a strip of figures:** [cards](references/cards.md): the console anatomy, a base for every figure, what a footer holds.
- **A table or a list of records:** [table](references/table.md): the mode, column kinds and priority, the phone layout.
- **Loading, empty, error and stale:** [states](references/states.md).
- **Any string a viewer reads:** [copy](references/copy.md).
- **A filter, a tab or a range:** [controls](references/controls.md); where its value lives is [state](references/state.md).
- **A form or a settings page:** [forms](references/forms.md).
- **Anything that enters, leaves or moves:** [motion](references/motion.md), never a number.
- **Model output** (chat parts, generated text): [ai](references/ai.md).

## The rules pages break most

1. Every figure stands against a base the data holds, and its delta names that base ("-8 pts vs 33 %"). A delta takes its tint from its polarity where the direction is good or bad for the reader; a change that is neither is `polarity: 'neutral'` ([cards](references/cards.md) § Every figure has a baseline).
2. One fact, one slot. What the figure says is not said again by a subtitle, a pill, an axis title, a legend or a footer ([copy](references/copy.md) § Say each thing once).
3. One focus per page. Every chart, table and list of the same items takes the one `useChartFocus`, and the focused item's numbers go to the figure's period or status ([charts](references/charts.md) § Linked parts).
4. The answer is on the mark. Label the line, bar or zone that answers; a threshold is a drawn zone or reference line, never only a footer ([charts](references/charts.md) § Label and annotate the mark that matters).
5. One accent with one meaning, and one status hue per fact, spent on the state that needs action ([charts](references/charts.md) § Colour budget).
6. A part is sized to what it holds: no empty lower half, no card large for six bars, no table that repeats its chart ([charts](references/charts.md) § One view).
7. At 390 the answering column stays in view and no text is cut ([table](references/table.md) § Phone and the 390 px check, [charts](references/charts.md) § One tab stop, one answer at 390).
8. An empty page has one reading: the first part states the cause and the next step, and the others hold their height with a dash or a short caption, never the kit default ([states](references/states.md) § What each state says).
9. `mono` is for an id or a timestamp, never a sentence. An age or a duration is a meter, and progress against a target is a [Meter](node_modules/basalt-ui/docs/meter.md) with zones ([table](references/table.md) § An age or a duration is a meter).

## Done

A page is done when each of these holds, run and not recalled:

- **Fact count.** The command in [copy](references/copy.md) § Worked: the fact count prints nothing over the page source. A printed item is cut from all but one string, never reworded in code to hide it.
- **Read aloud.** Read the 1800 rest shot part by part, list every rendered string (subtitles and table notes too), and write a `## Read aloud` section in `docs/design/<screen>.md`, one line per fact as `fact | every slot that says it`. It ends with no kept repeat: a fact on two slots is cut in the source, never kept with a reason, and a reason to keep a second slot is not a slot ([copy](references/copy.md) § Worked: the read-aloud pass).
- **One view.** In the same file, one line per part as `part | question it answers | x,y w×h | what it joins`. Fail two parts that answer one question in two rows, a part that joins nothing and a gap as wide as a card; change the surface, not the spacing ([charts](references/charts.md) § One view).
- **Every frame opened.** Rest, loading, empty and error, in light and dark, at 1800 and 390, plus one keyboard frame (`basalt-ui shot <route> --states keys`). A frame not opened is a frame not checked. Run the device checklist and the owner self-check of [anti-defaults](references/anti-defaults.md) against them.
- **Gates.** The typecheck, `basalt-ui lint` and the repo's own gate pass, every figure the ask names is on the page, and every control has a name.
