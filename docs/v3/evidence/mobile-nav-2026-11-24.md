# Phone nav trial frames (Issue 3205)

The two phone navs the owner compares, on the playground's real `defineNav`, shot headless at device
scale 2 with a 34 px home indicator stood in (`--shell-safe-bottom`) and reduced motion on. The
shipped tab bar ("Now") is the baseline.

- A: a bar of nav sections; a tap grows the section's pages in a tray attached to the bar.
- B: the same bar; a tap raises a short drawer with a grabber over the bar.
- More (both): the app slides right and reveals the desktop rail.

## Contact sheets (390x844 and 430x932, light and dark)

| Variant   | Sheet                                                                 |
| --------- | --------------------------------------------------------------------- |
| Now       | [sheet--default.png](assets/mobile-nav-2026-11-24/sheet--default.png) |
| A, tray   | [sheet--a.png](assets/mobile-nav-2026-11-24/sheet--a.png)             |
| B, drawer | [sheet--b.png](assets/mobile-nav-2026-11-24/sheet--b.png)             |

## Single frames at 390x844

| State                 | A light                                                       | A dark                                                       | B light                                                       | B dark                                                       |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------ |
| At rest, with a badge | [a](assets/mobile-nav-2026-11-24/a--rest--light--390.png)     | [a](assets/mobile-nav-2026-11-24/a--rest--dark--390.png)     | [b](assets/mobile-nav-2026-11-24/b--rest--light--390.png)     | [b](assets/mobile-nav-2026-11-24/b--rest--dark--390.png)     |
| Section open          | [a](assets/mobile-nav-2026-11-24/a--section--light--390.png)  | [a](assets/mobile-nav-2026-11-24/a--section--dark--390.png)  | [b](assets/mobile-nav-2026-11-24/b--section--light--390.png)  | [b](assets/mobile-nav-2026-11-24/b--section--dark--390.png)  |
| More: the sidebar     | [a](assets/mobile-nav-2026-11-24/a--more--light--390.png)     | [a](assets/mobile-nav-2026-11-24/a--more--dark--390.png)     | [b](assets/mobile-nav-2026-11-24/b--more--light--390.png)     | [b](assets/mobile-nav-2026-11-24/b--more--dark--390.png)     |
| Keyboard up           | [a](assets/mobile-nav-2026-11-24/a--keyboard--light--390.png) | [a](assets/mobile-nav-2026-11-24/a--keyboard--dark--390.png) | [b](assets/mobile-nav-2026-11-24/b--keyboard--light--390.png) | [b](assets/mobile-nav-2026-11-24/b--keyboard--dark--390.png) |

Reshoot: `bun --filter @basalt-ui/playground build`, then
`bun apps/playground/scripts/phone-nav-frames.ts` (writes `.evidence/phone-nav/`).
