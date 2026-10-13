# Evidence lane — keyboard

`scripts/evidence/keyboard.ts` (runs inside `make evidence`, between `chat-profile` and `otel`).

On the playground `/charts` route (light scheme, 1280×800) it finds every chart as
`svg[role=img][aria-roledescription=chart]`, switches through each view of the route's segmented
control, focuses each chart and presses ArrowRight ×3, Home, End, Enter, Escape. After each key it
records the surface's aria-label plus the visible tooltip text and whether that changed.

- Summary rows: one per chart, `PASS`/`FAIL` with `n/7 steps moved`. PASS = focusable and at least
  one ArrowRight moved the cursor; a chart that ignores ArrowRight is a FAIL row, never an exception.
- Artifacts (gitignored): `.evidence/<label>/keyboard.json` and `.evidence/<label>/keyboard/NN-<chart>.png`
  (screenshot at the pinned state, right after Enter).
- Charts are discovered generically; no demo ids are named.
