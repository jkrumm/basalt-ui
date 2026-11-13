# Spike: reduced-motion clamp against Base UI exits; contrast `incomplete` sampled (Q5, Q8)

Q5 passes; Q8 is refuted: 259 of 2,207 sampled `incomplete` nodes fail. Harness: `bun tools/spikes/motion-contrast/run.ts` (one JSON object on stdout, exit 0 whatever the verdict). Concept: `docs/v3/concepts/quality-contract.md` section 10, Q5 and Q8. Q8 counts: `docs/v3/evidence/q8-contrast-incomplete.md`.

## Question

Q5: does one global `@media (prefers-reduced-motion: reduce)` clamp stop Base UI dialog, sheet, popover and toast exits from finishing? Refuted when any exit never ends (then per-part `motion-reduce:` classes).
Q8: do the colour-contrast `incomplete` nodes (axe could not compute a ratio) really meet 4.5 / 3.0? Refuted when any sampled node fails.

## Method

- Chrome (channel `chrome`), `playwright-core` 1.63.0, `axe-core` and `@axe-core/playwright` 4.14.0, Base UI 1.9.0, own `package.json` in the spike folder.
- Q5 clamp, a harness constant of 6 lines: `animation-duration` and `transition-duration` of 0.01ms `!important` on `*, *::before, *::after` under `prefers-reduced-motion: reduce`. Context `reducedMotion: 'reduce'`.
- Q5 fixture (`fixture/app.tsx`): two variants of the four parts. `bare` is Base UI with only its own enter/exit transitions, so the clamp alone acts and it decides `q5.byPart`. `shipped` is `src/ui`, which also carries `motion-reduce:transition-none` (reported as `shippedByPart`). Dialog and sheet are closed by Escape and by the close button, popover by Escape, toast by its close button; `byPart` is true only if every path finished.
- An exit is finished when, within 1 s of the close action, `document.getAnimations()` is empty and the popup is out of the DOM.
- Control: the same bare run without reduced motion, retried up to 5 times per path, must show a running exit animation (`controlSeesExit`), or a pass proves nothing.
- Q8: the quality matrix harness (`tests/quality/matrix`) in `full` cells; axe `color-contrast` only, page scan, nodes from `incomplete`. Sampling as written in the evidence file (text made transparent, farthest-luminance pixel). Deviation from the brief: the screenshot is the union of the node's text-node rects, not its whole box, so a large container does not sample a sibling's pixels. Extra `unresolved` cases: visually hidden, animating.
- Two runs, `results/run-1.json` and `results/run-2.json`, byte-identical. The first run pair differed by one skeleton node (`.h-4`, animated pulse at 4.47 vs pass); animating nodes are now `unresolved`.

## Measurements

```json
{
  "q5": {
    "clampLines": 6,
    "byPart": { "dialog": true, "sheet": true, "popover": true, "toast": true },
    "shippedByPart": { "dialog": true, "sheet": true, "popover": true, "toast": true },
    "controlSeesExit": { "dialog": true, "sheet": true, "popover": true, "toast": true },
    "verdict": "PASS"
  },
  "q8": {
    "population": 2221,
    "sampled": 2207,
    "pass": 1948,
    "fail": 259,
    "unresolved": 14,
    "incompleteCeiling": 2333,
    "verdict": "REFUTED"
  },
  "verdict": "REFUTED"
}
```

Exits under the clamp end in 21 to 95 ms; without reduced motion they take 170 to 710 ms. One observation: in the control, a dialog closed with Escape showed no exit animation in 5 of 5 tries: Base UI unmounted it in the first frame. The close-button path animates. Not a clamp issue, and every path under the clamp still finished.

Q8: 259 failures, 127 of them on the legacy `/gallery`. Outside it: 114 chart axis tick labels (`#a7a7aa` on `#fafafd`, 2.30), 4 table heads (2.15), 2 series-colour texts at 4.49, 12 shell nodes whose text colour equals the sampled pixel. Full table in the evidence file. Population is 2,221, below the filed 3,694 (axe `color-contrast` only, page scan, this matrix); the ceiling is 2,333.

## Verdict

Q5: PASS

Q8: REFUTED

Verdict: REFUTED

Q5 holds on the clamp alone, so no per-part `motion-reduce:` classes are needed for exits. Q8 is refuted by the rule (`q8.fail` is 259, not 0): the ceiling on the count does not stand alone and the failing nodes go to their owners.

## Then

- Real clamp in `tailwind.css` (the 6 lines above): safe to add; the parts' own `motion-reduce:transition-none` become redundant and can go.
- Tokens and charts: raise the `--vx-axis` text step and the muted text step to >= 4.5 on the card and page surfaces; lift `--vx-demo-sessions` text above 4.5 in dark. Owners: the tokens and charts Issues.
- Shell: check the rail avatar initials and the account label against the rail surface.
- axe gate: ceiling 2,333 on `color-contrast` `incomplete` for this matrix, plus the nodes above as known findings until fixed; coverage stays "not covered".
- `/gallery` findings go with the legacy barrel.

## Affects

`docs/v3/concepts/quality-contract.md` section 10 (Q5 closes, Q8 reopens with failures), P2 and P15 rows, the `no-motion-without-reduce` row, the axe gate's ceiling, and the tokens, charts and shell Issues named above.
