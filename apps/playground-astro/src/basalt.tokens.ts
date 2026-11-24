// The Astro playground's series colors, authored once; the pairs match the Vite playground's `demo` group
// (apps/playground/src/basalt.tokens.ts). This is the one file that writes raw color: a pair is `{ light, dark }`.
// oxlint-disable-next-line import/no-default-export -- `tokens:css --extra` reads the file's default export
export default {
  series: {
    demo: {
      sessions: { light: '#2871c7', dark: '#5190f7' },
      signups: { light: '#10781c', dark: '#65d289' },
      revenue: { light: '#c07e3c', dark: '#f9a13d' },
      churn: { light: '#af293e', dark: '#e46360' },
    },
  },
} as const
