# Fixture workspace

Synthetic copy of a workspace layout: `.claude` at the workspace root, one app in `apps/dashboard`, no consumer source.

<!-- basalt-ui:begin -->

## basalt-ui

Skills: `basalt-design` (method for building or restyling a page), `shadcn` (shadcn component recipes). No screen before `docs/design/<screen>.md`.
Rules: `.claude/rules/basalt-ui.md`. Review: after a page, run the `reviewer` subagent; with no Agent tool, say "reviewer not run" and hand the shot folder over, never skip silently.

| Question the page answers        | Form                                       |
| -------------------------------- | ------------------------------------------ |
| How is one figure moving?        | TREND-LINE: `LineChart`, one series        |
| How do parts add up?             | PARTS-BAR: stacked `BarChart`, never a pie |
| Which item is largest?           | RANK-BARS: sorted horizontal `BarChart`    |
| What is the exact value per row? | EXACT-TABLE: `Table`, no chart             |
| Is one figure inside its limit?  | LIMIT-METER: `Meter`, not a chart kind     |

<!-- basalt-ui:end -->
