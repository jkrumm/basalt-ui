# Improvement cycles

A build row proves that its piece works. A cycle proves that the pieces work together for an app author: it builds something real on master's public surface, writes down every place where the work went wrong, and turns what it found into plan rows. One area's cycles repeat until one of them converges.

## Areas

| Area                       | Key                       | Asks                                                                                                                                                |
| -------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| AppShell and page kit      | `v3-cycle-shell-<n>`      | Can an app lay out its pages, navigation, aside and phone chrome without reaching past the kit?                                                     |
| State, stores and controls | `v3-cycle-state-<n>`      | Does each filter, tab, form and live query bind to one store field without glue code?                                                               |
| Lint and guards            | `v3-cycle-lint-<n>`       | Does each rule catch the mistake it names, and stay silent on correct code?                                                                         |
| Wiring and API surface     | `v3-cycle-wiring-<n>`     | Does a fresh app get from `basalt-ui init` to a first page by following only what ships? Is the export surface consistent?                          |
| Dogfood                    | `v3-cycle-dogfood-<n>`    | Can v3 rebuild a slice of the factory console, the reference app, at the console's quality?                                                         |
| Expression                 | `v3-cycle-expression-<n>` | Does an agent with only the shipped skills and kit build a visualization that fits its case on the first try? Own protocol: `docs/v3/EXPRESSION.md` |

## Protocol

1. **Pin.** Record the master sha the cycle ran on.
2. **Build.** Write real consumer code against the published entry points only: `basalt-ui/*` subpaths, never a deep import into `src/`. Visible builds land in the playground, where the owner reviews; prefer the scenario registry to a new route. Fix nothing in the package during a cycle. Where the surface gets in the way, work around it, mark the workaround `// cycle-<area>-<n>: <finding id>`, and log a finding.
3. **Measure.** Each brief names its own numbers. Every cycle counts:
   - escape hatches (`theme-allow`, `as` casts, `eslint`/`oxlint` disables, deep imports);
   - lines of glue code the app wrote that the kit could own.
4. **Shoot.** For a visible build, shoot it at 1800x1200 and 390x844 in light and dark with `apps/playground/scripts/shots.ts`. Shots stay out of git; the findings file names their local paths.
5. **Log.** Write `docs/v3/cycles/<area>-<n>.md`: the sha, the numbers, and one row per finding.

   | Field    | Content                                                                                                                                                       |
   | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | id       | `<area>-<n>.<k>`                                                                                                                                              |
   | class    | `api`, `lint`, `wiring`, `shell`, `state`, `visual` or `docs`                                                                                                 |
   | severity | P1: wrong result, a blocked task, or a workaround every app would repeat. P2: works but costs glue, a cast, or a second read of the docs. P3: naming, polish. |
   | evidence | `file:line` in the build, a shot path, or the command and its output                                                                                          |
   | fix      | The change in one sentence, naming the export or file                                                                                                         |

   The file ends with an empty `owner:` line, which the owner fills in.

6. **File.** Add the fixes to `docs/plan.yaml`, each with a brief in `docs/v3/issues/cycles/`:
   - one row per P1;
   - one row per class for the P2s, if any;
   - P3s ride along with the P2 row of the same class.

   If the cycle has not converged, add the next cycle, `v3-cycle-<area>-<n+1>`, after every fix row, with a brief that copies this one and bumps `n`. If `docs/plan.yaml` passes 60 KiB, collapse done rows to `key` and `issue`, the adopted-row form.

7. **Converge.** A cycle converges at zero P1 and at most three P2. Its file says so, and it adds no next cycle.

A cycle's PR holds only its findings file, its plan rows and briefs, and its playground build. The fixes ship in their own rows, so each one is reviewed against the evidence that asked for it.
