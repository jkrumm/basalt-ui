# n78: mailbox sync, last 30 days

## Three lines

- Who: the mail gateway operator, opening the page to check the mailboxes.
- Question: is every mailbox still syncing, and how much mail and how many pending or failed jobs sit behind each? Decision: reconnect a mailbox, or leave it.
- Figures that answer: "4 of 6" syncing with "2 need a look", the backlog and the failures with the share behind stalled mailboxes, and per mailbox in one table: state, silence in minutes, pending and failed jobs, messages in and out, last error.

## Surface

Two parts. A four-cell strip carries the answer and the totals. One table carries every mailbox: the status and the 30-day mail beside it, so no fact about a mailbox sits in a second part and each address is listed once. Rows come in verdict order: mailboxes that need a hand first, then by volume. The table takes one `useChartFocus` over its rows (arrow keys step the rows, the kit dims the rest).

Round 1 dropped the heat grid and the in/out bar list of round 0: they listed the six addresses a second and third time, put mail apart from the status that answers the question, and the grid had no value labels, a clamped row and a body-face row label next to mono addresses elsewhere.

## One view (1800x1200, content width about 1510 px)

| part                | question it answers                                            | x,y w x h        | what it joins     |
| ------------------- | -------------------------------------------------------------- | ---------------- | ----------------- |
| StatGroup, 4 cells  | is every mailbox syncing, how much is waiting or failed        | 264,72 1512x172  | nothing (totals)  |
| Table "Sync status" | which mailbox is not syncing, why, and how much sits behind it | 264,260 1512x308 | its own row focus |

The lower half of the frame is empty: six mailboxes are six rows, and a part added to fill it would restate the table. The table shows all nine data columns at 1800 in one line per row; at 390 each row is a card with every column, the address and provider on the title line.

## Color: meaning

- status red: a mailbox that is not syncing (state dot, "need a look" count, "with failures" count)
- ink steps: bars of size (silence, pending, failed); nothing else is drawn
- accent: none. The page spends its one hue on the status.

## Fixtures

- rest: the case. finance stalled for 77 h behind an auth error, newhire never synced, archive has no mail in 30 days.
- calm: all six syncing, no failures, two pending jobs.
- backlog: finance holds 48 213 pending and 3 106 failed jobs, support receives about 560 messages a day (+125 % against the prior 30 days).

## Fact count

Round 0 first run: `10 mailbox, 7 syncing, 7 messages, 7 mailboxes, 7 jobs, 5 synced, 5 mail, 5 failed` and more. Round 1 first run: `3 [30 d]`. Last run: empty print.

One quantity, one word: messages, silence (minutes), jobs (pending, failed), mailbox for the item and address for its id.

## Read aloud

| fact                         | every slot that says it                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| how many mailboxes syncing   | strip cell 1 figure                                                                                     |
| which mailboxes need a look  | table state column; the strip counts them ("2 need a look") and its rows count stalled and never synced |
| the stall rule               | table subtitle "Stalled after 1 h of silence"                                                           |
| silence                      | table column "Silence, min" (per mailbox); the strip does not repeat it                                 |
| messages in and out          | strip cell 2 (totals) and table columns In and Out (per mailbox)                                        |
| the baseline of the messages | pill "vs prior 30 d"                                                                                    |
| pending jobs                 | strip "Backlog", table column "Pending"                                                                 |
| failed jobs                  | strip "Failures", table column "Failed"                                                                 |
| the last error               | table column "Last error"                                                                               |
| the empty sentence           | table panel only                                                                                        |

Greps: `STATE_LABEL` is read in the state column, the two strip rows of cell 1 (counts, one slot each) and the live-region announcement (hidden text). `sum(` feeds strip cells only; each result prints in one cell. The strip's In and Out rows are totals, the table's columns are per mailbox.

## Pass criteria

1. The strip says "4 of 6" and counts how many need a look.
2. The stalled and the never-synced mailbox lead the table, carry the one status hue and a word, and show their last error.
3. A mailbox with no mail reads 0 and 0, not a dash; the one that never synced shows a dash for silence.
4. Loading, empty and error keep every slot of the ready frame; the strip's error cause ("Timed out") fits whole at 390.
