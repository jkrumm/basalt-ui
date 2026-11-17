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
| c15  | inbox-cleanup        |
| c16  | model-picker         |

The `n` cases have no reference; cycle 1 added n12 (from argo's sleep breakdown) and n13 (from argo's recurring charges) without one, cycle 2 added n14 (from argo's net-worth page) and n15 (from argo's walking-pad page), and cycle 3 added n16 (from argo's body-composition page). Cycle 3 also added c15 from TuffUI's Inbox Cleanup, published at `589cbb0` on 2026-11-13, after the benchmark read; its shot was taken on 2026-11-16. Cycle 4 found no TuffUI visualization published after `589cbb0` and added n17 and n18 from the factory console's Throughput page (host memory pressure, queue wait reasons), with no reference. Cycle 5 found none either and added three, so that cycle 6 can draw six cases that have never run: n19 from linewatch's Wi-Fi radio history (the alternate radio path), n20 from argo's weekly strength volume and its landmarks, and n21 from linewatch's interventions (what was done to the line, by whom). None has a reference. Their reviewer scores the rubric alone, and their verdict is left empty.

Cycle 6 found one TuffUI commit after `589cbb0`: `f31ea2b` on 2026-11-16, which adds Model Picker and Voice Session. Model Picker compares models on speed, price and context bars and prices the open chat on each, so it became c16 with the reference shot `model-picker-dark.png` (with `-light` and `-phone`), taken on 2026-11-16 with reduced motion, which shows the panel open. Voice Session is a call control whose bars draw a live audio level, not a dataset, so it has no case, as Tone Rewrite had none. Cycle 6 also added six native cases with no reference, so that cycle 7 can draw six that have never run: n22 from argo's fitness direction, n23 from argo's Uptime Kuma monitors, n24 from argo's gateway demand by purpose, n25 from argo's reading shelf, n26 from linewatch's path probes and n27 from the factory console's Improve page.

Cycle 7 found no TuffUI commit after `f31ea2b` (`gh api repos/yurigdesigner/tuffui/commits`, read on 2026-11-17), so it added no `c` case and ran six native cases. It added six native cases with no reference, so that cycle 8 can draw six that have never run: n28 from argo's spending page, n29 from argo's tax page, n30 from linewatch's throughput, n31 from the factory console's Shipped tab, n32 from the console's Chain and n33 from the console's Hygiene tab.
