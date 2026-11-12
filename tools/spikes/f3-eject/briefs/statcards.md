# Brief 1: delivery health band

Build the page "Delivery health, last 7 days" for an operator who opens it to answer one question: is the pipeline keeping up? It is a card page in the style of an operations console. All data below is synthetic; show exactly these figures.

## Band of headline figures

Four headline figures belong together as one band at desktop (a single grouped block, not four unrelated cards), and stack on a phone.

| Metric           | Value | Change                               | Verdict             | Sub line                | Footer facts           |
| ---------------- | ----- | ------------------------------------ | ------------------- | ----------------------- | ---------------------- |
| Issues merged    | 212   | +9% vs prior 7 days, good when up    | none                | 30 per day              | Open 14, Blocked 3     |
| Median lead time | 6.2 h | -11% vs prior 7 days, good when down | On track (good)     | Fastest week this month | none                   |
| Failed deploys   | 5     | +2 vs prior 7 days, bad when up      | Above target (warn) | Target is 3 or fewer    | Rolled back 2, Fixed 3 |
| Queue depth      | 38    | -4 vs prior 7 days, good when down   | none                | Peaked at 61 on Tuesday | none                   |

Issues merged also shows a small per-day trend of the last 7 days: 22, 31, 27, 35, 29, 38, 30 (labels: Mon to Sun).

## Two cards under the band

| Card        | Value         | Notes                                                                                                                                                                     |
| ----------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spend       | $184.20       | -6% vs prior 7 days, good when down. Sub line "Of a $250 weekly budget". Footer facts: Input $121.40, Output $62.80. Per-day trend: 21, 28, 24, 30, 27, 29, 25 (dollars). |
| Review wait | no figure yet | The metric is not measured on this repository: show a dash for the value with the reason "Not measured on this repository". No change, no trend. Footer fact: Target 4 h. |

Both cards link to a detail page (the link target is `#spend` and `#review`); a card is one whole click target.

## Also

A one-line page summary under the title that contains at least one live number from above. Light theme. The page is read on a wide monitor and on a phone.
