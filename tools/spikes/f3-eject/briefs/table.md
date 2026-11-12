# Brief 2: issue ledger (dense table)

Build the page "Issue ledger, last 14 days" for an operator who scans many rows quickly and compares figures down a column. All data below is synthetic; show exactly these rows.

## Table (16 rows, newest first)

| Id       | Title                                          | Repo      | State       | Lead time | Attempts | Cost   | Updated    |
| -------- | ---------------------------------------------- | --------- | ----------- | --------- | -------- | ------ | ---------- |
| ISS-4821 | Retry the artifact upload on a 502             | gateway   | Merged      | 3.4 h     | 1        | $4.10  | 12 min ago |
| ISS-4820 | Add a hashed id column to the audit export     | console   | Working     | 5.1 h     | 2        | $9.75  | 31 min ago |
| ISS-4818 | Fix the stale queue badge after a reconnect    | console   | Merged      | 2.2 h     | 1        | $2.60  | 1 h ago    |
| ISS-4815 | Move the digest job to the nightly window      | scheduler | Blocked     | 18.0 h    | 3        | $21.40 | 2 h ago    |
| ISS-4814 | Raise the cache ttl for the status endpoint    | gateway   | Merged      | 1.6 h     | 1        | $1.85  | 3 h ago    |
| ISS-4811 | Split the migration into two steps             | ledger    | Failed      | 7.9 h     | 3        | $15.20 | 4 h ago    |
| ISS-4809 | Render empty states in the settings panel      | console   | Merged      | 4.0 h     | 2        | $6.30  | 6 h ago    |
| ISS-4806 | Backfill the lead time column                  | ledger    | Merged      | 9.3 h     | 2        | $12.90 | yesterday  |
| ISS-4804 | Reject a webhook with a bad signature          | gateway   | Merged      | 2.8 h     | 1        | $3.15  | yesterday  |
| ISS-4801 | Paginate the long history list                 | console   | Queued      | 0.0 h     | 0        | $0.00  | yesterday  |
| ISS-4798 | Drop the unused legacy flag                    | scheduler | Merged      | 1.1 h     | 1        | $1.20  | 2 days ago |
| ISS-4795 | Show the retry count next to the attempt badge | console   | Merged      | 3.7 h     | 1        | $4.45  | 2 days ago |
| ISS-4792 | Make the nightly report idempotent             | scheduler | Rolled back | 11.6 h    | 3        | $17.60 | 3 days ago |
| ISS-4790 | Index the events table by repository           | ledger    | Merged      | 6.5 h     | 2        | $8.05  | 3 days ago |
| ISS-4787 | Trim the payload of the poll response          | gateway   | Merged      | 2.0 h     | 1        | $2.40  | 5 days ago |
| ISS-4783 | Explain a failed check in the inspector        | console   | Merged      | 5.8 h     | 2        | $7.10  | 6 days ago |

State is a word with a visible tone (Merged good, Working info, Queued neutral, Blocked and Rolled back warn, Failed bad), not colour alone. Numeric columns (Lead time, Attempts, Cost) line up so they can be compared down the column. The Id is never shortened. ISS-4815 is the selected row (highlighted as selected, with the selection announced to assistive tech).

## Around the table

A table heading with the row count ("16 issues"), a search field above the table (visual only, no filtering needed) and a footer line under the table: "Total cost $118.05, median lead time 3.9 h".

## Also

A one-line page summary under the title that contains at least one live number from above. Light theme. The page is read on a wide monitor and on a phone: the table must stay usable at a width of 390 px without the page itself scrolling sideways.
