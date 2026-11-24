# AI wallets (expr-n74)

## The three lines

- Who: the owner of several AI wallets (two subscriptions, three API keys). Question: which wallet's spend grew the most against the window before, and which spend is new with nothing before it. Decision: look into that wallet (or leave it).
- Answer figures: the multiple of the wallet that grew most (`×12`, `ci-bot`, `+US$426`), and the new wallet's name and dollars (`evals`, `US$187 new` on its bar, `New: evals` in the footer).
- Reads from `DESIGN.md` of the app: Identity only; no narrowing deviations.

## Surface

- Parts: a grouped bar chart of spend per wallet (the answer, on the marks), a table of the same wallets (verdict, change, fresh tokens), a daily line chart that shows when the rise and the new spend began.
- The bars and the table share one `useChartFocus` over the six wallet rows (a folded tail of small callers is the sixth row). The daily chart has the day as its grain and its own plain tooltip: it stays because the wallet grain cannot show when.
- Wide container: bars left at the full height of the right column; table over daily chart on the right. Narrow: bars, table, daily chart.

## One view at 1800x1200

| part                   | question it answers                       | x,y w x h        | what it joins                                                             |
| ---------------------- | ----------------------------------------- | ---------------- | ------------------------------------------------------------------------- |
| Spend by wallet (bars) | which wallet grew most, which is new      | 264,72 748x862   | the focus (table rows, figure period and status), the accent legend entry |
| Wallets (table)        | verdict, change in dollars, fresh tokens  | 1028,72 748x308  | the same focus; P1 and P2 columns: wallet, verdict, change, tokens        |
| Spend per day (lines)  | when did the rise and the new spend begin | 1028,396 748x538 | the accent meaning (answering wallets), the window break rule             |

## Color: meaning

- accent blue: the wallets that answer (grew most, new); bars, table verdict dots, daily lines.
- dark ink: the last window; pale grey: the window before and the rest of the spend per day.
- no status hue: nothing here needs action.

## Fact count

First run: `7 wallet, 6 wallets, 6 days, 6 [30 days], 5 last, 5 [last 30], 4 spend, 3 [fresh tokens]`. Last run: empty print. One quantity, one word: the dollar measure is "spend" (unit US$), the two periods are "window", the token measure is "fresh tokens".

## Empty, loading, error

- Loading: every slot held (labels kept, values empty). Error: one message, one Retry on the bars card. Empty: each part names its cause and next step.
