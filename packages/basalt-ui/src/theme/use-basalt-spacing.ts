/**
 * useBasaltSpacing — reads the ACTIVE resolved {@link SpaceValues} off the running Mantine theme,
 * instead of the static level-0 snapshot (`SPACE`/`SPACE_SCALE`/`SPACE_STEP`/`ROW_LINE_HEIGHT` in
 * `../tokens/palette`). `createBasaltTheme(overrides, { density })` stashes the resolved values on
 * `theme.other.basaltDensity` ONLY when the level is non-zero (`./index.ts`'s `isDefaultDensity`
 * short-circuit) — at level 0 that key is absent by design, so this hook falls back to
 * `DEFAULT_SPACE_VALUES` (`deriveSpacing(0)`, `../tokens/palette`), which is exactly what
 * `theme.other.basaltDensity` would have held had it not been omitted. That fallback is what keeps
 * every consumer of this hook byte-identical at the shipped default density.
 *
 * Lives in `theme/`, not `tokens/`, because it calls `useMantineTheme()` — `basalt/token-layer-
 * boundary` bans `@mantine/*` imports inside `tokens/`.
 *
 * Three `../shell` components consume it today, two distinct classes of use:
 *  - `BasaltShell` (`../shell/index.tsx`) — its AppShell header/navbar dimensions need the ACTIVE
 *    density level's numbers (`step.appShellHeaderHeight`/`.appShellHeaderMobileHeight`/
 *    `.appShellNavbarWidth`/`.appShellNavbarRailWidth`), not the frozen shipped-identity constants,
 *    because those boxes must grow/shrink with the density-tracked controls rendered inside them.
 *  - `AppSidebar` (`../shell/app-sidebar.tsx`) and `SidebarAccount` (`../shell/app-sidebar-
 *    account.tsx`) each read `step.sidebarSettingsMenuWidth`/`.sidebarAccountMenuWidth` for their
 *    own `<Menu width={…}>` — a numeric Mantine prop, the same "JS-consumed, no `--vx-*` var" shape
 *    as the AppShell dimensions above (see `sidebarAccountMenuWidth`'s doc in `../tokens/palette`
 *    for why a fixed dropdown width needs to track density at all).
 *
 * Deliberately INTERNAL for now — exported from this module (so `../shell` can reach it) but NOT
 * re-exported by the root `.` barrel (`src/index.ts`), so it is not part of the published package
 * surface (same convention `scaleSpace`'s doc comment in `../tokens/palette` uses for the same
 * reason). These three `../shell` components are its only consumers today; promote it to the root
 * barrel — with a surface entry in this package's `CLAUDE.md` — if/when a consumer outside the
 * framework's own components needs the ACTIVE resolved spacing.
 */
import { useMantineTheme } from '@mantine/core'
import { DEFAULT_SPACE_VALUES } from '../tokens/palette'
import type { SpaceValues } from '../tokens/palette'

export function useBasaltSpacing(): SpaceValues {
  return useMantineTheme().other?.basaltDensity ?? DEFAULT_SPACE_VALUES
}
