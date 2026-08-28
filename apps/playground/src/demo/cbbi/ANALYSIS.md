<!-- Offline analysis behind the CBBI panel diagnostics (broken / stale / noisy badges), the presets and the suggestion lines. Reproduce with `python3 apps/playground/scripts/cbbi-analysis/<q>.py` against /tmp/cbbi.json (numpy). Snapshot of 2026-08-27. -->

# CBBI analysis — 5,541 days, 2011-06-27 → 2026-08-27

Equal-weight mean of the 9 non-null metrics reproduces published `Confidence` to **1e-4**.

## 1. Cycle extrema (log-price, ±180d window)

Rule: prominent local max (prom ≥ 0.7 log) that is a running all-time high → 6 tops; prominent local
min (prom ≥ 1.3) that is the lowest close since the preceding top → 4 bottoms.

| Tops           | Price       | prom     |     | Bottoms                    | Price    | prom   |
| -------------- | ----------- | -------- | --- | -------------------------- | -------- | ------ |
| 2013-04-09     | 231         | 1.25     |     | 2011-11-18                 | 2.11     | 2.09   |
| 2013-12-04     | 1,135       | 1.87     |     | 2015-01-14                 | 175.64   | 1.87   |
| 2017-12-16     | 19,641      | 1.82     |     | 2018-12-15                 | 3,185    | 1.82   |
| 2021-04-13     | 63,446      | 1.39     |     | 2022-11-09                 | 15,758   | 1.46   |
| 2021-11-08     | 67,542      | 1.46     |     | _2026-06-30 (provisional)_ | _58,525_ | _0.32_ |
| **2025-10-06** | **124,824** | **0.76** |     |                            |          |        |

Rejected: 2019-06-26 (12,863, prom 0.95 — bear-rally high, not an ATH); 2024-03-13 (prom 0.31);
2015-08-24 / 2020-03-12 (retest, intra-bull crash). 2026-06-30 is 58d from series end — provisional.

## 2. Per-metric scorecard at extrema

`mTop30` = mean of max within ±30d of a top; `mBot30` = mean of min within ±30d of a bottom. Left
block = **ALL CYCLES** (6 tops / 4 bottoms); right block = **LAST TWO CYCLES** (tops 2021-04, 2021-11,
2025-10; bottoms 2018-12, 2022-11). The divergence between them is the degradation signal.

| metric      | mTop | mTop30 | ≥.85 | mBot30 | ≤.15 | sep30 |     | mTop | mTop30 | ≥.85    | mBot30 | ≤.15 | sep30 | **Δsep30** |
| ----------- | ---- | ------ | ---- | ------ | ---- | ----- | --- | ---- | ------ | ------- | ------ | ---- | ----- | ---------- |
| PiCycle     | 0.88 | 0.89   | 4/6  | 0.05   | 3/4  | +0.83 |     | 0.76 | 0.78   | **1/3** | 0.08   | 2/2  | +0.70 | **−0.14**  |
| RUPL        | 0.98 | 0.99   | 6/6  | 0.00   | 4/4  | +0.99 |     | 0.97 | 0.99   | 3/3     | 0.00   | 2/2  | +0.99 | −0.01      |
| RHODL       | 0.87 | 0.90   | 5/6  | 0.09   | 3/4  | +0.80 |     | 0.89 | 0.93   | 3/3     | 0.00   | 2/2  | +0.93 | +0.13      |
| Puell       | 0.93 | 0.95   | 5/6  | 0.02   | 4/4  | +0.93 |     | 0.90 | 0.93   | 2/3     | 0.05   | 2/2  | +0.89 | −0.04      |
| 2YMA        | 0.95 | 0.96   | 5/6  | 0.01   | 4/4  | +0.94 |     | 0.93 | 0.93   | 2/3     | 0.03   | 2/2  | +0.90 | −0.04      |
| Trolololo   | 0.93 | 0.93   | 5/6  | 0.01   | 4/4  | +0.92 |     | 0.95 | 0.95   | 3/3     | 0.02   | 2/2  | +0.93 | +0.01      |
| MVRV        | 0.94 | 0.98   | 6/6  | 0.00   | 4/4  | +0.98 |     | 0.93 | 0.98   | 3/3     | 0.00   | 2/2  | +0.98 | −0.00      |
| ReserveRisk | 0.94 | 0.97   | 6/6  | 0.02   | 4/4  | +0.96 |     | 0.95 | 0.97   | 3/3     | 0.03   | 2/2  | +0.94 | −0.02      |
| Woobull     | 0.96 | 0.96   | 6/6  | 0.00   | 4/4  | +0.96 |     | 0.96 | 0.96   | 3/3     | 0.00   | 2/2  | +0.96 | −0.00      |

**Only PiCycle degrades.** Max within ±30d of each top: 1.00, 1.00, 1.00, 1.00, **0.60** (2021-11),
**0.74** (2025-10). Every other metric is flat or improving — Trolololo, ReserveRisk and Woobull show
**no** degradation here.

⚠ Limit: the series is **retro-computed with today's parameters**, so a re-fit Trolololo band or
Woobull Top Cap looks good in hindsight _by construction_. The re-fitting folklore is unsupported
here, not refuted.

## 3. Brokenness heuristics (runtime-computable, no cycle dates)

`peer-median` = median of the _other 8_ metrics that day; consensus top = peer-median ≥ 0.85. Window
= trailing 1,461d (4y), ~300 consensus-top days per metric.

| metric      | (a) null 90d / tail | (b) max4y ÷ ATmaxTop | (c) drift 2y−all | (d) corr(Conf) 2y−all | (e) days>0.8 / <0.2 | **TPR 4y** | **FA 4y** | **J = TPR−FA** |
| ----------- | ------------------- | -------------------- | ---------------- | --------------------- | ------------------- | ---------- | --------- | -------------- |
| PiCycle     | 0.000 / 0           | 1.04                 | +0.05            | +0.09                 | 524 / 1307          | 0.185      | 0.125     | **+0.06**      |
| RUPL        | 0.000 / 0           | 1.01                 | +0.11            | +0.08                 | 288 / 1322          | 1.000      | 0.320     | +0.68          |
| RHODL       | 0.000 / 0           | 1.11                 | +0.28            | +0.04                 | 271 / 28            | 0.779      | 0.114     | +0.67          |
| Puell       | 0.000 / 0           | 1.05                 | +0.26            | **−0.05**             | 0 / 1339            | 0.920      | 0.205     | +0.71          |
| 2YMA        | 0.000 / 0           | 1.04                 | +0.29            | +0.00                 | 290 / 1264          | 1.000      | 0.274     | +0.73          |
| Trolololo   | 0.000 / 0           | **0.94**             | +0.21            | +0.13                 | 322 / 9             | 0.304      | 0.000     | **+0.30**      |
| MVRV        | 0.000 / 0           | 1.02                 | +0.22            | +0.03                 | 290 / 0             | 0.993      | 0.125     | +0.87          |
| ReserveRisk | 0.000 / 0           | 1.03                 | +0.26            | +0.03                 | 286 / 0             | 0.760      | 0.029     | +0.73          |
| Woobull     | **0.022 / 2**       | 1.02                 | +0.22            | +0.01                 | 298 / 1264          | 0.910      | 0.038     | **+0.87**      |

Candidate verdicts: **(a) staleness** flags Woobull only (2-day null tail) — a publication lag, not
death. **(b) range collapse fails** — PiCycle scores 1.04 (it reached 0.93 in the last 4y, just not at
the top); only Trolololo dips below 1.0. **(c) drift fails** — PiCycle has the _smallest_ drift
(+0.05); the stat just measures whether the window held a bull market. **(d) corr-with-Confidence
fails and inverts** — the only negative delta is Puell (−0.05), an enabled metric; PiCycle's 2y corr
is 0.902. **(e) days-since->0.8 fails** — PiCycle's 524d is the 78th percentile of its own history
(p90 = 817d), not anomalous.

**Recommended rule (2 signals):**

1. **Discrimination — Youden J vs peer consensus, 4y window. Flag `J < 0.50`** → **PiCycle (0.06)**,
   **Trolololo (0.30)**. Next-lowest is RHODL 0.67: a **0.37 margin**, no false positives, and no
   false negatives among the owner's 5.
2. **Data health — `tailNulls ≥ 2` or `nullShare(90d) ≥ 3%`** → **Woobull** only (on its 2-day tail;
   its share is 2.2%). A "stale" badge, kept separate from "broken".

**Where the data contradicts the folklore:**

- **ReserveRisk and Woobull are not broken — they are the two best metrics here.** ReserveRisk: J
  +0.73, FA 0.029, hit 1.00 at the 2025-10 top, **20.7%** of the current epoch above 0.8 (its highest
  share ever) — "sat low for years" is false. Woobull: J **+0.87, best of all 9**, sep30 +0.96, 24.4%
  of the epoch above 0.8 (highest ever); only defect is a 2-day null tail.
- **Trolololo is flagged**, weakly but consistently: J 0.30, only metric with max4y below its top
  range (0.94), reached 0.86 at the 2025-10 top vs 0.94 mean at prior tops.
- **PiCycle is flagged decisively** — missed 2 of the last 3 tops (0.60 in 2021-11, 0.74 in 2025-10,
  vs 1.00 at all four earlier). Worse than the folklore says: it missed 2025 too, not just 2021-11.
- **Advisory, not a flag: Puell has inflated.** Share ≥0.90 by epoch 1.2 → 2.7 → 7.2 → **23.3%**;
  FA tripled (0.059 → 0.205). J is still 0.71, so **noisy, not broken** — today's 0.93 is far weaker
  evidence than the same reading in 2017.

## 4. Weight compositions

Grid 0..2 / 0.25. (iii) `w ∝ sep30(last 2 cycles)`, flagged → 0; (iv) `w ∝ max(0, aTop4y − 0.70)`;
(v) `w ∝ max(0, 0.30 − aBot4y)`; all rescaled so max → 2.00.

| composition          | PiCyc | RUPL | RHODL | Puell | 2YMA | Trolo | MVRV | ResRisk | Woob |
| -------------------- | ----- | ---- | ----- | ----- | ---- | ----- | ---- | ------- | ---- |
| i official equal (9) | 1.00  | 1.00 | 1.00  | 1.00  | 1.00 | 1.00  | 1.00 | 1.00    | 1.00 |
| ii owner 5           | 0.00  | 1.00 | 1.00  | 1.00  | 1.00 | 0.00  | 1.00 | 0.00    | 0.00 |
| iii data-driven      | 0.00  | 2.00 | 2.00  | 1.75  | 1.75 | 0.00  | 2.00 | 2.00    | 2.00 |
| iv peak-sensitive    | 0.25  | 2.00 | 1.50  | 1.75  | 2.00 | 0.50  | 2.00 | 1.25    | 1.25 |
| v bottom-sensitive   | 1.25  | 1.25 | 2.00  | 0.25  | 1.75 | 1.50  | 2.00 | 2.00    | 1.25 |

| composition        | mTop | peakT | mBot | trghB | sep       | lag@0.9 (hits, median d) | lag@0.1  | **today** |
| ------------------ | ---- | ----- | ---- | ----- | --------- | ------------------------ | -------- | --------- |
| i official equal   | 0.93 | 0.93  | 0.04 | 0.03  | +0.89     | 5/6, 97d                 | 4/4, 21d | **0.408** |
| ii owner 5         | 0.93 | 0.94  | 0.05 | 0.03  | +0.88     | 5/6, 101d                | 4/4, 25d | **0.468** |
| iii data-driven    | 0.94 | 0.95  | 0.04 | 0.03  | **+0.90** | 5/6, 98d                 | 4/4, 25d | **0.406** |
| iv peak-sensitive  | 0.94 | 0.94  | 0.04 | 0.03  | **+0.90** | 5/6, 98d                 | 4/4, 25d | **0.426** |
| v bottom-sensitive | 0.93 | 0.93  | 0.04 | 0.03  | +0.89     | 5/6, 96d                 | 4/4, 21d | **0.335** |

**Weighting barely matters.** Separation spans 0.88–0.90, median lag 96–101d; all five miss the
2013-04 top at 0.9 and catch all four bottoms within ~3 weeks. The only material difference is
**today's reading: 0.34–0.47**, a 0.13 spread driven by dropping Puell (0.93) or PiCycle/Trolololo.
Don't sell re-weighting as better forecasting — sell it as removing metrics you don't trust. Per-top
lag@0.9 (official): na, 11, 20, 97, 306, 309d — an early _regime_ warning, not a timing signal.

## 5. Today — 2026-08-27, price 80,297, Conf 0.408, −35.7% from the 2025-10-06 ATH

Base rates: fwd90 +9.4% (58.9% pos), fwd180 +33.5% (64.4%), fwd365 +89.6% (72.1%). Day counts overlap
heavily — episodes are the effective sample size.

| Line a panel could show                                                                                                              | Support                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"325 days past the cycle top with the composite at 0.41 — 17 prior episodes, median +138% at 1y, 96.9% positive vs 72.1% base."**  | 1,877 days / 17 episodes. fwd90 +18.7% (70.8% pos), fwd180 +49.1% (85.2%), fwd365 **+138.4% (96.9%)**. Strongest supported line.                                                                                             |
| **"MVRV at 0.13 has 35 prior episodes: +54% median at 6mo (82% positive), +120% at 1y (99.2% positive)."**                           | 880 days / 35 episodes, all four cycle bottoms inside.                                                                                                                                                                       |
| **"ReserveRisk 0.19 + MVRV 0.13 together: 33 episodes, +56% at 6mo, +115% at 1y, 99.1% positive."**                                  | 836 days / 33 episodes. Both metrics pass the brokenness rule.                                                                                                                                                               |
| **"The composite has never bottomed near 0.41 — all four cycle bottoms read 0.006–0.067, and only 93 days in 15 years read ≤0.05."** | Conf at bottoms: 0.067, 0.006, 0.041, 0.048. Lowest since the 2025 top: 0.256 (2026-06-30).                                                                                                                                  |
| **"Time and depth are both short of prior bears: bottoms landed 364–406d past the top at −77% to −85%; we are at day 325 at −36%."** | 2015-01 −84.5%/406d, 2018-12 −83.8%/364d, 2022-11 −76.7%/366d. Day-325 drawdowns were −69%, −67%, −71% in the three comparable bears.                                                                                        |
| **"Puell 0.93 is in its historical top zone, but it has spent 23.3% of this cycle there — down-weight it."**                         | Puell ≥0.90 share by epoch 1.2/2.7/7.2/**23.3%**; FA rate 0.059 → 0.205. Unconditional Puell ≥0.90 still carries fwd90 −7.2% / fwd180 −14.0% (478 days, 38 episodes) but that is dominated by 2017/2021/2024.                |
| ~~"Puell ≥0.90 while the composite is ≤0.50 preceded X"~~                                                                            | **Data does not support.** 3 days ever (2023-07-09 and today), **1** usable forward observation.                                                                                                                             |
| ~~"The Puell−MVRV spread of 0.80 signals Y"~~                                                                                        | **Data does not support** — and it is unprecedented: the spread first reached 0.70 on **2026-08-23**, 5 days ago, in 5,541 days of history. Zero forward observations. Report as "no precedent", infer nothing.              |
| Not applicable today                                                                                                                 | The bearish "composite 0.35–0.45 **and falling** ≥0.15 over 90d" pattern (fwd180 median −26.3%, 9.4% positive, 17 episodes) — today's composite is **up** +0.09 over 30d and only −0.04 over 90d, so today does not qualify. |

## What the runtime should implement

1. `peerMedian_k(t) = median(v_j(t) for j ≠ k, v_j finite)` — everything below derives from it: no
   cycle dates, no lookahead, computable on the latest series alone.
2. `TPR_k = mean(v_k ≥ .80 | peerMedian_k ≥ .85)`, `FA_k = mean(v_k ≥ .80 | peerMedian_k < .85)` over
   the trailing **1,461d**; `J_k = TPR_k − FA_k`. Need ≥ 60 consensus-top days, else "insufficient data".
3. **Broken badge: `J_k < 0.50`.** Flags PiCycle (0.06) and Trolololo (0.30); nearest non-flagged is
   0.67 — the threshold sits in a 0.37-wide gap, so it is stable.
4. **Stale badge (separate): `tailNulls_k ≥ 2` OR `nullShare_k(90d) ≥ 0.03`.** Today flags Woobull
   only, and on the TAIL — its 90-day share is 2 of 90 = 0.022. Three of ninety, not one: at a 0.01
   floor a single missing reading is 0.011 and every one-day publication lag reads `stale`, which
   also made the 2-day tail tolerance unreachable. Never merge this with the broken badge —
   Woobull has the best `J` of all nine.
5. **Noisy badge (advisory): `share(v_k ≥ .90, last 1461d) > 3 × share(v_k ≥ .90, all history)`** —
   render "reads high often this cycle", not "broken". **Fires on nothing today**: on the trailing
   1461d window Puell is 22.1% vs 8.7% lifetime = 2.54× (the 23.3% above is a halving-EPOCH share),
   and 2YMA 2.69×, MVRV 2.15×, RHODL 2.03× sit right behind it — a lower multiple would flag the
   bull-market window, not Puell. Keep 3×; the Puell advisory line is unsupported at runtime.
6. Composite `= Σ w_k·v_k / Σ w_k` over finite `v_k` only (renormalise on nulls — reproduces published
   `Confidence` at `w ≡ 1` to 1e-4). Weights on the 0..2 / 0.25 grid.
7. Do **not** promise a better composite from re-weighting — separation across all five vectors is
   0.88–0.90, median top-lag 96–101d. Present weights as trust, not accuracy.
8. Gate every conditional claim on **≥ 8 episodes and ≥ 200 forward observations**; below that render
   "no precedent", not a statistic. That gate kills the Puell+low-composite line (1 obs) and the
   Puell−MVRV spread line (0 obs) while passing the four supported lines above.
