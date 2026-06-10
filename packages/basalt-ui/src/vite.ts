/**
 * basaltViteConfig — a partial Vite config for apps consuming basalt-ui.
 *
 * Grounded verbatim in argo `apps/dashboard/vite.config.ts`: the Mantine dedupe list, the Mantine
 * subpackage `optimizeDeps.include`, the `strictPort` dev server with `allowedHosts`, the `/api`
 * prefix-strip proxy, the `__APP_VERSION__` define, and the local-checkout `BASALT_LOCAL` alias
 * branch.
 *
 * Returns ONLY config (no `plugins`) — plugins stay app-side, since they carry app-specific
 * concerns (router codegen, PWA, react-compiler babel) that don't belong in a shared spine. Argo's
 * `@mantine/schedule` is likewise app-domain and is not pre-bundled here; consumers add their own
 * extra subpackages to `optimizeDeps.include` if needed.
 *
 * NEVER reference `import.meta.env` here — this file is invoked inside the consumer's vite config
 * at config-evaluation time (plain Node), where only `process.env` exists.
 */
import { resolve } from 'node:path'
import type { UserConfig } from 'vite'

export type BasaltViteOptions = {
  /** Dev server port. Passed with `strictPort: true` so the app fails fast on a busy port. */
  port: number
  /** Dev server host (bind address, or `true` to listen on all interfaces). */
  host?: string | boolean
  /**
   * Hostnames the dev server accepts (Vite's `server.allowedHosts`). Needed when fronting the dev
   * server behind a local reverse proxy on a custom domain (e.g. `['app.test']`).
   */
  allowedHosts?: string[]
  /**
   * When set, enable the `/api` dev proxy: requests to `/api/*` strip the `/api` prefix and proxy
   * to this target. For prod debugging point at a target that already includes `/api`
   * (e.g. `https://example.com/api`); for a bare local API that serves routes without a prefix,
   * point at its origin (e.g. `http://localhost:4040`).
   */
  apiTarget?: string
  /**
   * Absolute path to a sibling basalt-ui `src/` checkout. When set (or when the `BASALT_LOCAL` env
   * var is set), alias the `basalt-ui` import to that source for live local development and allow
   * Vite's dev server to serve files from it. Because `resolve.alias` is part of Vite's prebundle
   * cache key, toggling this auto-invalidates the optimizer cache.
   */
  basaltSrc?: string
  /** App version surfaced via the `__APP_VERSION__` define. Defaults to `0.0.0`. */
  version?: string
}

export function basaltViteConfig(opts: BasaltViteOptions): UserConfig {
  const { port, host, allowedHosts, apiTarget, version = '0.0.0' } = opts

  // basaltSrc opt wins; fall back to the BASALT_LOCAL env so a consumer can flip local-source dev
  // on without editing its vite config. process.env (not import.meta.env) — this runs in Node.
  const basaltSrc = opts.basaltSrc ?? process.env['BASALT_LOCAL']

  const config: UserConfig = {
    define: {
      __APP_VERSION__: JSON.stringify(process.env['BUILD_VERSION'] ?? version),
    },
    resolve: {
      // Force these packages to a single instance. Without dedupe, Vite's optimizer can stamp a
      // second copy of @mantine/core into another subpackage's pre-bundle, which breaks
      // MantineProvider context.
      dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks', '@mantine/dates'],
    },
    optimizeDeps: {
      // Pre-bundle the Mantine subpackages together so they share one @mantine/core instance (and
      // one MantineProvider context). Consumers append their own (e.g. @mantine/schedule).
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
      ...(allowedHosts !== undefined ? { allowedHosts } : {}),
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
          // Prod targets sit behind HTTPS — must be set or SNI/cert chatter surfaces as 502s.
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
