/**
 * basaltViteConfig — a partial Vite config for apps consuming basalt-ui.
 *
 * Grounded verbatim in argo `apps/dashboard/vite.config.ts`: the React dedupe list, the
 * `strictPort` dev server with `allowedHosts`, the `/api` prefix-strip proxy, the
 * `__APP_VERSION__` define, and the local-checkout `BASALT_LOCAL` alias branch.
 *
 * Returns ONLY config (no `plugins`) — plugins stay app-side, since they carry app-specific
 * concerns (router codegen, PWA, react-compiler babel) that don't belong in a shared spine.
 *
 * NEVER reference `import.meta.env` here — this file is invoked inside the consumer's vite config
 * at config-evaluation time (plain Node), where only `process.env` exists.
 *
 * It also carries the enforcement notice (`warnIfUnenforced`): this is the one basalt seam that runs
 * on every dev start and every build of a consumer app, so it is the only place that can tell an app
 * it installed the components and skipped `basalt-ui init`.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { searchForWorkspaceRoot } from 'vite'
import type { UserConfig } from 'vite'

type BasaltViteOptions = {
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
  /**
   * Print a one-time notice when `basalt-ui init` has never been run in this project (no
   * `.basalt/manifest.json` found at or above the cwd) — see `warnIfUnenforced`. Default `true`.
   * Set `false` to adopt the components without the toolchain and stop being told about it.
   */
  enforcementNotice?: boolean
}

/** How many directories up from `cwd` to look for `.basalt/manifest.json`. Three covers the common
 * shapes: config at the app root, an app in `web/` or `apps/<name>/` under a repo root. */
const UNENFORCED_SEARCH_DEPTH = 3

/** Set once the notice has been printed, so a watch-mode restart doesn't reprint it every reload. */
let unenforcedNoticePrinted = false

/**
 * Print one notice when basalt-ui is installed as a component library and nothing else.
 *
 * `basalt-ui init` is what places the oxlint preset, the lint wiring, the lefthook stub and
 * the agent rules. Skipping it leaves a consumer with the components and NONE of the enforcement —
 * and, critically, no signal that this is the case. The failure is silent and cumulative: every
 * hand-rolled `<Card withBorder radius="md" padding="lg">` renders perfectly, so the app drifts a
 * card idiom at a time until someone looks at a screenshot and asks why the design system did
 * nothing. The first real consumer reached seven such cards across six files that way.
 *
 * This is the only seam basalt owns that runs on every dev start and every build, which makes it
 * the only place that can say so at the time it is still cheap to fix. It stays a notice, never an
 * error: declining to adopt the toolchain is a legitimate choice, and a build that fails because a
 * lint preset is absent would be a worse bug than the one this prevents.
 */
function warnIfUnenforced(cwd: string): void {
  if (unenforcedNoticePrinted) return

  let dir = cwd
  for (let i = 0; i <= UNENFORCED_SEARCH_DEPTH; i++) {
    if (existsSync(resolve(dir, '.basalt/manifest.json'))) return
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  unenforcedNoticePrinted = true
  // oxlint-disable-next-line no-console -- a build-time notice has no other channel
  console.warn(
    '\n[basalt-ui] Installed, but `basalt-ui init` has never run here — no oxlint preset, no lint\n' +
      '            wiring, no agent rules. You have the components and none of the enforcement.\n' +
      '            Fix: `./node_modules/.bin/basalt-ui init --profile <tokens|bridge|parts|app>`, then run\n' +
      '            `basalt-ui doctor` in CI. Silence: pass `enforcementNotice: false` to basaltViteConfig().\n',
  )
}

export function basaltViteConfig(opts: BasaltViteOptions): UserConfig {
  const { port, host, allowedHosts, apiTarget, version = '0.0.0' } = opts

  // basaltSrc opt wins; fall back to the BASALT_LOCAL env so a consumer can flip local-source dev
  // on without editing its vite config. process.env (not import.meta.env) — this runs in Node.
  const basaltSrc = opts.basaltSrc ?? process.env['BASALT_LOCAL']

  // Skipped under basaltSrc/BASALT_LOCAL: that path means basalt-ui itself is being developed from
  // a sibling checkout (the playground, or a consumer debugging against local source), where the
  // enforcement config lives in basalt's own repo and a manifest is not expected.
  if (opts.enforcementNotice !== false && basaltSrc === undefined) {
    warnIfUnenforced(process.cwd())
  }

  const config: UserConfig = {
    define: {
      __APP_VERSION__: JSON.stringify(process.env['BUILD_VERSION'] ?? version),
      // basalt-ui source uses `process.env.NODE_ENV` for cross-bundler dev-only stripping (the
      // package bans `import.meta.env`). When consumed as a pre-bundled dist dep, Vite's optimizer
      // replaces it — but the source-aliased playground / BASALT_LOCAL path bypasses optimization,
      // leaving `process` undefined in the browser. Define it here so source-served basalt-ui runs.
      'process.env.NODE_ENV': JSON.stringify(process.env['NODE_ENV'] ?? 'development'),
    },
    resolve: {
      // Force React to a single instance: a second copy in another pre-bundle breaks hook context.
      dedupe: ['react', 'react-dom'],
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
    // Serving from an out-of-root srcDir requires widening fs.allow, but an explicit allow list
    // replaces Vite's default (the workspace root) — so the consumer's own root must be re-added,
    // else its index.html / source falls outside the list. searchForWorkspaceRoot finds it.
    config.server = {
      ...config.server,
      fs: { allow: [searchForWorkspaceRoot(process.cwd()), srcDir] },
    }
  }

  return config
}
