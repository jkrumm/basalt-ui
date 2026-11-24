// The app's series colours, authored once. Import-free: `basalt-ui tokens:css --extra` reads this file
// and writes `--basalt-<group>-<key>` for each pair (and the typed keys), so a chart takes the pair and
// an HTML mark takes `groupTokens('<group>', tokens.series.<group>).<key>`. This is the one file that
// writes raw colour; a pair is `{ light, dark }` (lighter on dark, deeper on light).
//
//   export default {
//     series: {
//       app: {
//         sessions: { light: '#2871c7', dark: '#5190f7' },
//       },
//     },
//   } as const
export default {
  series: {
    /** Issues per state (scenario expr-n95): the accent is the worst hour or day, painted by the bar `highlight`; every other peak rests in a pale ink step, the average in the dark one, the half-peak rule in a mid step. */
    n95: {
      peak: { light: '#b0b0b0', dark: '#666666' },
      avg: { light: '#262626', dark: '#e6e6e6' },
      rule: { light: '#6b6b6b', dark: '#a8a8a8' },
    },
    /** Review seats (scenario expr-n88): the accent is the light seat, the seat the question is about; the lead seat is the dark ink step. */
    n88: {
      light: { light: '#2871c7', dark: '#5190f7' },
      lead: { light: '#262626', dark: '#e6e6e6' },
    },
    /** Photo library (scenario expr-n71): the accent is the kept photos, a brand token set by the chart's highlight; the other ratings sit in one mid ink step. */
    n71: {
      photos: { light: '#8c8c8c', dark: '#8c8c8c' },
    },
    /** Factory week (scenario expr-n65): the status red is dropped work, the one outcome that needs a hand; done is the dark ink step, cancelled and still-open Issues paler ones; the four finding classes take four ink steps, the leader the darkest; idle hours sit in a mid step. */
    n65: {
      done: { light: '#262626', dark: '#e6e6e6' },
      dropped: { light: '#af293e', dark: '#e46360' },
      cancelled: { light: '#8c8c8c', dark: '#8c8c8c' },
      open: { light: '#c2c2c2', dark: '#555555' },
      gate: { light: '#262626', dark: '#e6e6e6' },
      review: { light: '#5c5c5c', dark: '#b4b4b4' },
      spec: { light: '#858585', dark: '#9a9a9a' },
      deploy: { light: '#adadad', dark: '#737373' },
      idle: { light: '#6b6b6b', dark: '#a8a8a8' },
    },
    /** Training block (scenario expr-n67): the accent is the lift that stopped rising; the other lifts take ink steps from dark to pale, the first-session rule a mid one; weekly volume, recovery and session intensity sit in ink steps. */
    n67: {
      press: { light: '#2871c7', dark: '#5190f7' },
      squat: { light: '#262626', dark: '#e6e6e6' },
      deadlift: { light: '#5c5c5c', dark: '#b4b4b4' },
      bench: { light: '#8a8a8a', dark: '#8f8f8f' },
      start: { light: '#4a4a4a', dark: '#c4c4c4' },
      volume: { light: '#6b6b6b', dark: '#a8a8a8' },
      recovery: { light: '#262626', dark: '#e6e6e6' },
      intensity: { light: '#858585', dark: '#9a9a9a' },
    },
    /** Harbour waves (scenario expr-n56): the accent is the calmest window, a tint from the brand token; the harbour line sits in the dark ink step, the four offshore points in a pale one, the limit rule in a mid one, and the status red marks the hours over the limit. */
    harbour: {
      harbour: { light: '#262626', dark: '#e6e6e6' },
      offshore: { light: '#b0b0b0', dark: '#666666' },
      limit: { light: '#4a4a4a', dark: '#c4c4c4' },
      over: { light: '#af293e', dark: '#e46360' },
    },
    /** Sleep stages (scenario expr-n12): one hue per stage, deep darkest, REM the violet. */
    sleep: {
      deep: { light: '#2b4a9b', dark: '#6c8cf0' },
      light: { light: '#4f93c9', dark: '#8dbbe6' },
      rem: { light: '#8a4fc7', dark: '#b68cf2' },
      need: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Cut progress (scenario expr-n16): the accent is the question's series; daily readings, lean mass and the plan sit in ink steps. */
    cut: {
      trend: { light: '#2871c7', dark: '#5190f7' },
      daily: { light: '#7a7a7a', dark: '#9c9c9c' },
      plan: { light: '#4a4a4a', dark: '#c4c4c4' },
      lean: { light: '#6b6b6b', dark: '#a8a8a8' },
    },
    /** Job schedule (scenario expr-n09): the accent is the next run; the rest of the 24 h and the later jobs sit in ink steps. */
    schedule: {
      next: { light: '#2871c7', dark: '#5190f7' },
      soon: { light: '#262626', dark: '#e6e6e6' },
      later: { light: '#9a9a9a', dark: '#7d7d7d' },
    },
    /** Host memory (scenario expr-n17): the accent is the pressure the question asks about; swap and the limit rule sit in ink steps. */
    mem: {
      pressure: { light: '#2871c7', dark: '#5190f7' },
      swap: { light: '#7a7a7a', dark: '#9c9c9c' },
      limit: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Queue waits (scenario expr-n18): finished wait hours sit in an ink step; the accent is the wait still open. */
    wait: {
      done: { light: '#6b6b6b', dark: '#a8a8a8' },
      open: { light: '#2871c7', dark: '#5190f7' },
    },
    /** Training load (scenario expr-n03): the accent is this week, done and planned; past weeks and the average rule sit in ink steps. */
    load: {
      past: { light: '#7a7a7a', dark: '#9c9c9c' },
      done: { light: '#2871c7', dark: '#5190f7' },
      planned: { light: '#2871c7', dark: '#5190f7' },
      out: { light: '#c07e3c', dark: '#f9a13d' },
      average: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Observing nights (scenario expr-n07): the accent is the best night; go sits in ink, marginal in a mid step, ruled-out nights in a pale step. */
    night: {
      best: { light: '#2871c7', dark: '#5190f7' },
      go: { light: '#262626', dark: '#e6e6e6' },
      marginal: { light: '#6b6b6b', dark: '#a3a3a3' },
      out: { light: '#b0b0b0', dark: '#666666' },
    },
    /** Household wealth (scenario expr-n14): the accent is the depot, the account that moves; cash and the rest sit in ink steps, and money paid in is the depot's baseline. */
    wealth: {
      cash: { light: '#3d3d3d', dark: '#d4d4d4' },
      depot: { light: '#2871c7', dark: '#5190f7' },
      rest: { light: '#a3a3a3', dark: '#757575' },
      paidIn: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Wind models (scenario expr-n10): one hue per forecast model; the ensemble band sits in the neutral `other` grey. */
    wind: {
      ecmwf: { light: '#2871c7', dark: '#5190f7' },
      gfs: { light: '#c07e3c', dark: '#f9a13d' },
      icon: { light: '#10781c', dark: '#65d289' },
      arome: { light: '#8a4fc7', dark: '#b68cf2' },
      other: { light: '#7a7a7a', dark: '#9c9c9c' },
    },
    /** Weekly volume (scenario expr-n20): the accent is the work sets that count toward the range; warm-ups, drop sets and AMRAPs sit in ink steps, the typical rule in a mid step. */
    volume: {
      warmup: { light: '#c2c2c2', dark: '#5c5c5c' },
      work: { light: '#2871c7', dark: '#5190f7' },
      drop: { light: '#8a8a8a', dark: '#8f8f8f' },
      amrap: { light: '#262626', dark: '#e6e6e6' },
      out: { light: '#c07e3c', dark: '#f9a13d' },
      typical: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Line interventions (scenario expr-n21): the accent is the drop a reboot met; other actions sit in an ink step, drops left alone in a pale one, the median rule in a mid step. */
    line: {
      rebooted: { light: '#2871c7', dark: '#5190f7' },
      other: { light: '#5c5c5c', dark: '#c8c8c8' },
      alone: { light: '#9a9a9a', dark: '#7d7d7d' },
      median: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Backup radio path (scenario expr-n19): the accent is the Wi-Fi signal and its round trip; noise and the limit sit in ink steps, the wired path in the neutral `other` grey. */
    radio: {
      signal: { light: '#2871c7', dark: '#5190f7' },
      noise: { light: '#8a8a8a', dark: '#8f8f8f' },
      limit: { light: '#4a4a4a', dark: '#c4c4c4' },
      other: { light: '#7a7a7a', dark: '#9c9c9c' },
    },
    /** Model choice (scenario expr-c16): the accent is the recommended model; models that can take the chat sit in an ink step, models that cannot in a pale one, the current model's cost rule in a mid step. */
    model: {
      pick: { light: '#2871c7', dark: '#5190f7' },
      fits: { light: '#262626', dark: '#e6e6e6' },
      blocked: { light: '#9a9a9a', dark: '#7d7d7d' },
      current: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** AI gateway spend (scenario expr-n24): the accent is production, the share the question asks about; eval, verify and other sit in ink steps, spend with no purpose in a pale one. */
    spend: {
      production: { light: '#2871c7', dark: '#5190f7' },
      eval: { light: '#262626', dark: '#ececec' },
      verify: { light: '#6b6b6b', dark: '#b4b4b4' },
      other: { light: '#a0a0a0', dark: '#7f7f7f' },
      unset: { light: '#d6d6d6', dark: '#4a4a4a' },
    },
    /** Reading goal (scenario expr-n25): the accent is the books finished; the even pace the goal implies and the goal rule sit in an ink step. */
    reading: {
      finished: { light: '#2871c7', dark: '#5190f7' },
      pace: { light: '#4a4a4a', dark: '#c4c4c4' },
      stalled: { light: '#af293e', dark: '#e46360' },
      reading: { light: '#6b6b6b', dark: '#a8a8a8' },
    },
    /** Line path (scenario expr-n26): the accent is the hop the answer names; the others sit in ink steps. */
    path: {
      culprit: { light: '#2871c7', dark: '#5190f7' },
      strong: { light: '#4a4a4a', dark: '#d4d4d4' },
      mid: { light: '#7a7a7a', dark: '#9c9c9c' },
      soft: { light: '#b0b0b0', dark: '#666666' },
    },
    /** Fitness trend (scenario expr-n22): the accent is resting heart rate; HRV sits in an ink step, the change threshold in a mid step. */
    fitness: {
      rhr: { light: '#2871c7', dark: '#5190f7' },
      hrv: { light: '#262626', dark: '#e6e6e6' },
      limit: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Shipped Issues (scenario expr-n31): the accent is features; fixes and chores sit in ink steps, the deploy rule in an ink step. */
    ship: {
      feat: { light: '#2871c7', dark: '#5190f7' },
      fix: { light: '#4a4a4a', dark: '#c4c4c4' },
      chore: { light: '#9a9a9a', dark: '#7d7d7d' },
      deploy: { light: '#262626', dark: '#e6e6e6' },
    },
    /** Household spending (scenario expr-n28): the accent is the category that moved most or is in focus; other categories and months sit in an ink step, the last complete month in a dark one, the partial month in a pale one. */
    household: {
      mover: { light: '#2871c7', dark: '#5190f7' },
      rest: { light: '#6b6b6b', dark: '#a8a8a8' },
      partial: { light: '#b8b8b8', dark: '#5c5c5c' },
      october: { light: '#262626', dark: '#e6e6e6' },
    },
    /** Owner queue (scenario expr-n38): the accent is the decision, the kind that waits on a person; reviews sit in a dark ink step, chores in a pale one, the 24 h rule in a mid step. */
    owner: {
      decision: { light: '#2871c7', dark: '#5190f7' },
      review: { light: '#4a4a4a', dark: '#d4d4d4' },
      chore: { light: '#9a9a9a', dark: '#7d7d7d' },
      rule: { light: '#6b6b6b', dark: '#a8a8a8' },
      soon: { light: '#c07e3c', dark: '#f9a13d' },
    },
    /** Harbour bar (scenario expr-n34): tide in the dark ink step, swell in a mid step; the two limits sit in rule steps, the go windows are the accent's tint. */
    bar: {
      tide: { light: '#262626', dark: '#e6e6e6' },
      swell: { light: '#7a7a7a', dark: '#9c9c9c' },
      need: { light: '#4a4a4a', dark: '#c4c4c4' },
      limit: { light: '#6b6b6b', dark: '#a8a8a8' },
    },
    /** Sprint (scenario expr-n37): the accent is the done work, from highlight; the other statuses sit in an ink step, the pace rule in a mid step. */
    sprint: {
      points: { light: '#6b6b6b', dark: '#a8a8a8' },
      pace: { light: '#262626', dark: '#e6e6e6' },
    },
    /** Task list (scenario expr-n40): overdue takes the status red, the tasks due today the accent, later ones an ink step; in the weekly backlog the list that keeps growing takes the dark ink step and the other lists share a mid one, tasks done per day sit in a dark ink step and the today rule in the same one. */
    task: {
      overdue: { light: '#af293e', dark: '#e46360' },
      today: { light: '#2871c7', dark: '#5190f7' },
      later: { light: '#7a7a7a', dark: '#9c9c9c' },
      grows: { light: '#262626', dark: '#e6e6e6' },
      lists: { light: '#6b6b6b', dark: '#a8a8a8' },
      done: { light: '#3d3d3d', dark: '#d4d4d4' },
      rule: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Router health (scenario expr-n42): the accent is memory, the load that rose before the drop; CPU sits in an ink step, the healthy limit in a mid step, the line events in the dark one. */
    router: {
      memory: { light: '#2871c7', dark: '#5190f7' },
      cpu: { light: '#4a4a4a', dark: '#c4c4c4' },
      limit: { light: '#6b6b6b', dark: '#a8a8a8' },
      event: { light: '#262626', dark: '#e6e6e6' },
    },
    /** Night frost (scenario expr-n39): the accent is the one model that runs warm; the other two models sit in ink steps, the dew point in a pale step, the 0 °C rule in a mid step. */
    frost: {
      warm: { light: '#2871c7', dark: '#5190f7' },
      first: { light: '#262626', dark: '#e6e6e6' },
      second: { light: '#6b6b6b', dark: '#a8a8a8' },
      dew: { light: '#a3a3a3', dark: '#757575' },
      limit: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Model router (scenario expr-n41): one ink step per model in the chart and the list; the accent is not a model colour. */
    served: {
      atlasLarge: { light: '#262626', dark: '#ececec' },
      atlasFast: { light: '#5c5c5c', dark: '#c4c4c4' },
      novaCode: { light: '#858585', dark: '#9a9a9a' },
      lumenEmbed: { light: '#adadad', dark: '#737373' },
      lumenLite: { light: '#d6d6d6', dark: '#4a4a4a' },
    },
    /** Training year (scenario expr-n48): the accent is the winter days; the rest of the year sits in an ink step, the longest break in a mid step drawn hollow. */
    training: {
      winter: { light: '#2871c7', dark: '#5190f7' },
      rest: { light: '#4a4a4a', dark: '#c4c4c4' },
      pause: { light: '#6b6b6b', dark: '#a8a8a8' },
    },
    /** Team wiki (scenario expr-n49): the accent is a stale page still read; stale pages with few reads sit in a dark ink step, fresh pages in a pale one, the read-threshold rule in a mid step. */
    wiki: {
      read: { light: '#2871c7', dark: '#5190f7' },
      quiet: { light: '#4a4a4a', dark: '#c4c4c4' },
      fresh: { light: '#b0b0b0', dark: '#666666' },
      rule: { light: '#6b6b6b', dark: '#a8a8a8' },
    },
    /** Project output (scenario expr-n50): shipped Issues and cost per Issue each sit in one ink step; the accent is the project that answers in its card. */
    projects: {
      shipped: { light: '#6b6b6b', dark: '#a8a8a8' },
      cost: { light: '#6b6b6b', dark: '#a8a8a8' },
    },
    /** Line speed (scenario expr-n46): the accent is the days under the minimum (the kit's highlight); ordinary days sit in an ink step, the contract rules in ink steps from dark (minimum) to pale (maximum). */
    speed: {
      day: { light: '#8a8a8a', dark: '#8f8f8f' },
      minimum: { light: '#262626', dark: '#e6e6e6' },
      normal: { light: '#5c5c5c', dark: '#b4b4b4' },
      maximum: { light: '#a3a3a3', dark: '#757575' },
    },
    /** Issue timeline (scenario expr-n47): the status red is the blocked wait, the one state that needs a hand; sessions sit in the dark ink step, owner and CI waits in mid steps, queue and merge-window holds in the palest, events in the darkest. */
    issue: {
      work: { light: '#4a4a4a', dark: '#c4c4c4' },
      owner: { light: '#858585', dark: '#9a9a9a' },
      ci: { light: '#adadad', dark: '#737373' },
      hold: { light: '#d6d6d6', dark: '#4a4a4a' },
      blocked: { light: '#af293e', dark: '#e46360' },
      event: { light: '#262626', dark: '#ececec' },
    },
    /** Containers (scenario expr-n45): red marks a container past a line (restarting often or near its memory limit); the rest sit in an ink step, the two lines in a mid one. */
    container: {
      flagged: { light: '#af293e', dark: '#e46360' },
      quiet: { light: '#6b6b6b', dark: '#a8a8a8' },
      rule: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Desk walks (scenario expr-n15): the accent is this week, on the bars and on the dots; earlier weeks, the weekly median pace line and the target rule sit in ink steps. */
    walk: {
      minutes: { light: '#6b6b6b', dark: '#a8a8a8' },
      earlier: { light: '#9a9a9a', dark: '#7d7d7d' },
      now: { light: '#2871c7', dark: '#5190f7' },
      median: { light: '#262626', dark: '#e6e6e6' },
      target: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Stuck Issues (scenario expr-n02): the accent is the Issue stuck past 2x its stage's typical time; Issues within typical sit in an ink step, the typical and stuck rules in darker ones. */
    stuck: {
      stuck: { light: '#2871c7', dark: '#5190f7' },
      ok: { light: '#9a9a9a', dark: '#7d7d7d' },
      typical: { light: '#6b6b6b', dark: '#a8a8a8' },
      rule: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Weekly AI spend (scenario expr-c12): the accent is the model that drives the cost; the other models sit in ink steps by rank, the budget pace rule in a dark one and the week boundary in a pale one. */
    budget: {
      lead: { light: '#2871c7', dark: '#5190f7' },
      second: { light: '#4a4a4a', dark: '#c4c4c4' },
      third: { light: '#858585', dark: '#9a9a9a' },
      fourth: { light: '#b8b8b8', dark: '#5c5c5c' },
      pace: { light: '#262626', dark: '#e6e6e6' },
      week: { light: '#9a9a9a', dark: '#7d7d7d' },
    },
    /** Workweek calendar (scenario expr-n35): the accent is the longest free block; meetings take the dark ink step, focus a mid one, personal a pale one; declined and other free blocks share one hollow pale step, time that blocks nothing. */
    week: {
      longest: { light: '#2871c7', dark: '#5190f7' },
      meeting: { light: '#262626', dark: '#e6e6e6' },
      focus: { light: '#6b6b6b', dark: '#a8a8a8' },
      personal: { light: '#b0b0b0', dark: '#666666' },
      open: { light: '#9a9a9a', dark: '#7d7d7d' },
    },
    /** Work inbox (scenario expr-n54): the accent is mail nobody tagged; tagged mail sits in a dark ink step. */
    inbox: {
      untagged: { light: '#2871c7', dark: '#5190f7' },
      tagged: { light: '#6b6b6b', dark: '#a8a8a8' },
    },
    /** Household month (scenario expr-n52): the accent is this month's spending; the usual pace sits in a mid ink step, the bills still due in the dark one, the income rule and the payday rule in ink steps. */
    month: {
      spent: { light: '#2871c7', dark: '#5190f7' },
      usual: { light: '#8a8a8a', dark: '#8f8f8f' },
      committed: { light: '#262626', dark: '#e6e6e6' },
      income: { light: '#4a4a4a', dark: '#c4c4c4' },
      payday: { light: '#9a9a9a', dark: '#7d7d7d' },
    },
    /** Card charges (scenario expr-n51): the accent is a charge unusual for its merchant; charges in range sit in a pale ink step, an uncategorised one gets a dark ink ring under its dot, the median and 2x rules a mid step. */
    charge: {
      unusual: { light: '#2871c7', dark: '#5190f7' },
      inRange: { light: '#9a9a9a', dark: '#7d7d7d' },
      uncategorised: { light: '#262626', dark: '#e6e6e6' },
      rule: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** API credit (scenario expr-n58): the accent is the Team pool alone, its line and its dashed carry-on; Research and Batch pools, Review bot and the other sources sit in ink steps, the pool-size rule in a mid step. */
    credit: {
      team: { light: '#2871c7', dark: '#5190f7' },
      research: { light: '#262626', dark: '#e6e6e6' },
      limit: { light: '#4a4a4a', dark: '#c4c4c4' },
      review: { light: '#262626', dark: '#ececec' },
      others: { light: '#adadad', dark: '#737373' },
    },
    /** Home line (scenario expr-n60): the accent is an internet outage; a gateway outage sits in the dark ink step, the outage still running in the status red, the hole with no measurements in a pale step. */
    outage: {
      internet: { light: '#2871c7', dark: '#5190f7' },
      gateway: { light: '#262626', dark: '#e6e6e6' },
      ongoing: { light: '#af293e', dark: '#e46360' },
      hole: { light: '#9a9a9a', dark: '#7d7d7d' },
    },
    /** Homelab machines (scenario expr-n59): the six machines sit in ink steps from dark to pale, one step per machine on every card; the status red is the machine past its limit on that card. */
    homelab: {
      forge: { light: '#262626', dark: '#ececec' },
      vault: { light: '#4a4a4a', dark: '#d4d4d4' },
      stream: { light: '#6b6b6b', dark: '#b4b4b4' },
      edge: { light: '#858585', dark: '#9a9a9a' },
      pihole: { light: '#9a9a9a', dark: '#7d7d7d' },
      lab: { light: '#b8b8b8', dark: '#666666' },
      over: { light: '#af293e', dark: '#e46360' },
      rule: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Spot wind (scenario expr-n62): the accent is rideable wind (a zone tint, not a series); the wind line sits in the darkest ink step and the gusts in three paler ones, the range rules in a mid one; the status red is the offshore direction. */
    spotWind: {
      wind: { light: '#262626', dark: '#e6e6e6' },
      gust1: { light: '#5a5a5a', dark: '#b8b8b8' },
      gust3: { light: '#858585', dark: '#9a9a9a' },
      gust6: { light: '#aaaaaa', dark: '#707070' },
      range: { light: '#4a4a4a', dark: '#c4c4c4' },
      usable: { light: '#262626', dark: '#e6e6e6' },
      offshore: { light: '#af293e', dark: '#e46360' },
    },
    /** Dark-sky nights (scenario expr-n57): the usable window is the brand tint of a zone; the total cloud line sits in the dark ink step, the layers in mid and pale steps, the clear limit in a rule step. */
    darksite: {
      total: { light: '#262626', dark: '#e6e6e6' },
      low: { light: '#5c5c5c', dark: '#b4b4b4' },
      mid: { light: '#858585', dark: '#9a9a9a' },
      high: { light: '#adadad', dark: '#737373' },
      limit: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Core months (scenario expr-n68): the accent is the usable hours behind the ridge, a brand token set in the page; the ridge cost is a pale ink step, the ridge's highest line the dark ink step and its mean line a mid one. */
    n68: {
      cost: { light: '#b0b0b0', dark: '#666666' },
      highest: { light: '#262626', dark: '#e6e6e6' },
      mean: { light: '#858585', dark: '#9a9a9a' },
    },
    /** Ride windows (scenario expr-n04): the accent is the ride window, a tint from the brand token; rain chance sits in a mid ink step, wind in the dark one, temperature in a pale one, the limit and midnight rules in ink steps. */
    ride: {
      rain: { light: '#6b6b6b', dark: '#a8a8a8' },
      wind: { light: '#262626', dark: '#e6e6e6' },
      temp: { light: '#9a9a9a', dark: '#7d7d7d' },
      limit: { light: '#4a4a4a', dark: '#c4c4c4' },
      day: { light: '#b0b0b0', dark: '#666666' },
    },
    /** Model router picks (scenario expr-n64): the three targets sit in ink steps from dark (iu) to pale (iu-api); the three refusal reasons are the status red in three steps, quota the strong one. The accent is the cache-hit ramp, not a series. */
    n64: {
      iu: { light: '#262626', dark: '#ececec' },
      me: { light: '#7a7a7a', dark: '#9c9c9c' },
      iuApi: { light: '#bdbdbd', dark: '#5c5c5c' },
      quota: { light: '#af293e', dark: '#e46360' },
      policy: { light: '#d0707f', dark: '#b45454' },
      down: { light: '#ebb4bc', dark: '#7e4444' },
    },
    /** Reading pace (scenario expr-n66): the accent is each finished book's pace, the one measure the question asks about; the median rule sits in an ink step. */
    n66: {
      pace: { light: '#2871c7', dark: '#5190f7' },
      median: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Recovery morning (scenario expr-n63): the accent is the recovery score, the one measure the question asks about; HRV, sleep, resting rate, stress and body battery sit in ink steps, the stress rules in a mid one, and the status red marks the hours over 75. */
    n63: {
      recovery: { light: '#2871c7', dark: '#5190f7' },
      hrv: { light: '#4a4a4a', dark: '#c4c4c4' },
      sleep: { light: '#7a7a7a', dark: '#9c9c9c' },
      rhr: { light: '#6b6b6b', dark: '#a8a8a8' },
      stress: { light: '#262626', dark: '#e6e6e6' },
      battery: { light: '#5a5a5a', dark: '#b0b0b0' },
      rule: { light: '#9a9a9a', dark: '#7d7d7d' },
      high: { light: '#af293e', dark: '#e46360' },
    },
    /** Household events (scenario expr-n70): the net per event rests in an ink step and the accent, from the kit's highlight, marks the events over the limit; the reimbursed share sits in a pale step, the limit rule in a dark one. */
    n70: {
      net: { light: '#6b6b6b', dark: '#a8a8a8' },
      back: { light: '#9a9a9a', dark: '#7d7d7d' },
      limit: { light: '#262626', dark: '#e6e6e6' },
    },
    /** AI wallets (scenario expr-n74): the accent marks the wallets that answer, the one that grew most and a new one; last month sits in the dark ink step, the 30 days before in the neutral `other` grey. */
    n74: {
      answer: { light: '#2871c7', dark: '#5190f7' },
      last: { light: '#4a4a4a', dark: '#c4c4c4' },
      other: { light: '#b0b0b0', dark: '#666666' },
    },
    /** Spam filter (scenario expr-n72): the accent is a disagreement between the two classifiers when both are sure; the status red is a message delivered although a classifier called it spam; the other disagreements sit in a dark ink step, agreement in a pale one. */
    n72: {
      agree: { light: '#b0b0b0', dark: '#666666' },
      other: { light: '#4a4a4a', dark: '#c4c4c4' },
      sure: { light: '#2871c7', dark: '#5190f7' },
      delivered: { light: '#af293e', dark: '#e46360' },
    },
    /** Speech models (scenario expr-n80): the accent is the model a blind listen prefers for its preset, the models that lost sit in a dark ink step. */
    n80: {
      win: { light: '#2871c7', dark: '#5190f7' },
      rest: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Review queue (scenario expr-n73): learned items per confidence step in the dark ink step; the accent is the slipped steps, painted by the bar `highlight`. */
    n73: {
      items: { light: '#262626', dark: '#e6e6e6' },
    },
    /** Catalogue fetch (scenario expr-n76): the accent is now (the latest hour, items being fetched); the status red is a real failure; done, queued, paused and dead links sit in ink steps. */
    n76: {
      pages: { light: '#5c5c5c', dark: '#b4b4b4' },
      latest: { light: '#2871c7', dark: '#5190f7' },
      done: { light: '#262626', dark: '#e6e6e6' },
      fetching: { light: '#2871c7', dark: '#5190f7' },
      queued: { light: '#c9c9c9', dark: '#4a4a4a' },
      paused: { light: '#9a9a9a', dark: '#7d7d7d' },
      dead: { light: '#6b6b6b', dark: '#a8a8a8' },
      failed: { light: '#af293e', dark: '#e46360' },
    },
    /** Fix classes (scenario expr-n79): the accent is the one class that landed more often than in the prior 7 days; the other seven sit in ink steps, told apart by the table beside the chart. */
    n79: {
      rose: { light: '#2871c7', dark: '#5190f7' },
      lint: { light: '#262626', dark: '#e6e6e6' },
      flaky: { light: '#3a3a3a', dark: '#d2d2d2' },
      types: { light: '#4a4a4a', dark: '#c4c4c4' },
      build: { light: '#6b6b6b', dark: '#a8a8a8' },
      deps: { light: '#8a8a8a', dark: '#8f8f8f' },
      deploy: { light: '#5a5a5a', dark: '#b0b0b0' },
      docs: { light: '#9a9a9a', dark: '#7d7d7d' },
      total: { light: '#4a4a4a', dark: '#c4c4c4' },
      repos: { light: '#8a8a8a', dark: '#8f8f8f' },
      migration: { light: '#b0b0b0', dark: '#666666' },
    },
    /** Study stats (scenario expr-n81): the accent is the one most practised item; the other items sit in an ink step; on the confidence bars done is the dark ink step, learning a mid one, not started a pale one; the status red is a review past due, a review not yet due a mid step, the today rule a dark one. */
    n81: {
      top: { light: '#2871c7', dark: '#5190f7' },
      rest: { light: '#6b6b6b', dark: '#a8a8a8' },
      done: { light: '#262626', dark: '#e6e6e6' },
      learning: { light: '#7a7a7a', dark: '#9c9c9c' },
      notStarted: { light: '#c9c9c9', dark: '#4a4a4a' },
      due: { light: '#af293e', dark: '#e46360' },
      later: { light: '#7a7a7a', dark: '#9c9c9c' },
      rule: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Planning poker counts (scenario expr-n82): the accent is the last 24 hours, a brand token set by the bar `highlight`; every other day rests in one mid ink step, the typical-day rule and the day divider in a darker one. */
    n82: {
      day: { light: '#9a9a9a', dark: '#7d7d7d' },
      typical: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** API keys (scenario expr-n84): the accent is spend still billing outside the gateway since the cutover; the team key and the bars before the cutover take the dark ink step, the gateway key a pale one, the cap rule a mid one. */
    n84: {
      outside: { light: '#262626', dark: '#e6e6e6' },
      leak: { light: '#2871c7', dark: '#5190f7' },
      gateway: { light: '#9a9a9a', dark: '#7d7d7d' },
      cap: { light: '#6b6b6b', dark: '#a8a8a8' },
    },
    /** Charter request page (scenario expr-n75): the accent is the request sent, set by the bar `highlight`; visits and the inquiry verdicts rest in ink steps, page views in a pale one, the marked days in a mid rule. */
    n75: {
      visitors: { light: '#262626', dark: '#e6e6e6' },
      views: { light: '#b0b0b0', dark: '#666666' },
      step: { light: '#6b6b6b', dark: '#a8a8a8' },
      inquiries: { light: '#6b6b6b', dark: '#a8a8a8' },
      rule: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Loop outcomes (scenario expr-n85): the accent is the Issue that closed with a measured gain; the other four outcomes sit in ink steps, dropped as noise the darkest and still open the palest. */
    n85: {
      gain: { light: '#2871c7', dark: '#5190f7' },
      flat: { light: '#6b6b6b', dark: '#a8a8a8' },
      unmeasured: { light: '#9a9a9a', dark: '#7d7d7d' },
      dropped: { light: '#262626', dark: '#e6e6e6' },
      open: { light: '#d4d4d4', dark: '#5c5c5c' },
    },
    /** Remote test steps (scenario expr-n90): the accent is a run that stayed remote; local for lack of remote room is the dark ink step, local as faster a mid one, local with a free slot a pale one; the status red is a held step; the pressure line rests in a mid ink step, its baseline in a darker one. */
    n90: {
      remote: { light: '#2871c7', dark: '#5190f7' },
      room: { light: '#262626', dark: '#e6e6e6' },
      faster: { light: '#6b6b6b', dark: '#a8a8a8' },
      free: { light: '#b0b0b0', dark: '#666666' },
      held: { light: '#af293e', dark: '#e46360' },
      pressure: { light: '#8c8c8c', dark: '#8c8c8c' },
      baseline: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Added waits and test memory (scenario expr-n89): the accent is a wait judged not needed; needed is the dark ink step, taken back a mid one, not measured a pale one; the peak run of a step is the dark ink step over its median run in a pale one; released holds rest in a mid ink step. */
    n89: {
      needed: { light: '#262626', dark: '#e6e6e6' },
      notNeeded: { light: '#2871c7', dark: '#5190f7' },
      takenBack: { light: '#8c8c8c', dark: '#8c8c8c' },
      notMeasured: { light: '#c9c9c9', dark: '#4a4a4a' },
      peak: { light: '#262626', dark: '#e6e6e6' },
      median: { light: '#b0b0b0', dark: '#666666' },
      released: { light: '#6b6b6b', dark: '#a8a8a8' },
    },
    /** Daily activity (scenario expr-n93): vigorous minutes are the dark ink step and moderate minutes a pale one, steps a mid one, the median rule a mid grey; the one accent is the brand token on the days with no reading, set where the zone is drawn. */
    n93: {
      vigorous: { light: '#262626', dark: '#e6e6e6' },
      moderate: { light: '#b0b0b0', dark: '#666666' },
      steps: { light: '#6b6b6b', dark: '#a8a8a8' },
      median: { light: '#8c8c8c', dark: '#8c8c8c' },
    },
    /** Library enrichment (scenario expr-n91): the accent is the bill a schema change repeats; spend and the waiting bill are the dark ink step, failures retried a mid one; the failure kinds sit in three ink steps, entries the sweep cannot reach the palest; the cache line rests in a mid ink step. */
    n91: {
      schema: { light: '#2871c7', dark: '#5190f7' },
      waiting: { light: '#262626', dark: '#e6e6e6' },
      retry: { light: '#6b6b6b', dark: '#a8a8a8' },
      spend: { light: '#262626', dark: '#e6e6e6' },
      cache: { light: '#6b6b6b', dark: '#a8a8a8' },
      transport: { light: '#262626', dark: '#e6e6e6' },
      model: { light: '#6b6b6b', dark: '#a8a8a8' },
      unreachable: { light: '#b0b0b0', dark: '#666666' },
    },
    /** Photo culling (scenario expr-n97): the accent is the unrated shots of the run that fell furthest behind, set by the bar `highlight`; kept photos are the dark ink step, rejected a mid one, unrated shots a pale one. */
    n97: {
      kept: { light: '#262626', dark: '#e6e6e6' },
      rejected: { light: '#7a7a7a', dark: '#9c9c9c' },
      unrated: { light: '#c9c9c9', dark: '#4a4a4a' },
    },
    /** Image generation cost (scenario expr-n98): the accent is the widest miss; Standard is a mid ink step and HD the dark one; the estimate rule rests in a darker mid step. */
    n98: {
      standard: { light: '#8c8c8c', dark: '#8c8c8c' },
      hd: { light: '#262626', dark: '#e6e6e6' },
      estimate: { light: '#4a4a4a', dark: '#c4c4c4' },
    },
    /** Photo settings (scenario expr-n96): photos per setting rest in a mid ink step; the accent is the setting that carries most photos, set by the chart's highlight. */
    n96: {
      photos: { light: '#8c8c8c', dark: '#8c8c8c' },
    },
    /** Detector noise (scenario expr-n94): the accent is a detector past the mute line, set by the chart's highlight; the other bars rest in a mid ink step; the mute line is the dark ink step. */
    n94: {
      noise: { light: '#6b6b6b', dark: '#a8a8a8' },
      line: { light: '#262626', dark: '#e6e6e6' },
    },
  },
} as const
