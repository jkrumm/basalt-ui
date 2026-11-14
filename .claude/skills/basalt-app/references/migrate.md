# Migrate a 2.x app to 3.x

Procedure for moving an app that imports basalt-ui 2.x (Mantine) to 3.x (shadcn, Base UI, Tailwind 4). Pick the shape first; the `migrate` verb then keeps the list of what is left. The law stays in `.claude/rules/basalt-*.md`; each prohibition below carries its guard tag, and what nothing guards sits under `not guarded:`.

## The four shapes

Choose by how many files import basalt and whether the old app must stay deployable and fixable while the new one is built.

| Shape                             | Fits                                                                             | How                                                                                                                                                      | Cost                                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| In-place PR                       | An app with no JS from basalt: static pages, tokens only                         | Swap the token and CSS files; `tokens:css` and `fonts:css` replace the 2.x sheets                                                                        | None at runtime; one small PR                                                                                          |
| One-PR cutover on a branch        | An app with roughly 6 to 27 basalt importers                                     | The codemod commit first, then manual commits that clear its worklist, one merge                                                                         | The PR is larger than the usual size limit by design; baselines regenerate in it; two runtimes never ship              |
| Sibling app on the default branch | An app with about 100 or more importers, or one that must stay fixable meanwhile | `apps/<app>-v3` beside the old app, each with its own `basalt-ui` install, manifest and bin; routes move one Issue at a time; the old app stays deployed | Two installs and two gates until cutover; the cutover Issue deletes the old app and renames the new one                |
| In-document coexistence           | Nobody by default; refused unless every condition below holds                    | Both layers render in one document                                                                                                                       | About 27 KB more JS, one Escape closes two layers, `aria-hidden` over the other layer's portals, no shared query cache |

In-document is refused unless all six are in place before the first page moves: a layer statement in the app's `AGENTS.md`, one router and one `QueryClient` owned by 2.x, a scheme bridge so both layers read one stored scheme, one z-index scale, a scoped input floor, and an `npm:` alias for the second basalt-ui copy. A reason that fits none of the six is a reason to pick another shape.

In a sibling app, import nothing from the old app into the new one; the new app's preset holds the boundary at the import line. The old app reads the scheme it always read; the new one reads the same key, and the cutover PR is where the boot script changes.

## The workflow

1. `./node_modules/.bin/basalt-ui migrate --from <version> --profile <profile>` prints the rows this app needs, selected by its own imports, and what changes for each. Add `--json` for the machine report (`schema: 1`: `rows`, `tokens`, `storage`, `urls`, `attrs`, `rules`, `unmapped`, `failures`). It reads the tree and never writes.
2. Work the report in this order: specifier moves first (they cascade into every later error), wiring, removed exports, then components, charts and tables, one file at a time.
3. `./node_modules/.bin/basalt-ui migrate --from <version> --profile <profile> --check` exits 1 while a removed symbol is still imported, a legacy `[data-mantine-color-scheme]` selector remains, or a legacy storage or URL key has no row. Run it before every push.
4. `./node_modules/.bin/basalt-ui doctor --from <version>` prints the consumer-visible `MIGRATING.md` changes since that version; read it once per bump.
5. Run `sync`, `doctor` and the repo gate; the preset retires 2.x rule ids, so a leftover `theme-allow` waiver becomes `// oxlint-disable-next-line basalt/<id> -- <why>`.

## What compiles clean and behaves differently

- `valueShifts`: a token whose value moved on purpose (line heights close to the scale: 12, 13, 15, 16 and 18 px keep their size and lose the 1.55 ratio). It is a density change, not a defect; the baseline commit names each image and its row.
- Size names collide: 2.x `md` is 15 px and `lg` is 16 px, while 3.x `base` is 16 px and `md` is 15 px. Map by pixels, not by name.
- Breakpoint names: `sm:` and `lg:` emit no class under the 3.x reset. Key layout on the container (`@narrow:`, `@regular:`, `@wide:`).
- Storage and URL rows: a `storage` row names the legacy key and what reads it (`read-legacy` keeps an old value alive); a key with no row fails `--check`. Migrate the key in the cutover PR itself.
- Margin and padding in app code become `Inset`, `Section` and `Card` slots, because the app-spacing rule denies a margin outside a primitive.

## The codemod report is a worklist

The codemod rewrites imports, renames, the layout primitives (`Stack`, `Group`, `Flex`, `Center`, `Box`, `Text`, `SimpleGrid`) and the scheme selector, and lists every site it cannot decide: style props on a composite, a component tag with no mapping, a chart, a table. Each listed site ends in one of two states: fixed in a manual commit, or carrying a waiver with a reason under the per-rule ceiling. An unresolved site is a red PR, because the tool that produced a change cannot excuse its own output.

- A codemod report is a worklist, never an exemption: a site it flags is resolved or waived with a reason; it is never left, and the report is never committed as proof. [lint:waiver-needs-reason]

not guarded:

- Choose the shape before the first edit; a cutover that starts as imports-only edits ends as a sibling app by accident.
- Regenerate each visual baseline once, in the cutover PR, with the commit body naming every image and its `valueShifts` reason.
- Charts, tables and shell wiring are written by hand against the generated docs; the codemod does not map them.
