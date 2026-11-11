# Brief 1: engineering overview

Build the page "Engineering overview, October" for a team lead who opens it each morning to answer one question: is delivery healthy this week? All data below is synthetic; show exactly these figures.

## Headline figures (four cards in one row at desktop)

| Metric      | Value        | Change                            | Verdict             | Sub line             | Footer facts       |
| ----------- | ------------ | --------------------------------- | ------------------- | -------------------- | ------------------ |
| Shipped     | 388 PRs      | +12% vs last week, good when up   | none                | Most since March     | Open 12, Merged 4  |
| Review time | 5.4 h median | -18% vs last week, good when down | On track (good)     | Fastest this quarter | none               |
| Deploys     | 61           | +4% vs last week, good when up    | none                | 8.7 per day          | none               |
| Incidents   | 3            | +1 vs last week, bad when up      | Above target (warn) | Target is 2          | Open 1, Resolved 2 |

Shipped also shows a small per-day trend of the last 12 days: 4, 9, 6, 12, 8, 15, 11, 18, 14, 21, 17, 24. The other three cards need no trend.

## Recent deploys (a table under the cards)

| Service                    | Version      | Environment | When       | Status      |
| -------------------------- | ------------ | ----------- | ---------- | ----------- |
| checkout-api               | 2026.10.31-3 | production  | 12 min ago | Succeeded   |
| web-storefront             | 2026.10.31-1 | production  | 41 min ago | Succeeded   |
| inventory-sync             | 2026.10.30-7 | staging     | 2 h ago    | Failed      |
| notifications              | 2026.10.30-5 | production  | 3 h ago    | Succeeded   |
| search-indexer             | 2026.10.30-2 | production  | 5 h ago    | Rolled back |
| payments-gateway           | 2026.10.29-9 | staging     | yesterday  | Succeeded   |
| admin-console              | 2026.10.29-4 | production  | yesterday  | Succeeded   |
| data-pipeline-orchestrator | 2026.10.29-1 | production  | yesterday  | Succeeded   |

Status is a word with a visible tone (good, warn, bad), not colour alone.

## Also

A one-line page summary under the title with at least one live number. Light theme. The page is read on a wide monitor and on a phone.
