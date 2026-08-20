/**
 * Side-effect CSS imports carry no type declarations of their own, and the fixture makes two of
 * them in the exact order the consumer contract requires. Without this, `tsc` reports
 * `TS2882: Cannot find module or type declarations for side-effect import` twice.
 *
 * `src/**`'s own `*.module.css` keeps its hand-maintained `.d.ts` — a real declaration file always
 * beats this wildcard.
 */
declare module '*.css'
