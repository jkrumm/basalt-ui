# Review: the shell

Owner's eye on the rendered shell, [shell-nav-router section 6](../concepts/shell-nav-router.md). Non-blocking: nothing waits on this page, component anatomy is frozen, and any change is a token-table edit (`packages/basalt-ui/src/tokens/table.ts`) in a follow-up Issue.

Commit viewed: `c7fdfc4b` (master plus the token census). The subjects are the playground exemplar routes `apps/playground/src/routes/index.tsx`, `settings.tsx` and `shell.tsx`, rendered from playground fixtures.

## Shots

Taken from a production playground build at that commit. The PNGs live outside the repo, in `/tmp/f944-shots/` on the mini, and are not committed. Reproduce them with:

```sh
bun --filter basalt-ui build && bun --filter @basalt-ui/playground build
bun apps/playground/scripts/shots.ts /shell /settings / '/shell?chrome=native-overlay' --out <dir>
```

| Shot                               | Light and dark files                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `/` (index), 1800x1200 and 390x844 | `root--{light,dark}--{1800x1200,390x844}.png`                                              |
| `/settings`, 1800x1200 and 390x844 | `settings--{light,dark}--{1800x1200,390x844}.png`                                          |
| `/shell`, 1800x1200 (docked aside) | `shell--{light,dark}--1800x1200.png`                                                       |
| `/shell`, 390x844                  | `shell--{light,dark}--390x844.png`                                                         |
| `/shell`, 390x844, More sheet open | `shell-more--{light,dark}--390x844.png`                                                    |
| Native chrome, 1200x800            | `shell-chrome-native-overlay--{light,dark}--1200x800.png` (`/shell?chrome=native-overlay`) |

The shots script's fixed matrix is 1800x1200 and 390x844, so it also wrote native-chrome files at those sizes (`shell-chrome-native-overlay--*--1800x1200.png`, `--390x844.png`). The 1200x800 More-sheet and native-chrome files came from a one-off Playwright script, not committed. Device checks (iOS Drawer, VoiceOver) are owner rows, not part of this page.

## Exemplars

`routes/index.tsx` (index)
verdict:

`routes/settings.tsx` (settings)
verdict:

## Defaults

Each row is the accepted default and the alternative if rejected. Source: [shell-nav-router](../concepts/shell-nav-router.md), [DIRECTION](../DIRECTION.md), spike [shell-frame](../spikes/shell-frame.md).

| #   | Default                                                                                              | Alternative                                                                   |
| --- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | In-flow sticky `PageBar` band inside Main (S1 PASS: every sampled frame on its offset, aside seam 0) | Portal the band into a region (S1 shows it unnecessary on the shell path)     |
| 2   | Own CSS grid `AppShell`, five areas (DPO 17)                                                         | shadcn `Sidebar` with its mobile path disabled                                |
| 3   | Fixed aside widths 320, 360, 480, 640 (DPO 17)                                                       | `react-resizable-panels` as an app dependency, width through `persisted`      |
| 4   | Rail state in localStorage (DPO 17)                                                                  | Cookie                                                                        |
| 5   | macOS overlay chrome first; a trail inset is additive with the first Windows consumer (DPO 17)       | Three platforms now                                                           |
| 6   | Focus stays on the clicked link on route change                                                      | Focus `main` on route change (S4, unverified until run on VoiceOver and NVDA) |
| 7   | Pane navigation resets Main scroll (`resetScroll: true`); search-field writes keep it                | Keep scroll on pane switch                                                    |
| 8   | `AppShell` runs on TanStack Router only; other routers use `./page` with the `LinkComponent` port    | Offer `AppShell` on another router (not offered)                              |
| 9   | RTL is a non-goal (DPO 18)                                                                           | Support RTL (not offered at 3.0)                                              |
