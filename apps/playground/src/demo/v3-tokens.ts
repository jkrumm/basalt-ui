import v3Tokens from 'basalt-ui/tokens.css?inline'
import { useLayoutEffect } from 'react'

/**
 * Re-asserts the v3 tokens on a v3 exemplar route. The playground still mounts the 2.x provider,
 * whose runtime `:root` style renders inside `#root`, after `tokens.css`, and shares names with it: in light it
 * wins, so `--vx-good` and `--vx-bad` paint as the 2.x 18% tints (the delta pill's text all but
 * vanished) and `--vx-radius-card` is 10px, not 14. While the route is mounted, a copy of `tokens.css`
 * sits last in `<body>` and wins by source order; unmounting removes it, so the 2.x routes keep
 * their own values. A shell-free v3 app has one token sheet and never needs this.
 */
export function useV3Tokens(): void {
  useLayoutEffect(() => {
    const style = document.createElement('style')
    style.dataset['playground'] = 'v3-tokens'
    style.textContent = v3Tokens
    // After `#root`: Mantine renders the 2.x token style inside the React tree, not in `<head>`.
    document.body.append(style)
    return () => style.remove()
  }, [])
}
