/**
 * The popup every combobox-shaped list opens in (`Combobox`, `Autocomplete`, the palette's list):
 * portalled, anchored to the whole field box and with Base UI's hidden close buttons named.
 */
import { Autocomplete as BaseAutocomplete } from '@base-ui/react/autocomplete'
import { Combobox as BaseCombobox } from '@base-ui/react/combobox'
import { createContext, useCallback, useContext } from 'react'
import type { ReactElement, ReactNode, Ref } from 'react'
import { ControlScopeProvider } from '../control-scope'
import { select } from '../messages/select'
import { useMessages } from '../messages/use-messages'

/** The popup anchors to the whole field box (input or chips), and its width follows it. */
export const AnchorContext = createContext<Ref<HTMLDivElement> | undefined>(undefined)

/**
 * Base UI hardcodes `aria-label="Dismiss"` on the two hidden buttons that close an open combobox
 * and offers no prop for it (spike Q4). The wrapper rewrites the attribute on the nodes it owns,
 * now and on every mount, before paint. Drop this when Base UI ships a localisation prop.
 */
function relabel(root: Element, text: string): void {
  if (text === 'Dismiss') return
  for (const node of root.querySelectorAll('[aria-label="Dismiss"]')) {
    node.setAttribute('aria-label', text)
  }
}

export function useDismissRef(): (node: HTMLElement | null) => (() => void) | undefined {
  const text = useMessages(select)('combobox.dismiss')
  return useCallback(
    (node) => {
      if (node === null) return undefined
      relabel(node, text)
      const observer = new MutationObserver(() => relabel(node, text))
      observer.observe(node, { childList: true, subtree: true })
      return () => observer.disconnect()
    },
    [text],
  )
}

/**
 * The portalled, anchored popup every combobox-shaped list opens in. It anchors to the whole field
 * box (input or chips) and relabels Base UI's hidden close buttons.
 */
export function PopupFrame({
  kind,
  slot,
  className,
  container,
  popupProps,
  children,
}: {
  kind: 'combobox' | 'autocomplete'
  slot: string
  className: string
  container: BaseCombobox.Portal.Props['container'] | undefined
  popupProps?: Omit<BaseCombobox.Popup.Props, 'className' | 'children'>
  children: ReactNode
}): ReactElement {
  const anchor = useContext(AnchorContext)
  const dismiss = useDismissRef()
  const Base = kind === 'combobox' ? BaseCombobox : BaseAutocomplete
  return (
    <ControlScopeProvider value={null}>
      <Base.Portal {...(container !== undefined && { container })}>
        <Base.Positioner
          sideOffset={4}
          className="z-50 outline-none"
          ref={dismiss}
          {...(anchor !== undefined && { anchor: anchor as never })}
        >
          <Base.Popup {...popupProps} data-slot={slot} className={className}>
            {children}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </ControlScopeProvider>
  )
}
