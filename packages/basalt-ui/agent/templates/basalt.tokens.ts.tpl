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
  series: {},
} as const
