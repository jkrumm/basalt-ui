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

Cut to what the marks cannot say: the figure `13` with its pill `of 19`, one annotation on the mark that needs the eye ("Worst: payments, 4 h"), and nothing else. The headline sentence, the sub line, the limit label (the line is the limit) and the badge (the list is the affected items) each restate the figure. Six cycle 3 builds (c10, c11, c12, c13, n02, n12) lost word economy to this shape; read each line aloud against the mark beside it, and cut every line that says what the figure, its pill or the annotation already says.

### Worked: the period said once

A build said "last 30 days" in the title, the caption, the axis title and the footer, and the hero repeated the count the chart's pill carried. Keep the period in the card's `figure` period slot and the count in the figure; the axis title names the unit only ("Deploys"), the footer holds two facts the marks do not (the busiest day, the slowest run). Six cycle 4 builds (n13, n09, c15, c14, n04, n16) stated one fact three to five times.

### Worked: a number four times, a leader three times

n10 printed "19.4 kt" in the hero, the bracket, the footer and the table; n18 named its leader in the hero, the list and a note. Keep it where the reader looks first and where a mark can carry it (the bracket on the chart), and let the hero, period, pill, footer and list each state something the others do not (n10 .38, n18 .76, n03 .9, n07 .21, n14 .50, n17 .62).

### Worked: the fact count

The count is a command on your page, not a table you write. Cycle 10 asked for a table of facts and cycle 11 got none that held: three builders could not write `docs/design/<screen>.md` (the trial fences a builder to its case directory), and n48 wrote one and cut nothing, because a table lists the facts its author already said once. The repeats that cost X1 were never one phrase: one content word spread over the title, the unit, the axis title, the legend and the footer ("median" ten times on n46, "shipped" twenty on n50), or one fact in four phrasings. The count finds the first kind and the phrase pass finds some of the second; reading the frame aloud finds the rest.

Run it after the first typecheck and before you open the 1800 shot, and again after every cut. It reads the words a viewer reads in your page's `.tsx` files: JSX text, and quoted or template strings that hold a space or start with a capital. Code never counts: imports, `className`, `key`, `aria-*`, one-word lowercase keys and the code inside `${…}`. The scan takes each string whole from left to right, so an option key between two strings (`header:`, `label:`) is never text. A property name is not a word: `${x.label}`, `${w.done}` and `${d.flat}` hold the place of a value, shown as `#`, and cycle 14's builders reworded four pages until the count was silent, because the cycle-13 command read `${w.done}` as `4 done` and `4 {w}`, which hid the real repeats. The count now sees three things it did not: a number and its unit or label as a phrase (`[3 h]`, `[over 75]`, `[low #]` for `'Low ' + a.battery` and `'Low ' + b.battery`); a string held in a constant (`const AHEAD = 'Ahead'`, a template in a local) as one string at each place it is read, printed as `3 =ahead` when it is read in three places, from two up; and a `${UPPER_CASE}` constant as a use of that constant. A string counts a word once. It prints each word said in four or more strings and each two-word phrase said in two or more:

`rg -IN --no-filename -g '*.tsx' -v '^\s*(import |\} from |//|\*|/\*)' <page dir> | perl -0777 -pe '%k=();while(/\bconst\s+(\w+)\s*(?::\s*string\s*)?=\s*(["\x27\x60])((?:(?!\2)[^\\\n]|\\.)*)\2[ \t]*(?:as const)?[ \t]*\n/g){($i,$j,$l)=($1,$2,$3);$k{$i}=[$j,$l] if ($l=~/^[A-Z]/||$l=~/[^\w\\-]/)&&($l=~s/\$\{[^}]*\}//gr)=~/[A-Za-z]{2}/}s/\bconst\s+(\w+)\s*(?::\s*string\s*)?=\s*(["\x27\x60])(?:(?!\2)[^\\\n]|\\.)*\2[ \t]*(?:as const)?[ \t]*\n/exists $k{$1}?"\n":$&/ge;for $n(keys %k){($q,$t)=@{$k{$n}};s{\$\{\s*\Q$n\E\s*\}}{ uu_$n $t }g;s{(?<![\w.\$])\b\Q$n\E\b}{$q uu_$n $t $q}g;s/(["\x27])\s*\+\s*[A-Za-z_][\w.]*(\([^)]*\))?/ nn_$1/g}' | sed -E 's/\$\{([A-Z][A-Z0-9_]*)\}/ vv_\1 /g; s/\$\{[^}]*\}/ nn_ /g; s/(className|key|id|type|role|variant|size|tone|href|style|field|accessorKey|data-[a-z-]+|aria-[a-z]+|aria-[a-z]+)=("[^"]*"|\{[^}]*\})//g; s/%/ % /g' | perl -nle 'while(/("(?:[^"\\]|\\.)*"|(?<![A-Za-z])\x27(?:[^\x27\\]|\\.)*\x27|\x60[^\x60]*\x60|(?<![=-])>[^<>{}]{3,}<)/g){$t=$1;$c=substr($t,0,1);if($c eq "\x22"||$c eq "\x27"){$t=substr($t,1,-1);next unless $t=~/^[A-Z]/||$t=~/\s/}print $t}' | awk 'function isn(t){return t ~ /^[0-9]+$/}BEGIN{k=split("the|and|for|with|from|that|are|was|not|has|have|its|you|your|when|here|there|what|which|been|were|will|then|them|they|their|also|just|some|such|very|about|after|before|between|at|to|in|on|by|is|as|or|vs",z,"|");for(i=1;i<=k;i++)q[z[i]]=1;n=split("the|and|for|with|from|this|that|are|was|not|has|have|per|its|all|one|any|more|than|into|off|out|you|your|each|when|over|only|here|there|what|which|been|were|will|then|them|they|their|also|just|some|such|very|about|after|before|between",a,"|");for(i=1;i<=n;i++)s[a[i]]=1}{m=split(tolower($0),w,/[^a-z0-9_%]+/);delete u;delete v;for(i=1;i<=m;i++){x=w[i];if(x ~ /^uu_/){if(!(x in u)){u[x]=1;d[x]++}continue};if(x ~ /^vv_/){if(!(x in u)){u[x]=1;c["{"substr(x,4)"}"]++}continue};if(length(x)>=4&&!(x in s)&&!(x in u)){u[x]=1;c[x]++}};for(i=1;i<m;i++){x=w[i];y=w[i+1];na=isn(x);nb=isn(y);if(x ~ /^[uv][uv]_/||y ~ /^[uv][uv]_/||x==""||y==""||(na&&nb)||(x=="nn_"&&y=="nn_"))continue;if(na||nb){if((na?y:x) in q||(na?y:x)=="nn_")continue}else if(x in s||y in s||length(x)<3||length(y)<3)continue;p=x" "y;if(!(p in v)){v[p]=1;b[p]++}}}END{for(k in c)if(c[k]>=4)print c[k],k;for(k in b)if(b[k]>=2){p=k;gsub(/nn_/,"#",p);print b[k],"["p"]"};for(k in d)if(d[k]>=2)print d[k],"="substr(k,4)}' | sort -rn`

**Done is an empty print, not a judgement.** A printed word or phrase is cut or reworded in every string but one; it is never classified. Cycle 12's builders stopped with content words at four to seven uses ('untagged' 19, 'month' 6, 'wait' 6) and called them identifiers in template strings; the command no longer reads those, so a printed line is text a viewer reads, a number with its unit, or a constant read in two places (`=name`). A row's own data (an Issue id, a source name per row) lives in the fixture, which the command does not read. Put every string the page writes in the page's `.tsx` files, so none hides in a helper the count skips. Paste the first and last run in your report.

**One quantity, one word.** The count cannot see one quantity under two words: n57 said "usable" on the left and "clear" on the right for the same hours (n57 .5), n58 "Research US$12" in a label, the table and the footer. After the count, list the page's measures (hours, spend, a rate, a state) and for each write every word the page uses for it, with `rg -ci '<word>|<synonym>' <page dir>`; a measure with two words keeps one, in every string.

Then the read-aloud pass, from the 1800 rest shot and not from the code: read the frame top to bottom, aloud, and write one line per fact (a measure, a name, a window, a limit) with every place it stands (hero, pill, mark label, subtitle, footer, legend, axis title, column). A fact on two lines keeps one place. One measure with two numbers (n52's pace in a pill, a mark and a subtitle, each a different number) is a defect, not a repeat. The empty sentence stands on one card; a sort and a window are facts.

Cycle 13's builds, counted with the scan above (the old count printed `header` on n58, `label` and `header` on n60, `header head` on n61 and four phrases on n59; none of it text):

- n57: `site` five, `moon` four, `drive` four, `clear` four, `drive min`. Real strings: "Site", "Sites", "No site has sent…", "Clear under …%", "h clear", "Clear, moon up" against "h usable".
- n58: `used` four, `pool` four ("Used, %", "Used share by day", "Pool use before expiry").
- n59: `collector` four, `busy` four, `nearly full`, `collector did`.
- n60: `outage` four, `measured` four, `cycles` four.
- n61: `issue` four ("Open Issues", "Issues by state", the list error and empty).
- n62: empty.

Cycle 14's six builds each ended at an empty print with the cycle-13 command and lost X1 on all six. The command above prints, on the round-0 sources of those builds (`.evidence/v3-shots/expression-14/src-r0`; the old command printed nothing on any of them):

- n63: `6 sleep`, `4 logged`, `4 =no_sleep`, `4 [sleep logged]`, `2 =overlabel`, `2 [over 75]`, `2 [of 100]`, `2 [low #]`.
- n64: `4 logged`, `3 =not_logged`, `3 [0 %]`, `2 =first_week`, `2 [first week]`.
- n65: `2 =base`, `2 [# leads]`.
- n66: `5 pages`, `4 =unit`, `3 =no_pages`, `3 [page count]`, `2 =sitting`, `2 =log_error`, `2 =delta_base`, `2 [tracker did]`.
- n67: `6 recovery`, `5 weekly`, `5 volume`, `4 weeks`, `4 training`, `4 session`, `4 intensity`, `4 ahead`, `4 =recovery`, `3 =volume`, `3 =ahead`, `3 [weekly volume]`, `2 =volume_kg`, `2 =no_training`, `2 =intensity`, `2 [session intensity]`, `2 [# weeks]`.
- n68: `5 mean`, `5 highest`, `4 =arc`, `3 =mean`, `3 =highest`, `2 =cost`, `2 [ridge cost]`, `2 [mean #]`, `2 [highest #]`.

Read `2 =overlabel` as one string drawn in two slots (n63's '3 h over 75', .6), `4 =unit` as the unit string 'pages/h' read in four places (n66 .31), `3 =ahead` as 'Ahead' in unit, zone and column (n67 .36) and `[low #]` as 'Low 5' on a label and on a mark (n63 .6). A constant read twice is a repeat to cut, not an identifier to explain.

Cycle 11 had a first run on every page that would have named the repeat, and one count already says what to cut:

- n46 (.15): `median` ten times: "April, median of all tests", "Median of each day's 48 tests", legend "Median test", the table subtitle. The figure's period slot says it once; the legend and the axis title drop it.
- n50 (.58): `shipped` twenty and `issues` eleven: "Issues shipped" as title, unit and axis title, "per Issue" in four places, "Shipped nothing 2 projects" restating the two zero bars. The title says it; the axis title is the unit alone.
- n48 (.36): `days` eleven: the hero, the chart subtitle and the rows each say "trained" and "days". The hero keeps the count; the subtitle and the rows carry other facts.
- n49 (.47): `pages` eleven, `views` eleven: the seven named pages on the plot, in the summary and in the table. The plot names them; the summary counts them; the table lists only what neither says.
- n47 (.26): the block reason on the bar, in Longest wait and in the table; the empty sentence on three cards. One place for the reason, and at 390 a wrapping line instead of the mark ([charts](charts.md)); one card for the empty sentence.
- n45 (.6): `limit` twelve: the legend, the "Near, 90%+" label, the status pill and the red dots say "past a line" four times, and the context line and footer repeat the missing-limit fact. The legend names the form, the dots carry it.

Cycle 8 lost a P2 or a P3 to it in every case, and the count would have caught each:

- n27 (.8): `better when: all eight cards`, `period: summary, every axis`, `verdict word: beside its pill`, `vs last week: pill, footer`. The direction is one sentence in the card's `info`, the period one phrase in the period slot, the verdict the pill alone.
- n32 (.60): `the top Issue: hero, bar list, table`, plus near-twin card titles and the empty line three times. The top Issue stands in the hero and on its bar-list row; the table says only who waits.
- n30 (.43): `the contract: pill, legend caption, footer`. One of the three stays, in the pill.
- n29 (.33): `the year: three places`; the legend repeated its card's title and the hero's 38 %. A legend that names what the card title names is cut.
- n28 (.21): `change vs September: subtitle, footer`; the subtitle repeated the title.
- n31 (.49): `7 days: three places`, `each day's count: on the bar, in the list header`.

### Worked: a share and its threshold read as one line

A share against a limit is one line beside the hero, with the threshold drawn where the marks allow: "27 % strong, under 40 %", the 40 % line a `refLines` rule on the chart. n08 printed "4 of 15" and left the 40 % line to the legend; n19 stated a "too weak" total against nothing.

### Worked: numbers

The hero, the tooltip and the announcement go through one `useFormat` call at one precision: n19's hero read "-56.083 dBm" with an ASCII hyphen beside a rounded tooltip. A negative uses a true minus (U+2212), and one currency style per page ("$" beside "US$" read as two currencies: c16).

### Worked: an unfinished period is named

A partial week is drawn lighter and named where the reader reads it: "W16 so far" in the card's period slot, never the lighter fill alone (n15, n20). A target for it is prorated, or its pill stays neutral: n15 printed a red shortfall on a week not over.

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

Cycle 9 repeated it on pages of tables, again in every case:

- n33 (.9): `needs a fix`: strip and 'Failing' column; `F-232`: twice; `retry`: three buttons; a label on every line of a phone card. One verdict word, one id place, one Retry for the page.
- n34 (.17): `the go windows: hero, bands, table`. The hero states the next window, the bands carry the words, the table lists only what they do not.
- n36 (.38): `lane: a column that repeats each group header`, `you: every Waiting on cell and 'Author: you'`, `5 rows: beside the 5 in the card`. A group header says it once; a column that repeats it is cut.
- n37 (.45, .48, .49): `points: axis title, y ticks, labelled bars, hero unit`, 'Points (pts):' on every phone card, `'Not started, 13 pts'` beside a Points column of 13, `days left: '3 days left' and 'day 7 of 10'`. A unit stands once, beside the figure; a period stands in one phrase.
- n35 (.26): `5 h free: hero and mark`, `longest block: legend and mark`. The mark carries it, the legend names the form.
- n38 (.61): `issues held up: hero unit, axis title, label`, `ahead in N h: rows, footer, rule`, the empty sentence twice.

The repeat that a builder cannot see by reading is the one a unit or a window makes: list where each unit and each window is stated, then keep the one a mark carries.

Cycle 10 repeated it in all six cases, each a row the second count would have kept above 1:

- n39 (.8): `frost hours: zone label, table meter and number, status 'Longest Thu, 10 h'`. The zone label keeps the hours where the mark carries them; the meter draws them and the status names only the night.
- n40 (.23): `Overdue: title, zone, legend, 16 cells, chip, focus chip` and `the empty sentence: four cards`. One word is the title; the empty sentence is one row per page, stated by the card that is empty and nowhere else.
- n41 (.34): `the empty sentence: three places`, two legends for one set of series. One legend, one empty sentence.
- n42 (.43): `line drop: hero sentence and zone label`, with 'Line drop' beside the chart's 'Drop' (one item, one name). The hero is the answer and the zone label is the mark; they do not both say it.
- n43 (.52): `nothing waits: five rows`, 'Nothing submitted' beside a 0, `the sort: said twice`. A zero beside its own empty sentence is two places; a sort named in the header and a caption is two.
- n44 (.59): `next 2 h: three`, `the 9.0 peak: twice`, `now / at arrival: per card`. A window is a fact: state it once for the page, never per card.
