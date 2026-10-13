# W2 evidence — harness core

`make evidence LABEL=<label> [DIST=<dir>] [ROUTES=<file>]` runs `scripts/evidence/index.ts`. It builds
the package, then the playground (`vite build --manifest`), unless `DIST` points at a built app.
It serves that dist on an ephemeral `127.0.0.1` port (SPA fallback, gzip on request, like nginx),
runs the lanes in the fixed `LANES` order, and writes:

- `.evidence/<label>/<lane>.json` — gitignored, sorted keys, full detail.
- `docs/waves/evidence/w2/<label>.md` — committed, no timestamps, `|-|-|-|` tables, one section per lane.

A lane is `scripts/evidence/<name>.ts` exporting a `Lane` (`types.ts`). A missing file renders as
`lane absent`; a throwing lane renders as `lane failed: …` and fails the run after everything else is
written. Every Chrome a lane opens through `openBrowser` is killed when that lane ends
(`launchServer` + `kill()`, as in the layout harness — graceful `close()` hangs on this host). The
static server dies with the process; no dev server is started.

## Lanes owned here

| Lane       | Measures                                                                                                                                                                                                    | Determinism                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| bundle     | gzip (level 9) per published subpath: sum over the static relative-import closure of `dist`. Per playground route chunk: own bytes, and bytes beyond the initial load (from the vite manifest). App totals. | Byte-exact for a given build                      |
| screens    | PNG per route × light/dark × desktop 1280×800 / mobile 390×844 (touch), DPR 1, reduced motion, to `.evidence/<label>/screens/`. The md lists counts only.                                                   | Fixed viewports; pixels are not hashed            |
| lighthouse | Performance score, LCP, TBT, CLS for `/`, `/charts`, `/data`, mobile and desktop presets, median of N runs (`EVIDENCE_LH_RUNS`, default 3; N is in the md).                                                 | Simulated throttling; still varies with host load |

## Measuring another app (argo)

`DIST` skips the build, so build the app yourself first. `ROUTES` is a file with one path per line
(`#` comments allowed); it replaces the playground route list for `screens` and supplies the first
three paths for `lighthouse`. The bundle lane still reports the package subpaths from
`packages/basalt-ui/dist` (skipped with a note if that is not built) and, if the dist has
`.vite/manifest.json`, per-route chunks keyed by `routes/<file>` entries. Without a manifest it
reports app totals only.

## Notes

- Lighthouse runs in its own headless Chrome through `chrome-launcher` (same installed Google
  Chrome): it needs a raw CDP port, which Playwright's server does not expose.
- `screens` pre-seeds Mantine's `mantine-color-scheme-value` in localStorage, so a consumer that
  stores the scheme elsewhere will screenshot its default scheme twice.
- `LABEL=dev` is a smoke label: its md is not committed. A baseline label is committed with the
  numbers it was measured at.
