/**
 * basaltViteConfig — a partial Vite config for apps consuming basalt-ui.
 *
 * Grounded verbatim in argo `apps/dashboard/vite.config.ts`: the Mantine dedupe list, the Mantine
 * subpackage `optimizeDeps.include`, the `strictPort` dev server, the `/api` prefix-strip proxy,
 * the `__APP_VERSION__` define, and the local-checkout `BASALT_LOCAL` alias branch.
 *
 * Returns ONLY config (no `plugins`) — plugins stay app-side, since they carry app-specific
 * concerns (router codegen, PWA, react-compiler babel) that don't belong in a shared spine.
 */
import { resolve } from 'node:path'
import type { UserConfig } from 'vite'

export type BasaltViteOptions = {
  /** Dev server port. Passed with `strictPort: true` so the app fails fast on a busy port. */
  port: number
  /** Dev server host (bind address or hostname allow-list entry). */
  host?: string | boolean
  /**
   * When set, enable the `/api` dev proxy: requests to `/api/*` strip the `/api` prefix and proxy
   * to this target. For prod debugging point at a target that already includes `/api`
   * (e.g. `https://example.com/api`).
   */
  apiTarget?: string
  /**
   * Absolute path to a sibling basalt-ui `src/` checkout. When set, alias the `basalt-ui` import to
   * that source (live local development) and allow Vite's dev server to serve files from it.
   */
  basaltSrc?: string
  /** App version surfaced via the `__APP_VERSION__` define. Defaults to `0.0.0`. */
  version?: string
}

export function basaltViteConfig(opts: BasaltViteOptions): UserConfig {
  const { port, host, apiTarget, basaltSrc, version = '0.0.0' } = opts

  const config: UserConfig = {
    define: {
      __APP_VERSION__: JSON.stringify(process.env['BUILD_VERSION'] ?? version),
    },
    resolve: {
      // Force these packages to a single instance. Without dedupe, Vite's optimizer can stamp a
      // second copy of @mantine/core into another package's pre-bundle, breaking MantineProvider.
      dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks', '@mantine/dates'],
    },
    optimizeDeps: {
      // Pre-bundle all Mantine subpackages together so they share one @mantine/core instance.
      include: [
        '@mantine/core',
        '@mantine/dates',
        '@mantine/hooks',
        '@mantine/form',
        '@mantine/modals',
        '@mantine/notifications',
      ],
    },
    server: {
      port,
      strictPort: true,
      ...(host !== undefined ? { host } : {}),
    },
  }

  if (apiTarget) {
    config.server = {
      ...config.server,
      proxy: {
        '/api': {
          target: apiTarget,
          rewrite: (path: string) => path.replace(/^\/api/, ''),
          changeOrigin: true,
          secure: true,
        },
      },
    }
  }

  // BASALT_LOCAL: develop against a sibling basalt-ui checkout's source.
  if (basaltSrc) {
    const srcDir = resolve(basaltSrc)
    config.resolve = {
      ...config.resolve,
      alias: { 'basalt-ui': srcDir },
    }
    config.server = {
      ...config.server,
      fs: { allow: [srcDir] },
    }
  }

  return config
}
