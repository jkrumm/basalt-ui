# Expression references

For the reviewer and the lead only. A builder that reads this file voids its case.

A reference is the best public answer we know to a case's question. It sets the bar for case fit. It does not set the bar for scales, states, tokens or accessibility, where `rubric.md` asks for more than the reference delivers.

Shots live outside git in the main checkout on the dev host: `.claude/shots/tuffui-ref/<slug>-dark.png`, with `-light` and `-phone` for some. A missing shot is re-taken from `https://tuffui.com/components/<slug>` at 1440x1000.

| Case | Reference slug       |
| ---- | -------------------- |
| c01  | lap-timer            |
| c02  | delivery-heatmap     |
| c03  | tick-gauge           |
| c04  | dot-histogram        |
| c05  | renewal-rings        |
| c06  | context-window-meter |
| c07  | eval-results         |
| c08  | run-trace            |
| c09  | deploy-timeline      |
| c10  | blast-radius         |
| c11  | hex-density          |
| c12  | usage-summary        |
| c13  | diverging-bars       |
| c14  | eval-race            |

The `n` cases have no reference; cycle 1 added n12 (from argo's sleep breakdown) and n13 (from argo's recurring charges) without one, and cycle 2 added n14 (from argo's net-worth page) and n15 (from argo's walking-pad page). Their reviewer scores the rubric alone, and their verdict is left empty.
