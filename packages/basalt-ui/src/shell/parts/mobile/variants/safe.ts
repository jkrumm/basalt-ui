/**
 * The four safe-area insets as custom properties, each the larger of the device's `env()` inset and
 * `--shell-safe-*` on an ancestor (0 unless set). The layout tests set `--shell-safe-bottom` on
 * `<html>` to stand in for a home indicator, which a headless browser never has. Put `SAFE` on the
 * shell root and on every portalled popup: a portal does not inherit the root's properties.
 */
export const SAFE =
  '[--phone-safe-t:max(env(safe-area-inset-top),var(--shell-safe-top,0px))] [--phone-safe-r:max(env(safe-area-inset-right),var(--shell-safe-right,0px))] [--phone-safe-b:max(env(safe-area-inset-bottom),var(--shell-safe-bottom,0px))] [--phone-safe-l:max(env(safe-area-inset-left),var(--shell-safe-left,0px))]'
