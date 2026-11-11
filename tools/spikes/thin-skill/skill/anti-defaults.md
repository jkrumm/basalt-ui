# Anti-defaults

The tells that make a generated page read as a default. Check each before round 1 and at every round.

## Five defects earlier builds shipped with

- **Clipped at 390.** A table wider than the phone with no scroll container, a fixed `h-*` or `w-*` on a card or panel, `overflow-hidden` on something that holds text. Give wide tables an `overflow-x-auto` wrapper with the table at its natural width; let cards take their natural height.
- **Nameless controls.** An icon-only button with no `aria-label`; an input with no `FieldLabel` and no `aria-label`. Every control has a name a screen reader can say.
- **Restated figures.** The same number in the summary line, a card and a table cell. Each figure appears once per page.
- **A generic title.** "Overview", "Dashboard", "Settings" alone. Name the subject and its scope; the summary line carries a live number.
- **Colour on its own.** A status shown by hue only. Status is a word plus its tone (`Lozenge`, or `StatCard` `status`), delta polarity is data, never a colour class you pick.

## Dashboard tells

| Tell                                                            | Do instead                                                                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Equal cards in a uniform grid with nothing under them           | Figures first, then the table or chart that explains them                                                      |
| A card wrapped around a `StatCard`                              | `StatCard` is already the card; place it directly in the grid                                                  |
| A coloured left edge or a hand-made badge for status            | `StatCard` `status`, `Lozenge` `tone`                                                                          |
| A delta with no period                                          | `delta.label` ("vs last week") and the right `polarity`: `up-bad` when a rise is bad                           |
| Raw numbers formatted by hand (`"1,208"` in JSX)                | Pass `value` as a number and let the part format it                                                            |
| A hand-built input, select or table                             | `Input`, `Field`, `Table`: reach for the part before the element                                               |
| A palette class (`bg-blue-500`, `text-gray-600`) or `bg-[#fff]` | The semantic utility: `bg-card`, `bg-inset`, `text-muted-foreground`, `text-good`, `text-bad`, `border-border` |
| Fixed pixel widths for fields                                   | `w-full max-w-*` from the container scale (`max-w-regular` is 30 rem)                                          |
