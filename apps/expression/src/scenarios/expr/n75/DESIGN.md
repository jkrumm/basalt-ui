# Charter request page (expr-n75)

Opens it: the charter business owner. Question: is the request page turning visitors into requests, and how many inquiries are spam or marketing. Decision: fix the page or the inbox filter.

Figures: 3.4 % of the day's visitors sent a request (against a 90-day rate of 2.3 %); 97 of 236 inquiries are spam or marketing (41.1 %). Reads from `DESIGN.md` of the playground: identity inherited, no deviation.

## Surface

Parts: two answer cards (funnel, verdict), the traffic behind them, the inquiry list. The verdict bars and the list share one focus (`focusItems`: a row holds its verdict). The funnel takes its own focus for the keyboard and its readout. Traffic joins nothing: it stays because it is the denominator of the funnel and the only place the zero day shows.

## Fixtures

- rest: 90 daily points with one zero day (2 Oct), the funnel on the last day, the list cut at 200 of 236.
- `?fixture=no-visits`: the funnel sits on the zero day, every step is 0 and the figure is a dash.
- `?shot-state=loading|empty|error`: each card draws its own phase; three sources, three retries.

## One view (1800x1200)

| part         | question it answers              | x,y w×h           | joins                                               |
| ------------ | -------------------------------- | ----------------- | --------------------------------------------------- |
| Funnel card  | do visitors become requests      | 265,72 750×540    | own focus (keyboard, readout)                       |
| Verdict card | how many are spam or marketing   | 1027,72 750×540   | verdict focus, the list                             |
| Traffic card | how many visitors, any empty day | 265,628 1510×320  | none: denominator of the funnel, shows the zero day |
| Inquiry list | which messages are which verdict | 265,968 1510×~360 | verdict focus                                       |

Accent: the request-sent bar (one class). Everything else sits in ink steps. Status hue: none. Color: meaning, blue: request sent; dark ink: visitors; mid ink: steps reached and inquiry counts; pale ink: views.

## Fact count

First run printed 18 visitors, 10 page, 10 inquiries, 8 request, 6 views, 6 days, 6 [page views] and more (26 lines). Last run printed nothing.

## Read aloud

- share of visitors who sent a request | hero 3.4 % (figure); last bar label 3.4 % (the mark); the pill gives the 90-day rate 2.3 % (base)
- where visitors are lost | the step labels with their share; status "56.4 % leave at the site"; footer pairs hold the two later step rates only
- junk inquiries | hero 97 (figure); status 41.1 % of the total; the bars hold the three counts
- inquiry volume | footer Total 236 and Previous period 198; list subtitle "Newest 200 of 236" (the cut, a second place by design)
- zero day | the dashed rule "Zero visits"; the funnel's dash and "Nobody came that day" only in the no-visits fixture
- window | verdict period "last 90 days", traffic period "last 30 days", pill base "the 60 days before"; no other slot states a window
- helpers: `share()` prints four different values (leave, started, sent, junk share); `VERDICT_LABEL` names the verdict on the axis, the readout and the status column (one name for one item); `rg -n 'share\(|VERDICT_LABEL' .` checked.

## Kit gaps

See the report: no funnel form (Bars used), no horizontal bars with a stacked share, a neutral delta still draws an arrow (so the share is a status).
