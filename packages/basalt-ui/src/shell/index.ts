/**
 * `basalt-ui/shell`: `AppShell`, the application frame. A CSS grid of header, rail, one scrollport,
 * aside and (on a phone) tab bar, driven by one `defineNav` declaration. Peers: react,
 * `@tanstack/react-router`, `@base-ui/react`.
 */

export { AppShell } from './app-shell'
export { defineCommands } from './commands/define-commands'
export { CommandPalette } from './commands/command-palette'
export { toMenuTemplate } from './menu-template'
export { useWindowChrome } from './chrome'
