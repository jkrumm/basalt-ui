# Copy

The words on a page state facts: a precise noun, its scope, a live number. Slots and props: [PageBar](node_modules/basalt-ui/docs/page-bar.md), [PageSummary](node_modules/basalt-ui/docs/page-summary.md), [StatCard](node_modules/basalt-ui/docs/stat-card.md). Words for empty, loading and error are in [states](states.md).

## Titles and summary

- The page title names the subject and its scope ("Pull requests, last 30 days"), the page bar's `title`. [type:PageBarProps]
- The summary sentence carries a live number and states a fact: "12 tickets open, 3 past SLA". [PageSummary](node_modules/basalt-ui/docs/page-summary.md) renders it; a headline that restates the title is left out.
- A card title is a noun phrase naming the subject, in sentence case, in the body sans. A category word names nothing.

## Captions and facts

- Captions are sentence-case sans.
- A caption names a period when the figure has one ("First reply, 7 days"); a rate or total carries its period.
- A delta names what it compares to ("vs last week"); a unit sits beside the figure, spelled short.
- The footer states two facts at most. [type:FootFacts]
- A domain word that is unfamiliar to a stranger carries an [InfoHint](node_modules/basalt-ui/docs/info-hint.md) whose definition is read from the app's glossary (`defineGlossary`) and retyped nowhere.

## Meaning, missing and time

- Every KPI card has one plain sentence of what its figure means and which way is good ("Merged pull requests. Higher is better."), in the `info` slot of the [StatCard](node_modules/basalt-ui/docs/stat-card.md); the delta's polarity says the same in colour. [type:StatCardProps]
- A figure nobody counted is a dash with its reason, "Not measured, <why>" ("Not measured, no agent has reported yet"). `value: null` on the [StatCard](node_modules/basalt-ui/docs/stat-card.md) draws the dash; the caption or the sub line names the reason.
- A time reads relative ("3 hours ago") with the absolute time on hover: `useFormat().relative` for the text, the `dateTime` form for the hover, or the table's `relativeTime` column, which carries both.
- An origin is a word plus its source ("Manual, from the CLI"; "Webhook, from GitHub"), where a bare word leaves the reader guessing who or what made it.

## Word economy

- Marks and numbers carry the change. The hero is the answer with its verb and at most one phrase of baseline; the delta pill, the annotation on the mark and the footer pair say the rest.
- A sentence appears only where the marks cannot say it. A line that describes what the chart shows is cut; a line that names what the reader cannot see (a cause, a scope) stays.
- The hero's verb ("Runs out 13:52") is the answer, and the sentences around it say something else: the headline, the sub line, the annotation and the caption state it once between them.

### Worked: one fact, four lines, one figure

A build of an incident page said the same fact four times:

- Headline: "13 of 19 services are affected right now"
- Sub line: "13 services affected out of 19 in total"
- `refLine` label: "Limit: 19 services"
- Badge on the list: "13 affected"

Cut to what the marks cannot say: the figure `13` with its pill `of 19`, one annotation on the mark that needs the eye ("Worst: payments, 4 h"), and nothing else. The headline sentence, the sub line, the limit label (the line is the limit) and the badge (the list is the affected items) each restate the figure. Read each line aloud against the mark beside it, and cut every line that says what the figure, its pill or the annotation already says.

### Worked: the read-aloud pass

The count prints nothing on a page whose repeats are not literal strings. An empty print is not proof: repeats sit in four shapes the count cannot read. The `## Read aloud` section of the design file is the check: read the 1800 rest shot top to bottom, write `fact | every slot that says it`, and for each helper and each label map (a `Record<K, string>`) in the page run `rg -n '<name>' <page dir>` and add one slot per use that reaches the viewer.

- **A value one helper prints into several parts**: "Birch fills Fri 14:00" stands in the strip sub (`stamp(fills.fullAt)`), the Full-by column (`stamp`) and the Will-fill cell (`stamp`), three slots for one fact. Keep the column; the strip names the account.
- **A label map entry shown in several slots**: "waiting" stands in the status slot, the footer, the ledger subtitle and the legend through `STATUS_LABEL.waiting` (four); "Spam delivered" in the status, the dot label, the legend and the table through `CASE_LABEL`.
- **A state said by a caption, a pill and a sub line**: "Behind" in the Meter zone, the delta pill and "225 more keepers needed"; "Under limit" in the Meter zone and the "-1.4 pts vs 20 %" pill.
- **A legend entry that repeats an axis title, a subtitle or a period**: the legend "Net" and "Share of paid" against the y axis titles; "Steps from unrated to fluent" against the axis ticks; "US$38 to US$464" in the period and on the bar labels, "+US$426" in the pill and the table.

- **A meter that prints its value beside the figure**: a strip meter's "4", "59", "23" under the figure that says it; the bar is the mark, the figure is the number.
- **A window in a page title, a card title and a subtitle**: "UTC days, 200 newest jobs" under a title that already says the days. List each of the three as a slot.
- **A measure in every pane title and the subtitle**: "mean rank" three times plus the subtitle. Name it once, in the axis title or the subtitle, and let the pane titles say what differs.

**The pass reads the rendered text, not the source.** An empty print and a written section are not enough: the count reads the tsx, so it never sees one fact said in other words across slots, and a pass that lists one slot per fact misses it because each slot used a different word. Open the 1800 shot and read every visible string aloud (card title, subtitle, axis title, cell label, status, `sub`, pill, zone caption, footer, legend, mark label), then group the strings by what they say, not by their letters. "Orphaned raws" as a label, "Orphans found" as a status, "unmatched" as a sub and a subtitle restating both is one fact in four words; "First-pass" in the title, "Running share of Issues verified" as the subtitle, "% passed first time" as the axis title and a status beside "Light not rated yet" is one measure in four; a zero run said by the figure "5 days at zero", its period, the zone caption "No clean-up" and a pill "+5 vs 0 in the days before"; the furthest pair in the sub line and again as row 1 with its word and "widest miss first", and "Not measured 0" in the footer when all four are measured. Each such group keeps one slot: the figure, or the mark's label, and the others are cut or say something the first does not. The pill that restates the figure and the caption that restates its title are the usual second slots.

A fact with two or more slots keeps one: cut the others, or give each slot something the others do not say. The pass cuts what it finds, in the same sitting: a pass that lists "3.4 % in the hero and on its bar" and "236 in a subtitle and a footer", "31" and "5" in the strip and as bar labels, and the winner's numbers in the strip and the table, and keeps each with a reason ("a second place by design", "the mark's own place", "Kept repeats") has cut nothing. "Kept on purpose" is not a reason and no line of the section carries one: the figure is the slot, and a mark carries its own value only where no figure says it. The pass is run on the final source, after the last cut, and the section is part of the report.

A pass also names a repeat and keeps it under other words ("the base, not the window", "kit forces", "one fact on two slots", "different slots", "each a different count"). The section therefore has no outcome column: each fact ends in one slot, and a second slot is cut or rewritten to say something new. A reason is not a slot. Shapes the passes missed, each a slot to list: a subtitle or caption sentence that restates its title or the marks ("Summed over its hours" and "Summed over its days", two captions on one page, "Work first, then clean", which restates the sort); a row that prints bar, share and amount at once (keep the bar and the amount, or the share as the `secondary`); a string repeated on every fixture row ("Waits for the first sweep." on 17 rows), which the count cannot read because it reads the tsx only; and a legend entry or a card prefix that repeats a pill or a rule ("Typical day", "Finding:").

### Worked: the period said once

A build said "last 30 days" in the title, the caption, the axis title and the footer, and the hero repeated the count the chart's pill carried. Keep the period in the card's `figure` period slot and the count in the figure; the axis title names the unit only ("Deploys"), the footer holds two facts the marks do not (the busiest day, the slowest run).

### Worked: a number four times, a leader three times

One page printed "19.4 kt" in the hero, the bracket, the footer and the table; another named its leader in the hero, the list and a note. Keep it where the reader looks first and where a mark can carry it (the bracket on the chart), and let the hero, period, pill, footer and list each state something the others do not.

### Worked: the fact count

The count is a command on your page, not a table you write. A table of facts does not hold: a page that writes one cuts nothing, because a table lists the facts its author already said once. The repeats that matter are never one phrase: one content word spread over the title, the unit, the axis title, the legend and the footer ("median" ten times on one page, "shipped" twenty on another), or one fact in four phrasings. The count finds the first kind and the phrase pass finds some of the second; reading the frame aloud finds the rest.

Run it after the first typecheck and before you open the 1800 shot, and again after every cut. It reads the words a viewer reads in your page's `.tsx` files: JSX text, and quoted or template strings that hold a space or start with a capital. Code never counts: imports, `className`, `key`, `aria-*`, one-word lowercase keys and the code inside `${…}`. The scan takes each string whole from left to right, so an option key between two strings (`header:`, `label:`) is never text. A property name is not a word: `${x.label}`, `${w.done}` and `${d.flat}` hold the place of a value, shown as `#`; reading `${w.done}` as `4 done` and `4 {w}` hid the real repeats. The count also sees three things beyond literal words: a number and its unit or label as a phrase (`[3 h]`, `[over 75]`, `[low #]` for `'Low ' + a.battery` and `'Low ' + b.battery`); a string held in a constant (`const AHEAD = 'Ahead'`, a template in a local) as one string at each place it is read, printed as `3 =ahead` when it is read in three places, from two up; and a `${UPPER_CASE}` constant as a use of that constant. A string counts a word once. It prints each word said in four or more strings and each two-word phrase said in two or more:

`rg -IN --no-filename -g '*.tsx' -v '^\s*(import |\} from |//|\*|/\*)' <page dir> | perl -0777 -pe '%k=();while(/\bconst\s+(\w+)\s*(?::\s*string\s*)?=\s*(["\x27\x60])((?:(?!\2)[^\\\n]|\\.)*)\2[ \t]*(?:as const)?[ \t]*\n/g){($i,$j,$l)=($1,$2,$3);$k{$i}=[$j,$l] if ($l=~/^[A-Z]/||$l=~/[^\w\\-]/)&&($l=~s/\$\{[^}]*\}//gr)=~/[A-Za-z]{2}/}s/\bconst\s+(\w+)\s*(?::\s*string\s*)?=\s*(["\x27\x60])(?:(?!\2)[^\\\n]|\\.)*\2[ \t]*(?:as const)?[ \t]*\n/exists $k{$1}?"\n":$&/ge;for $n(keys %k){($q,$t)=@{$k{$n}};s{\$\{\s*\Q$n\E\s*\}}{ uu_$n $t }g;s{(?<![\w.\$])\b\Q$n\E\b}{$q uu_$n $t $q}g;s/(["\x27])\s*\+\s*[A-Za-z_][\w.]*(\([^)]*\))?/ nn_$1/g}' | sed -E 's/\$\{([A-Z][A-Z0-9_]*)\}/ vv_\1 /g; s/\$\{[^}]*\}/ nn_ /g; s/(className|key|id|type|role|variant|size|tone|href|style|field|accessorKey|data-[a-z-]+|aria-[a-z]+|aria-[a-z]+)=("[^"]*"|\{[^}]*\})//g; s/%/ % /g' | perl -nle 'while(/("(?:[^"\\]|\\.)*"|(?<![A-Za-z])\x27(?:[^\x27\\]|\\.)*\x27|\x60[^\x60]*\x60|(?<![=-])>[^<>{}]{3,}<)/g){$t=$1;$c=substr($t,0,1);if($c eq "\x22"||$c eq "\x27"){$t=substr($t,1,-1);next unless $t=~/^[A-Z]/||$t=~/\s/}print $t}' | awk 'function isn(t){return t ~ /^[0-9]+$/}BEGIN{k=split("the|and|for|with|from|that|are|was|not|has|have|its|you|your|when|here|there|what|which|been|were|will|then|them|they|their|also|just|some|such|very|about|after|before|between|at|to|in|on|by|is|as|or|vs",z,"|");for(i=1;i<=k;i++)q[z[i]]=1;n=split("the|and|for|with|from|this|that|are|was|not|has|have|per|its|all|one|any|more|than|into|off|out|you|your|each|when|over|only|here|there|what|which|been|were|will|then|them|they|their|also|just|some|such|very|about|after|before|between",a,"|");for(i=1;i<=n;i++)s[a[i]]=1}{m=split(tolower($0),w,/[^a-z0-9_%]+/);delete u;delete v;for(i=1;i<=m;i++){x=w[i];if(x ~ /^uu_/){if(!(x in u)){u[x]=1;d[x]++}continue};if(x ~ /^vv_/){if(!(x in u)){u[x]=1;c["{"substr(x,4)"}"]++}continue};if(length(x)>=4&&!(x in s)&&!(x in u)){u[x]=1;c[x]++}};for(i=1;i<m;i++){x=w[i];y=w[i+1];na=isn(x);nb=isn(y);if(x ~ /^[uv][uv]_/||y ~ /^[uv][uv]_/||x==""||y==""||(na&&nb)||(x=="nn_"&&y=="nn_"))continue;if(na||nb){if((na?y:x) in q||(na?y:x)=="nn_")continue}else if(x in s||y in s||length(x)<3||length(y)<3)continue;p=x" "y;if(!(p in v)){v[p]=1;b[p]++}}}END{for(k in c)if(c[k]>=4)print c[k],k;for(k in b)if(b[k]>=2){p=k;gsub(/nn_/,"#",p);print b[k],"["p"]"};for(k in d)if(d[k]>=2)print d[k],"="substr(k,4)}' | sort -rn`

**Done is an empty print, not a judgement.** A printed word or phrase is cut or reworded in every string but one; it is never classified. A page that stops with content words at four to seven uses ('untagged' 19, 'month' 6, 'wait' 6) and calls them identifiers in template strings is wrong: the command does not read identifiers, so a printed line is text a viewer reads, a number with its unit, or a constant read in two places (`=name`). A row's own data (an Issue id, a source name per row) lives in the fixture, which the command does not read. Put every string the page writes in the page's `.tsx` files, so none hides in a helper the count skips. Paste the first and last run in your report.

**One quantity, one word.** The count cannot see one quantity under two words: one page said "usable" on the left and "clear" on the right for the same hours, another "Research US$12" in a label, the table and the footer. After the count, list the page's measures (hours, spend, a rate, a state) and for each write every word the page uses for it, with `rg -ci '<word>|<synonym>' <page dir>`; a measure with two words keeps one, in every string.

Then the read-aloud pass, a required `## Read aloud` section of the design file (the worked pass above names the four repeats the count cannot see), from the 1800 rest shot and not from the code (the rendered strings, grouped by what they say: the worked pass above): read the frame top to bottom, aloud, and write one line per fact (a measure, a name, a window, a limit) with every place it stands (hero, pill, mark label, subtitle, footer, legend, axis title, column). A fact on two lines keeps one place, and the pass cuts it rather than keeping it with a reason. One measure with two numbers (a pace in a pill, a mark and a subtitle, each a different number) is a defect, not a repeat. The empty sentence stands on one card; where the whole page is empty, the first part (the strip or the lead card) states the cause and the one next step, and every other part holds a dash or a short caption, never the kit's default sentence and never `empty={null}`. A sort and a window are facts.

Six pages counted with the scan above (an earlier count printed `header`, `label`, `header head` and four phrases, none of it text):

- First page: `site` five, `moon` four, `drive` four, `clear` four, `drive min`. Real strings: "Site", "Sites", "No site has sent…", "Clear under …%", "h clear", "Clear, moon up" against "h usable".
- Second page: `used` four, `pool` four ("Used, %", "Used share by day", "Pool use before expiry").
- Third page: `collector` four, `busy` four, `nearly full`, `collector did`.
- Fourth page: `outage` four, `measured` four, `cycles` four.
- Fifth page: `issue` four ("Open Issues", "Issues by state", the list error and empty).
- Sixth page: empty.

An earlier command printed nothing on six pages that still repeated themselves. The command above prints, on those pages:

- First page: `6 sleep`, `4 logged`, `4 =no_sleep`, `4 [sleep logged]`, `2 =overlabel`, `2 [over 75]`, `2 [of 100]`, `2 [low #]`.
- Second page: `4 logged`, `3 =not_logged`, `3 [0 %]`, `2 =first_week`, `2 [first week]`.
- Third page: `2 =base`, `2 [# leads]`.
- Fourth page: `5 pages`, `4 =unit`, `3 =no_pages`, `3 [page count]`, `2 =sitting`, `2 =log_error`, `2 =delta_base`, `2 [tracker did]`.
- Fifth page: `6 recovery`, `5 weekly`, `5 volume`, `4 weeks`, `4 training`, `4 session`, `4 intensity`, `4 ahead`, `4 =recovery`, `3 =volume`, `3 =ahead`, `3 [weekly volume]`, `2 =volume_kg`, `2 =no_training`, `2 =intensity`, `2 [session intensity]`, `2 [# weeks]`.
- Sixth page: `5 mean`, `5 highest`, `4 =arc`, `3 =mean`, `3 =highest`, `2 =cost`, `2 [ridge cost]`, `2 [mean #]`, `2 [highest #]`.

Read `2 =overlabel` as one string drawn in two slots ('3 h over 75'), `4 =unit` as the unit string 'pages/h' read in four places, `3 =ahead` as 'Ahead' in unit, zone and column and `[low #]` as 'Low 5' on a label and on a mark. A constant read twice is a repeat to cut, not an identifier to explain.

A first run of the count names the repeat, and one count already says what to cut:

- `median` ten times: "April, median of all tests", "Median of each day's 48 tests", legend "Median test", the table subtitle. The figure's period slot says it once; the legend and the axis title drop it.
- `shipped` twenty and `issues` eleven: "Issues shipped" as title, unit and axis title, "per Issue" in four places, "Shipped nothing 2 projects" restating the two zero bars. The title says it; the axis title is the unit alone.
- `days` eleven: the hero, the chart subtitle and the rows each say "trained" and "days". The hero keeps the count; the subtitle and the rows carry other facts.
- `pages` eleven, `views` eleven: the seven named pages on the plot, in the summary and in the table. The plot names them; the summary counts them; the table lists only what neither says.
- The block reason on the bar, in Longest wait and in the table; the empty sentence on three cards. One place for the reason, and at 390 a wrapping line instead of the mark ([charts](charts.md)); one card for the empty sentence.
- `limit` twelve: the legend, the "Near, 90%+" label, the status pill and the red dots say "past a line" four times, and the context line and footer repeat the missing-limit fact. The legend names the form, the dots carry it.

Pages repeated in the same ways, and the count catches each:

- `better when: all eight cards`, `period: summary, every axis`, `verdict word: beside its pill`, `vs last week: pill, footer`. The direction is one sentence in the card's `info`, the period one phrase in the period slot, the verdict the pill alone.
- `the top Issue: hero, bar list, table`, plus near-twin card titles and the empty line three times. The top Issue stands in the hero and on its bar-list row; the table says only who waits.
- `the contract: pill, legend caption, footer`. One of the three stays, in the pill.
- `the year: three places`; the legend repeated its card's title and the hero's 38 %. A legend that names what the card title names is cut.
- `change vs September: subtitle, footer`; the subtitle repeated the title.
- `7 days: three places`, `each day's count: on the bar, in the list header`.

### Worked: a share and its threshold read as one line

A share against a limit is one line beside the hero, with the threshold drawn where the marks allow: "27 % strong, under 40 %", the 40 % line a `refLines` rule on the chart. One page printed "4 of 15" and left the 40 % line to the legend; another stated a "too weak" total against nothing.

### Worked: numbers

The hero, the tooltip and the announcement go through one `useFormat` call at one precision: a hero read "-56.083 dBm" with an ASCII hyphen beside a rounded tooltip. A negative uses a true minus (U+2212), and one currency style per page ("$" beside "US$" read as two currencies).

### Worked: an unfinished period is named

A partial week is drawn lighter and named where the reader reads it: "W16 so far" in the card's period slot, never the lighter fill alone. A target for it is prorated, or its pill is `polarity: 'neutral'` and stays untinted: one page printed a red shortfall on a week not over.

## Say each thing once

- A figure appears once per page, in the summary line, the card or the table cell, whichever the reader reaches first.
- A qualifier appears once: "681 allowed" in the figure and again in the caption is one qualifier too many. Put it where the reader looks first and cut the other.
- A caption sits under a subject already named by its card title; repeat the subject in the caption and it clips at 390 first.
- A label that restates the value beside it is cut.

## Control and action labels

- A button names its action by verb and object ("Compact now"); the primary action is one per view, in the page bar. [type:PageBarProps]
- An icon-only control carries an accessible name. [lint:primitive-bypass]

not guarded:

- Avoid filler: "Overview" or "Dashboard" alone, "Metrics", "Stay informed", "Oops", "No data".
- Avoid title case, a trailing colon on a caption and a leading "+" on a delta that has its own sign.
- Write no raw key or parameter dump into a footer.
- Print no 0 and no "None" for a figure nobody counted; a zero is a measurement.
- Print no bare ISO timestamp where a reader wants the age; the absolute time sits on hover.

The same repeats appear on pages of tables:

- `needs a fix`: strip and 'Failing' column; `F-232`: twice; `retry`: three buttons; a label on every line of a phone card. One verdict word, one id place, one Retry for the page.
- `the go windows: hero, bands, table`. The hero states the next window, the bands carry the words, the table lists only what they do not.
- `lane: a column that repeats each group header`, `you: every Waiting on cell and 'Author: you'`, `5 rows: beside the 5 in the card`. A group header says it once; a column that repeats it is cut.
- `points: axis title, y ticks, labelled bars, hero unit`, 'Points (pts):' on every phone card, `'Not started, 13 pts'` beside a Points column of 13, `days left: '3 days left' and 'day 7 of 10'`. A unit stands once, beside the figure; a period stands in one phrase.
- `5 h free: hero and mark`, `longest block: legend and mark`. The mark carries it, the legend names the form.
- `issues held up: hero unit, axis title, label`, `ahead in N h: rows, footer, rule`, the empty sentence twice.

The repeat that you cannot see by reading is the one a unit or a window makes: list where each unit and each window is stated, then keep the one a mark carries.

They appear on pages of other shapes too, each a row the count keeps above 1:

- `frost hours: zone label, table meter and number, status 'Longest Thu, 10 h'`. The zone label keeps the hours where the mark carries them; the meter draws them and the status names only the night.
- `Overdue: title, zone, legend, 16 cells, chip, focus chip` and `the empty sentence: four cards`. One word is the title; the empty sentence is one row per page, stated by the card that is empty and nowhere else.
- `the empty sentence: three places`, two legends for one set of series. One legend, one empty sentence.
- `line drop: hero sentence and zone label`, with 'Line drop' beside the chart's 'Drop' (one item, one name). The hero is the answer and the zone label is the mark; they do not both say it.
- `nothing waits: five rows`, 'Nothing submitted' beside a 0, `the sort: said twice`. A zero beside its own empty sentence is two places; a sort named in the header and a caption is two.
- `next 2 h: three`, `the 9.0 peak: twice`, `now / at arrival: per card`. A window is a fact: state it once for the page, never per card.
