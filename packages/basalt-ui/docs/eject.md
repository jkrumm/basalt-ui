# basalt-ui eject

Generated from `basalt-ui eject --help`; edit `src/cli/eject/help.ts`.

```text
Usage: basalt-ui eject <name> --reason "<why>" [--app <root>] [--raise "<named consumer>"]
       basalt-ui eject --all --reason "<why>" --raise "<named consumer>" [--app <root>]
       basalt-ui eject --adopt <path> --reason "<why>" [--raise "<named consumer>"]
       basalt-ui eject <name> --undo [--app <root>]

Takes ownership of one primitive. The import specifier never changes: basalt() aliases
basalt-ui/ui/<name> to the local file, so npm composites follow it.

eject <name> writes:
  <root>/components/ui/<name>.tsx        the seed, line 1: // basalt:ejected <name>@<version> <why>
  <root>/components/ui/<name>.guard.ts   the guard's requires half, when the seed ships one
  .basalt/base/<root-dashed>/<name>.tsx  the merge base sync three-way-merges against
  .basalt/manifest.json                  ejected["<root>#<name>"] = { path, fromVersion, seedDigest, reason, origin: "seed" }
  <app>/tsconfig.app.json (or tsconfig.json)  compilerOptions.paths "basalt-ui/ui/<name>" -> the local file
seedDigest is the sha256 of the shipped seed plus its guard, read from the installed package.
Seed imports of ./<sibling> become basalt-ui/ui/<sibling> and ../core/cn becomes basalt-ui.

--app <root>      Required when the manifest declares 2+ roots; names one of them.
--raise "<who>"   Appends a raises row to .basalt/budget.json naming the consumer and lifts the
                  ceiling to the new count. The only way eject changes budget.json.
--all             Ejects every shipped primitive not yet ejected in the root. Needs --raise.
--adopt <path>    Takes an existing <root>/components/ui/<name>.tsx. A shipped name present on
                  the merge base (git) gets origin "adopted": base = seed, guard placed, header
                  added, no merge on sync. A shipped name created on this branch is refused (eject
                  it instead). A name basalt does not ship is new local code: it needs --raise and
                  gets origin "local" (no base, no guard, no paths row).
--undo            Reverses one eject. Refuses uncommitted changes. Deletes the file (adopted and
                  local files keep their content, header removed), guard, base, manifest and paths
                  rows. budget.json is left as it is.

Exits 1, writing nothing, when: a flag is unknown; the name is not a shipped primitive or is
already ejected; the target file exists (adopt it instead); a seed imports a package path no
published specifier exports (each one is named); the app's vite.config has no basalt(); the
tsconfig cannot be edited (the line to add is printed); --all has no --raise; --adopt names a
file outside <root>/components/ui, a shipped name not on the merge base, or a new local file
without --raise.
The ejects count per root is printed against .basalt/budget.json (start 3); until 3.0.0 it is
counted, not enforced.
```
