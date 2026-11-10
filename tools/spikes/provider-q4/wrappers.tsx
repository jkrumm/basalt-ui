// Throwaway Q4 wrappers (<= 40 lines). Not the real ones: prim-p3b (Combobox), prim-p4 (Toast).
import * as React from 'react'
import { Combobox, Toast } from '@base-ui/react'

type WithDismiss<T> = T & { dismissLabel: string }

/** Toast: Base UI spreads caller props after its default `aria-label`, so `label` is a plain prop. */
export function ToastViewport({ label, ...props }: Toast.Viewport.Props & { label: string }) {
  return <Toast.Viewport {...props} aria-label={label} />
}

/**
 * Combobox: the focus-trap buttons set `aria-label="Dismiss"` AFTER their spread props and take no
 * prop, so the wrapper rewrites it, now and on every mount. They sit beside Input and Popup.
 */
const relabel = (root: Element, text: string) =>
  root.querySelectorAll('[aria-label="Dismiss"]').forEach((n) => n.setAttribute('aria-label', text))

function useDismissRef(dismissLabel: string) {
  return React.useCallback(
    (node: HTMLElement | null) => {
      if (!node) return
      relabel(node, dismissLabel)
      const observer = new MutationObserver(() => relabel(node, dismissLabel))
      observer.observe(node, { childList: true, subtree: true })
      return () => observer.disconnect()
    },
    [dismissLabel],
  )
}

export function ComboboxField(props: WithDismiss<React.ComponentProps<'div'>>) {
  const { dismissLabel, ...rest } = props
  return <div {...rest} ref={useDismissRef(dismissLabel)} />
}

export function ComboboxPositioner(props: WithDismiss<Combobox.Positioner.Props>) {
  const { dismissLabel, ...rest } = props
  return <Combobox.Positioner {...rest} ref={useDismissRef(dismissLabel)} />
}
