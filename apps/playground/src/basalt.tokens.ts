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
    /** The `{ light, dark }` pairs, as v3 chart series take them. */
    demo: {
      sessions: { light: '#2871c7', dark: '#5190f7' },
      signups: { light: '#10781c', dark: '#65d289' },
      revenue: { light: '#c07e3c', dark: '#f9a13d' },
      churn: { light: '#af293e', dark: '#e46360' },
    },
    /** A calendar week (route /kit/interval-track): meetings take the hue, focus and personal time ink steps, a declined event a hollow grey. */
    calendar: {
      meeting: { light: '#2871c7', dark: '#5190f7' },
      focus: { light: '#4a4a4a', dark: '#c4c4c4' },
      personal: { light: '#9a9a9a', dark: '#7d7d7d' },
      declined: { light: '#9a9a9a', dark: '#7d7d7d' },
    },
    /** Harbour bar (the expression app's n34, which keeps its own copy): tide in the dark ink step, swell in a mid step; the two limits sit in rule steps, the go windows are the accent's tint. */
    bar: {
      tide: { light: '#262626', dark: '#e6e6e6' },
      swell: { light: '#7a7a7a', dark: '#9c9c9c' },
      need: { light: '#4a4a4a', dark: '#c4c4c4' },
      limit: { light: '#6b6b6b', dark: '#a8a8a8' },
    },
    /** Model router (the `/kit/bar-list-series` page; the expression app's n41 keeps its own copy): one ink step per model in the chart and the list; the accent is not a model colour. */
    served: {
      atlasLarge: { light: '#262626', dark: '#ececec' },
      atlasFast: { light: '#5c5c5c', dark: '#c4c4c4' },
      novaCode: { light: '#858585', dark: '#9a9a9a' },
      lumenEmbed: { light: '#adadad', dark: '#737373' },
      lumenLite: { light: '#d6d6d6', dark: '#4a4a4a' },
    },
    /** Fleet deploys (route /cycle/shell-6): the status red is a failed deploy, the one outcome that needs a hand; a rolled-back deploy takes the amber, a succeeded one an ink step. */
    fleet6: {
      succeeded: { light: '#6b6b6b', dark: '#a8a8a8' },
      rolledBack: { light: '#c07e3c', dark: '#f9a13d' },
      failed: { light: '#af293e', dark: '#e46360' },
    },
  },
} as const
