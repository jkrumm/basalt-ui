---
name: basalt-design
description: Design and build a page in a basalt-ui app: a dashboard, list, detail, settings or analysis page, or any card, table or chart on one. Gives the order of work, which reference to read before each kind of part, and the checks that decide when the page is done.
when_to_use: Before writing or restyling any page, card, table or chart in a basalt-ui app, and when a UI looks generic, crowded or inconsistent. Load basalt-charts as well before the first chart.
---

This file is the order of work and a map. The law is `.claude/rules/basalt-*.md` and `./DESIGN.md`; props live in `node_modules/basalt-ui/docs/<name>.md` and the shipped `.d.ts`. Each reference below holds the rules of one kind of part: read it before you write that part, because the reviewer scores against it. A whole page starts from the block of its archetype, built from shipped parts with no waiver and no `c.custom`: `basalt-ui add list-page`, `notes-list` (documents that open as a panel, a window or a page), `record-page`, `settings-page`, `create-flow` (a wizard dialog), `assistant` (a model thread) or `mailbox` (`basalt-ui add --list` names every block). The block lands in `src/blocks/<name>/` as your code: wire the ports `add` prints, edit freely, and `sync` merges its upstream changes. Every other shipped part (a record panel, a dock, a schedule, a workflow canvas, a wizard) is one line in [parts](references/parts.md), grouped by the question it answers.

## Order of work

1. **Question.** Before code, write three lines: who opens this page, the one question it answers, the figures that answer it. The answer at rest is one hero figure that is the answer, not a count of things ([concept](references/concept.md)).
2. **Surface.** List the parts the answer needs (the mark, the figure, the detail list or table), where each sits and what they share. Parts that show the same items share one focus, and parts that answer one question sit beside each other ([concept](references/concept.md) § Plan the surface).
3. **Form.** Read [parts](references/parts.md), then pick each form from the shape of the data with the question-to-form table in the AGENTS block ([encoding](references/encoding.md)). A figure that fits no shipped form is reported to the user, never faked with a hand-built box. Open the doc of every part before you write its props.
4. **Parts.** Write each part from its reference in the next section. Compose the shipped parts with theme tokens; the rules guard colour, spacing and imports.
5. **States and copy.** Every part takes its phase from the query and keeps every slot in every phase ([states](references/states.md)). Then cut the words until each fact sits in one slot ([copy](references/copy.md)).
6. **Look.** Build, run `basalt-ui shot <route>` (it drives Playwright from your project: install `playwright` first), open every frame, fix at the source and shoot again, until the Done list holds.

## Read before you write

- **A chart, a sparkline, a heat grid or any drawn mark:** load the `basalt-charts` skill for the code, and read the branch of [charts](references/charts.md) the chart needs: form, colour, labels, view or honest marks.
- **A list, a table or a second chart of the same items:** [linked-parts](../basalt-charts/references/linked-parts.md).
- **A card, a figure or a strip of figures:** [cards](references/cards.md): the console anatomy, a base for every figure, what a footer holds.
- **A table or a list of records:** [table](references/table.md): the mode, column kinds and priority, the phone layout.
- **Loading, empty, error and stale:** [states](references/states.md).
- **Any string a viewer reads:** [copy](references/copy.md).
- **A filter, a tab or a range:** [controls](references/controls.md); where its value lives is [state](references/state.md).
- **A form, a wizard or a settings page:** [forms](references/forms.md).
- **Anything that enters, leaves or moves:** [motion](references/motion.md), never a number; **model output** (chat parts, generated text): [ai](references/ai.md).

## The rules pages break most

1. Every figure stands against a base the data holds, and its delta names that base ("-8 pts vs 33 %"), tinted by its polarity or `polarity: 'neutral'` ([cards](references/cards.md) § Every figure has a baseline).
2. One fact, one slot: what the figure says is not said again by a subtitle, a pill, an axis title, a legend or a footer ([copy](references/copy.md) § Say each thing once).
3. One focus per page: every chart, table and list of the same items takes the one `useChartFocus`, and the focused item's numbers go to the figure's period or status ([linked-parts](../basalt-charts/references/linked-parts.md)).
4. The answer is on the mark: label the line, bar or zone that answers; a threshold is a drawn zone or reference line, never only a footer ([chart-labels](references/chart-labels.md)).
5. One accent with one meaning, and one status hue per fact, spent on the state that needs action ([chart-color](references/chart-color.md)).
6. A part is sized to what it holds: no empty lower half, no card large for six bars, no table that repeats its chart ([chart-view](references/chart-view.md)).
7. At 390 the answering column stays in view and no text is cut ([table](references/table.md) § Phone and the 390 px check, [chart-view](references/chart-view.md) § At 390).
8. An empty page has one reading: the first part states the cause and the next step, the others hold their height with a dash or a short caption ([states](references/states.md) § One reading for an empty page).
9. `mono` is for an id or a timestamp, never a sentence. An age or a duration is a meter, and progress against a target is a [Meter](node_modules/basalt-ui/docs/meter.md) with zones ([table](references/table.md) § Measures in a column).

## Done

A page is done when each of these holds, run and not recalled. A small change (one part, no new data) runs the gates and the frames it touches; a new or restyled page runs all of it.

- **Gates.** The typecheck, `basalt-ui lint` and the repo's own gate pass, every figure the ask names is on the page, and every control has a name.
- **Words.** `basalt-ui shot detect --facts <page dir>` reports no `communication-5` finding, and reading the 1800 rest shot aloud finds no fact in two slots ([copy](references/copy.md) § The fact count).
- **Every frame opened.** Rest, loading, empty and error, in light and dark, at 1800 and 390, plus one keyboard frame (`basalt-ui shot <route> --states keys`). Run the self-check and the device checklist of [anti-defaults](references/anti-defaults.md) against them, and `basalt-ui shot detect` on the out dir.
- **Review.** The `basalt-design-reviewer` subagent scores the out dir; fix every P1 it reports and shoot again. Without it, hand its file (`.claude/agents/basalt-design-reviewer.md`) to a general agent that did not write the page, or say "reviewer not run".
