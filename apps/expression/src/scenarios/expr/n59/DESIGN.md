# Homelab machines, last 24 hours (expr-n59)

## The three lines

- Who opens it: the homelab owner, checking six machines. The question: which machine is busy or nearly full right now, and what was it doing in the last 24 hours. The decision: look into one machine, or leave all six.
- The figures that answer: the busiest machine's CPU now (hero of the first card, against its own median), the fullest disk now (hero of the disk card, against 24 h ago), and the machine that stopped reporting (footer fact of the first card, a zone on its chart).
- Identity from `DESIGN.md`: neutral cards, one status hue, no accent spent.

## Surface

Six parts, one shared `useChartFocus` over the 288 readings: the five measure charts take it as `focus`, and the table of machines joins it through `DataTable focusSeries` (a row is a line). Pointing at a row dims the other machines in every chart; the shared cursor draws one time guide in all five charts.

## One view (1800x1200)

| part            | question it answers                              | x,y w×h          | what it joins                                                 |
| --------------- | ------------------------------------------------ | ---------------- | ------------------------------------------------------------- |
| CPU by machine  | which machine is busy, and since when            | 264,72 496×836   | focus; its figure and footer carry the busy and silent facts  |
| Disk fullness   | which disk is nearly full, how fast does it fill | 772,72 496×412   | focus; the limit rule                                         |
| Memory use      | which machine runs short of memory               | 1280,72 496×412  | focus; the limit rule                                         |
| Load average    | which machine has tasks waiting                  | 772,496 496×412  | focus; the true value of an off-scale load stays on the caret |
| Network traffic | which machine moves data                         | 1280,496 496×412 | focus                                                         |
| State now       | what is each machine's state and latest reading  | 264,920 1512×330 | focus (rows are series); all eight columns fit at full width  |

The CPU card spans the two rows beside it, so its chart is tall; the table sits full width because a half-width cell folds it into cards (its priority 1 and 2 columns sum to more than 480 px) and drops the priority 3 columns.

## Color: meaning

- Status red: a machine past its limit on that card (CPU from 85 %, memory or disk from 90 %, load above its core count). It is also the table's one status hue (Busy, Nearly full).
- Ink steps, dark to pale: one step per machine, the same on every card. The silent machine is a grey band on the CPU chart, not a color.
- No accent: nothing here is chosen by the owner; the answer is the state.
- Quiet fixture: every delta is neutral and no line is red.

## Fact count

First run printed machine 10, last 8, hours 8, [24 hours] 8, header 7, memory 4, median 4, machines 4, full 4, disk 4, busy 4, [fullest disk] 3. The last run prints nothing.

| fact                       | place                                                                      |
| -------------------------- | -------------------------------------------------------------------------- |
| the 24 hour window         | page title                                                                 |
| the 5 minute step and UTC  | CPU card subtitle                                                          |
| the busy limit             | the dashed rule, named Busy                                                |
| the disk and memory limit  | the dashed rule, named Limit                                               |
| edge silent for 20 minutes | the grey band on the CPU chart, the first card's footer fact (the minutes) |
| the fullest disk's size    | the disk card footer                                                       |

## Phone (390)

Order: CPU first (answer), disk second, memory, load, traffic, then the table as cards with the three meters (`card: 'meta'`). End labels shrink to the names that fit; the rest stay readable through the tooltip and the table.

## Pass criteria

1. The first card carries the busiest CPU with its baseline and the time it went over the limit.
2. The disk card carries the fullest disk with its used and free size and draws the limit.
3. The silent machine is marked on the CPU chart and named in the first card's footer; its table row prints dashes, never old numbers.
4. A loading frame holds every slot of the ready frame; an empty frame names its cause and next step on each part; an error frame carries one Retry.
5. `?fixture=pegged` keeps the other lines readable under a 53 load (kit caret); `?fixture=quiet` shows no red.
