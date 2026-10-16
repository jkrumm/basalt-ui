/**
 * The command registry's runtime stash, as a leaf: no React, no peers. `defineCommands` fills it;
 * the provider's hotkey binder, the Spotlight projector and `ShortcutsHelp` read it. Kept apart from
 * `define-commands.ts` so a reader never imports the module that registers feature mounts.
 */
import type { Command, CommandMap } from './define-commands'

let activeCommands: CommandMap = {}
const listeners = new Set<() => void>()

/** @internal — `defineCommands` only. The last call wins; readers subscribed via {@link subscribeCommands} re-read. */
export function setActiveCommands(spec: CommandMap): void {
  activeCommands = spec
  for (const listener of listeners) listener()
}

/** @internal — exposed to the provider and projectors.ts to iterate the runtime stash. Returns a readonly view. */
export function getActiveCommands(): Readonly<CommandMap> {
  return activeCommands
}

/** @internal — `useSyncExternalStore` subscribe for a late `defineCommands` (a lazily loaded route). */
export function subscribeCommands(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

/**
 * Runs a command, swallowing a sync throw or async rejection so a failing command never becomes an
 * unhandled rejection (which the provider would report as a `window.error`). Dev logs it.
 */
export function runCommandSafely(cmd: Command): void {
  const report = (error: unknown): void => {
    if (process.env.NODE_ENV !== 'production') console.error('[basalt] command failed', error)
  }
  try {
    Promise.resolve(cmd.run()).catch(report)
  } catch (error) {
    report(error)
  }
}
