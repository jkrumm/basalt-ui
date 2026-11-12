/**
 * The window chrome: what `AppShell chrome="native-overlay"` changes and what a page can read of it.
 *
 * `native-overlay` is a frameless desktop window whose title bar is drawn by the web page (Tauri 2
 * `TitleBarStyle::Overlay`): the header is 52 tall, the first 80 px of it belong to the window's
 * own buttons, and the header is the drag region. Host code stays the consumer's: the window
 * config, the traffic-light position and the menu are Rust.
 */
import { createContext, useCallback, useContext } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { PageHost } from '../core/ports'
import { PageHostContext } from '../page/page'
import type { ShellChrome, WindowChrome } from './contract'

/** The header's height under `native-overlay`, in px. */
export const NATIVE_HEADER_PX = 52
/** The space the window's own buttons take at the header's lead edge on macOS, in px. */
export const NATIVE_LEAD_INSET_PX = 80

const WEB: WindowChrome = { chrome: 'web', leadInset: 0 }
const NATIVE: WindowChrome = { chrome: 'native-overlay', leadInset: NATIVE_LEAD_INSET_PX }

const ChromeContext = createContext<WindowChrome>(WEB)

/** The frame description for a `chrome` value. Stable identity, so a context consumer never re-renders for it. */
export function windowChrome(chrome: ShellChrome): WindowChrome {
  return chrome === 'native-overlay' ? NATIVE : WEB
}

/**
 * The shell's outermost provider: the page host, and the chrome every part of the shell reads, the
 * header's controls and actions included.
 */
export function ChromeHost({
  chrome,
  host,
  children,
}: {
  chrome: ShellChrome
  host: PageHost
  children: ReactNode
}): ReactElement {
  return (
    <PageHostContext value={host}>
      <ChromeContext value={windowChrome(chrome)}>{children}</ChromeContext>
    </PageHostContext>
  )
}

/**
 * Writes the two geometry properties onto the shell root: `--shell-header-h` (the grid's header
 * row) and `--chrome-lead-inset`. Inline, because the root's own classes declare `--shell-header-h`
 * and an inline value is the one that wins whatever layer those classes sit in. `web` removes both.
 */
function applyChrome(root: HTMLElement | null, chrome: ShellChrome): void {
  if (root === null) return
  if (chrome === 'native-overlay') {
    root.style.setProperty('--shell-header-h', `${NATIVE_HEADER_PX}px`)
    root.style.setProperty('--chrome-lead-inset', `${NATIVE_LEAD_INSET_PX}px`)
    return
  }
  root.style.removeProperty('--shell-header-h')
  root.style.removeProperty('--chrome-lead-inset')
}

/** The shell root's ref callback with the chrome geometry applied after the host's own attach. */
export function useChromeRoot(
  attach: (el: HTMLDivElement | null) => void,
  chrome: ShellChrome,
): (el: HTMLDivElement | null) => void {
  return useCallback(
    (el: HTMLDivElement | null) => {
      attach(el)
      applyChrome(el, chrome)
    },
    [attach, chrome],
  )
}

/**
 * The header under `native-overlay`: the whole bar drags (the `data-tauri-drag-region="deep"` on the
 * element is what Tauri reads; `app-region` is the same intent for Electron and WebKit) and every
 * interactive child opts out, so a click on a button is a click.
 */
export const NATIVE_HEADER =
  'select-none [-webkit-app-region:drag] [app-region:drag] [&_:is(button,a,input,select,textarea,[role=button],[tabindex])]:[-webkit-app-region:no-drag] [&_:is(button,a,input,select,textarea,[role=button],[tabindex])]:[app-region:no-drag]'

/** The brand zone gives the window buttons' strip its width back, keeping room for the rail toggle when collapsed. */
export const NATIVE_BRAND =
  'md:w-[max(calc(var(--shell-rail-w)-var(--chrome-lead-inset)),--spacing(10))]'

/** The strip at the header's lead edge that the window's own buttons cover. */
export function Titlebar(): ReactElement {
  return (
    <span
      data-slot="shell-titlebar"
      aria-hidden="true"
      className="h-full w-(--chrome-lead-inset) shrink-0"
    />
  )
}

/**
 * The window chrome of the shell this component sits in: `chrome` and `leadInset`, the px at the
 * header's lead edge that the window's own buttons cover (0 on the web). Read it to keep your own
 * header content out of that strip. Outside an `AppShell` it reads `web`.
 *
 * @useWhen a component placed in the header or over its corner must clear the native window buttons
 * @neverWhen the layout can use `var(--chrome-lead-inset)` in CSS instead
 *
 * @example
 * const { leadInset } = useWindowChrome()
 * <div style={{ paddingInlineStart: leadInset }}>…</div>
 */
export function useWindowChrome(): WindowChrome {
  return useContext(ChromeContext)
}
