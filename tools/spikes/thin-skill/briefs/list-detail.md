# Brief 2: pull request list and detail

Build the page "Pull requests, payments-gateway" for a reviewer who scans the open list and inspects one PR at a time. All data below is synthetic; show exactly these figures.

## Summary (three cards in one row at desktop)

| Metric           | Value | Change                              | Sub line        |
| ---------------- | ----- | ----------------------------------- | --------------- |
| Open             | 9 PRs | +2 vs last week, bad when up        | 3 need review   |
| Median age       | 2.1 d | -0.4 d vs last week, good when down | Oldest is 6 d   |
| Merged this week | 14    | +3 vs last week, good when up       | Most on Tuesday |

## List (a table)

| #    | Title                                      | Author      | State | Age | Changes     |
| ---- | ------------------------------------------ | ----------- | ----- | --- | ----------- |
| 4821 | Retry failed capture webhooks with backoff | M. Okafor   | Open  | 6 d | +412 -87    |
| 4833 | Split ledger export into monthly shards    | L. Brandt   | Open  | 5 d | +1,208 -344 |
| 4840 | Fix rounding on multi-currency refunds     | S. Iyer     | Open  | 4 d | +36 -12     |
| 4846 | Add idempotency keys to payout requests    | T. Nakamura | Draft | 3 d | +190 -4     |
| 4851 | Upgrade the card-network SDK to v9         | M. Okafor   | Open  | 3 d | +74 -69     |
| 4855 | Remove the legacy 3-D Secure fallback      | A. Petrov   | Open  | 2 d | +12 -611    |
| 4860 | Surface decline codes in the dispute view  | J. Moreau   | Open  | 1 d | +258 -31    |
| 4862 | Pin the staging webhook signing secret     | S. Iyer     | Draft | 1 d | +9 -3       |
| 4865 | Reconcile settlement files nightly         | L. Brandt   | Open  | 5 h | +521 -0     |

Row 4821 is selected when the page loads. Selecting another row changes the detail.

## Detail (for the selected PR; show the data for 4821)

- Title: Retry failed capture webhooks with backoff
- Branch: `okafor/webhook-backoff` into `main`
- Reviewers: S. Iyer (approved), L. Brandt (changes requested), T. Nakamura (pending)
- Checks: build passed, unit tests passed, integration tests failed (2 of 318), lint passed
- Description: "Failed capture webhooks are retried up to six times with exponential backoff and jitter, then moved to a dead-letter queue. Adds a replay endpoint for operators."

At desktop the list and the detail sit side by side; on a phone they stack, list first. Light theme.
