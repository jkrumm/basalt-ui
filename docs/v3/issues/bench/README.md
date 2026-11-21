# Benchmark rows: direction, decisions, reference

The `bench-*` rows in `docs/plan.yaml` build what `docs/v3/BENCHMARK-ACCORDEE-BLUEPRINT.md` found missing. This
page holds what every one of those rows needs. A row's own file under this directory holds the rest.

## Owner direction, 2026-11-21

Quoted from the owner's message of that day (German, as said):

- Shell: "in der App Shell [...] Ränder zur Seitenleiste und nach oben. Und irgendwie mochte ich die nie so richtig."
  And on Accordee: "diese Shell da mit oben den Tabs [...] oben rechts auch noch die Controls [...] ist eigentlich
  tatsächlich wiederum besser als bei uns."
- Tables: "die Tabellen sind halt einfach auch nochmal auf einem ganz anderen Level wie bei uns." On the Notes
  table: "wie schön übersichtlich und stark das ist, erinnert ein bisschen an Notion."
- Record surfaces: "diese Einträge in den Tabellen als Pop-up zu sehen. Das Pop-up ist auch sehr schön [...] Wir haben
  diese ganzen komischen Draw und App und da, was zur Seite reinkommt [...] nicht so ganz auf dem Level wie bei denen
  [...] mit den Controls oben und alles. Es hat einfach alles mehr Platz."
- Forms: "bei uns finde ich auch die Input-Items und auch die Form-Items sind alle auch noch nicht so glatt
  durchgedacht." On Blueprint: "Formgruppen [...] mehrere Controls nebeneinander [...] Button-Groups und Form-Groups
  und Icon-Links, Icon-Rechts. Diese geilen Dropdowns, die so rich sind, wo man dann was suchen kann und filtern kann."
- Scope: "wenn wir jetzt die V3 schon veröffentlichen würden, einfach vom ganzen Design und so her dann langfristig zu
  sehr eingeschränkt." Whiteboards: "over the top, das jetzt schon zu bauen."
- Process, same day, on the benchmark: "it sounds really good", and the leads should build it "without asking for
  annoying specs even though it should be kind of clear".

So no row here waits on the owner. A row's Spec is the lead's plan. Raise a Decision only for something this page and
the row's file leave open and the code cannot answer.

## Decided

Each line is settled. The reason follows the colon.

1. **Two planes.** The frame carries rail and brand. One work surface carries the page. Cards on the surface take a
   hairline and no ground contrast: the owner's shell complaint, and tables can then run edge to edge.
2. **`frame` is `panel` or `flush`.** Panel (inset, rounded, hairline) from the `md` shell tier up, flush below it
   and as an option: Accordee forces its flush layout on phones, and a phone has no room for an inset.
3. **A page is `fill` or padded.** A list, a split page and a canvas fill the surface. A dashboard, a form and a
   settings page keep the gutter.
4. **Basalt's ladder, Accordee's proportions.** Heights, radii and gaps come from basalt's tokens. An Accordee number
   in a row file is the proportion to hit with the nearest token, never a literal to copy.
5. **The palette stays.** Zinc and the `#0077bd` seed, derived as today. Accordee's black primary is theirs.
6. **Overlay names stay; the anatomy becomes one.** `Peek`, `Dock`, `PageAside` and a right `Sheet` share one
   panel anatomy. Renaming seven exports buys nothing the anatomy does not.
7. **No scrim under a non-modal panel.** `AlertDialog` and a phone sheet keep the scrim. `Dialog` takes a light
   wash of the frame colour.
8. **Kill list.** Reversed: column resize, row height as a view property, a user group-by, `Board`. Still cut:
   `DataGrid` and further cell editors, a nested filter builder, multi-sort, export in the table grammar.
9. **Phone keeps the tab bar.** Accordee has a hamburger sheet; ours is better.
10. **Type weights are out of scope** for these rows.

## The reference

Ten reports and about 450 screenshots of the public Accordee demo live outside git, on the host the leads run on:

- `~/.local/state/basalt-accordee/reports/{shell,tables,records,comms,workflows,settings}.md`: measured anatomy per screen.
- `~/.local/state/basalt-accordee/reports/{blueprint,accordee-docs,accordee-library,basalt-inventory}.md`.
- `~/.local/state/basalt-accordee/shots/<cluster>/NN-name.png`. A row file names the few that matter to it.

Rules for using it:

- **Structure, not identity.** Take the planes, the rows, the anatomy and the behaviour. Leave their colours, their
  serif headline, their gradients and their illustrations.
- **Never commit a reference screenshot** or paste one into a PR. The repo is public and the product is someone
  else's. Describe what you matched in words and numbers.
- **Their source is private.** Nothing here was read from it; build from basalt's own parts.
- **Do not copy their weak spots:** all rows rendered with no virtualisation, pop-ups without a URL, Esc that does
  not close a pop-up, three focus styles, 32 and 36 px controls in one form.
- **Acceptance is ours.** A row is done when its own `basalt-ui shot` frames pass the design reviewer and its tests
  pass. The reference is for the lead's eyes while building.
