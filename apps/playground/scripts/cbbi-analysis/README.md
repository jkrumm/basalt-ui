# CBBI offline analysis

The scripts behind `src/demo/cbbi/ANALYSIS.md` — cycle extrema, the per-metric scorecard, the
brokenness heuristics, the weight compositions and today's conditional base rates. Nothing here
runs at build or test time; the runtime re-derives its own numbers in `cbbi-diagnostics.ts`.

Only dependency is numpy — `python3 -m pip install numpy`, or `uv run --with numpy python <q>.py`.

Input is `/tmp/cbbi.json` (`curl -sSo /tmp/cbbi.json https://colintalkscrypto.com/cbbi/data/latest.json`);
every pickled intermediate lands in `/tmp/cbbi-analysis/` (`common.py`'s `OUT`).

Run order — `q4.py` reads `q2.py`'s pickle, the rest are independent:
`extrema → q2 → q3 → q3b → q3c → q4 → q5`.
