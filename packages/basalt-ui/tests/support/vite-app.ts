/**
 * Shared fixtures for the `basaltAppPlugin` tests (`src/vite.test.ts`, `src/vite-boot.test.ts`) and
 * the boot layout suite: drive the real plugin's hooks and spell the boot rule's literals once.
 */
import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from 'vite'
import { basaltAppPlugin } from '../../src/vite'

export type BasaltAppOptions = Parameters<typeof basaltAppPlugin>[0]

export const HTML_NO_VIEWPORT = '<html><head></head><body></body></html>'

/** Fixed, palette-independent theme colors so these tests never couple to `tokens/palette.ts`. */
export const THEME_COLOR = { light: '#ffffff', dark: '#111111' } as const
export const SCOPE = 'html:not([data-mantine-color-scheme])'
export const LIGHT_VARIANT = `${SCOPE}[data-basalt-boot=light]{background-color:#ffffff;color-scheme:light}`
export const DARK_VARIANT = `${SCOPE}[data-basalt-boot=dark]{background-color:#111111;color-scheme:dark}`

export function getPlugin(options: BasaltAppOptions): Plugin {
  // No `serviceWorker` option -> basaltAppPlugin returns a single, non-promise Plugin.
  return basaltAppPlugin(options)[0] as Plugin
}

/** Invokes the plugin's `configResolved` hook with a minimal fake `ResolvedConfig`. */
export function resolveConfig(plugin: Plugin, base: string): void {
  const configResolved = plugin.configResolved as unknown as (config: ResolvedConfig) => void
  configResolved({ base } as unknown as ResolvedConfig)
}

type HtmlTransformResult = { html: string; tags: HtmlTagDescriptor[] }

/** Invokes the plugin's `transformIndexHtml` hook (object form, `order: 'pre'`). */
export function transform(plugin: Plugin, html: string): HtmlTransformResult {
  const hook = plugin.transformIndexHtml as unknown as {
    order: 'pre'
    handler: (html: string) => HtmlTransformResult
  }
  return hook.handler(html)
}

/** Invokes the plugin's `transformIndexHtml` hook and returns the emitted tags. */
export function transformHtml(plugin: Plugin, html: string): HtmlTagDescriptor[] {
  return transform(plugin, html).tags
}
