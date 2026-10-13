# Evidence lane — keyboard

`scripts/evidence/keyboard.ts` (runs inside `make evidence`, between `chat-profile` and `otel`).

On the playground `/charts` route (light scheme, 1280×800) it finds every chart as
`svg[role=img][aria-roledescription=chart]`, switches through each view of the route's view switch, focuses each chart and presses ArrowRight ×3, Home, End, Enter, Escape. After each key it
records the surface's aria-label plus the visible tooltip text and whether that changed.

- Summary rows: one per chart, `PASS`/`FAIL` with `n/7 steps moved`. PASS = focusable and at least
  one ArrowRight moved the cursor; a chart that ignores ArrowRight is a FAIL row, never an exception.
- Artifacts (gitignored): `.evidence/<label>/keyboard.json` and `.evidence/<label>/keyboard/NN-<chart>.png`
  (screenshot of the keyboard-focused state, after End and before Enter).
- `N/A` (non-interactive, V2-SPEC § 9.3/9.10): the host is not `tabindex=0`, or the chart neither moves
  on ArrowRight nor shows a tooltip on hover (Sparkline — the engine still gives it `tabindex=0`, a
  dead tab stop). Not walked-and-failed; counted in its own summary row. A chart that answers the
  pointer but not ArrowRight stays `FAIL`.
- Only ArrowRight is judged; Home/End/Enter/Escape are recorded. Enter does not pin on a fine pointer
  (`pin` is coarse-only in `compile.ts`), so there is no pinned state to capture.
- Views are found in the route's radiogroup; the lane throws if fewer than three exist or a view
  mounts no chart. Failing charts are logged and listed as `FAIL` rows; the lane does not throw.
- Charts are discovered generically; no demo ids are named.
