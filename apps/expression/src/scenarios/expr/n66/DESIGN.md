# Reading in 2026 (expr-n66)

## The three lines

- Who and what: a reader looks back at the year and asks how fast each finished book read, and which genre fills the backlog. The decision after reading: which genre to pick next, and whether to slow down for the dense books.
- Figures that answer: the median pace (36 pages/h) with its two-half baseline, one dot per book on the finish-date axis, and the backlog by genre (leader 19 of 60, 32 %).
- From DESIGN.md: neutral surfaces, one accent, sentence-case sans captions.

## Surface

Parts, at 1800x1200 (container about 1500 px wide):

| part                      | question it answers                        | x,y w×h          | what it joins                                                                      |
| ------------------------- | ------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------- |
| Reading pace chart card   | how fast does each finished book read      | 264,72 1004×583  | the one focus (dots and rows)                                                      |
| Backlog by genre bar list | which genre fills the backlog              | 264,668 1004×327 | nothing: genres are another grain than books, and no finished book carries a genre |
| Books row list            | which title is which dot, how long it took | 1280,72 496×903  | the one focus; two rows past it are books in progress and clear the focus          |

At 390 the order is chart, backlog, books. The row list sits last because the chart answers first.
Priority columns of a table: none, no table on this page (the row list carries name, detail and value).

## Datasets

| source            | shape                               | form                              | reason                                                 |
| ----------------- | ----------------------------------- | --------------------------------- | ------------------------------------------------------ |
| 24 finished books | pages, reading seconds, finish date | dot chart plus row list           | pace per book over time, a median rule as the baseline |
| 60 backlog books  | genre per book                      | BarList                           | a ranked split of a total                              |
| 2 in progress     | page of pages                       | rows at the end of the books list | two items, no chart needed                             |

## Color: meaning

- accent (blue): each finished book's pace, the one measure the question asks about.
- ink step (dark grey): the median rule and its label.
- neutral bars: backlog genres and nothing else, so the accent stays one class.
- no status hue: nothing on the page needs action.

## Fixtures

- default: 24 books, one read in one sitting (the fastest), one with no page count (a dash, no dot), a slow dense book, two in progress.
- `?fixture=extreme`: one booklet at 334 pages/h past the y scale (kit caret, true value), and one genre fills 51 of 60.
- `?fixture=idle`: nothing in progress, one genre at 0.
- shot states: loading, empty, error, each part with its own cause and next step.

## Fact count

First run (before the cuts): books 7, pages 6, finished 6, reading 5, median 5, book 5, page 4, length 4 (a code artifact), phrases [page count] 3, [reading log] 2, [log did] 2, [length books] 2, [finished book] 2, [books waiting] 2.
Last run: empty print.

| fact              | places before                         | places after                                    |
| ----------------- | ------------------------------------- | ----------------------------------------------- |
| the median pace   | hero, rule label, aria label, summary | 1 hero, 1 rule label (word only)                |
| no page count     | footer, readout, summary, aria        | footer label (one constant)                     |
| one sitting       | row status, readout                   | row status; the readout reads the same constant |
| reading log error | three strings                         | one constant                                    |
| backlog size      | subtitle                              | 1 subtitle                                      |

One quantity, one word: pace (title, label, rule); the unit `pages/h` is one constant on the figure, the axis and every readout. Reading time is the row detail, nothing else.

## Pass criteria

1. The hero carries the median pace with a signed delta that names both halves of the year.
2. Every finished book with a page count is a dot; the book with none is counted in the footer and has a dash in its row.
3. The fastest and the slowest dot carry a label; the extreme fixture shows the kit caret with its true value.
4. The leading genre sits first with its count and share.
5. Loading, empty and error keep every card's height.
6. The keyboard steps the chart and the list on one focus.
