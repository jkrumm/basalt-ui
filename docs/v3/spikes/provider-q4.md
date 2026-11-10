# Spike: Q4 override path (Toast viewport label, Combobox Dismiss)

Q4 passes. The Toast viewport label is a plain prop and the Combobox `Dismiss` is not: Base UI 1.9.0 offers no prop for it, so the wrapper rewrites the attribute on the nodes it owns. Both strings end up as the accessible name, no English default stays in the DOM, and axe reports nothing serious or critical with both overlays open.

Harness: `bun tools/spikes/provider-q4/run.ts` (one JSON object on stdout, always exit 0). Concept: `docs/v3/concepts/quality-contract.md` section 10, Q4.

## Question

Can our wrappers override the two strings Base UI hardcodes: the Toast viewport `aria-label="Notifications"` and the Combobox focus-trap `aria-label="Dismiss"`? Refuted if an override is not the accessible name, if the English default stays anywhere in the DOM, or if axe reports a serious or critical violation with the overlays open.

## Method

- `@base-ui/react` 1.9.0, `axe-core` and `@axe-core/playwright` 4.14.0, `playwright-core` 1.63.0 (Chrome channel), react and react-dom 19.3.0. Own `package.json` in the spike folder.
- Wrappers in `tools/spikes/provider-q4/wrappers.tsx` (40 lines): `ToastViewport` takes `label`; `ComboboxField` and `ComboboxPositioner` take `dismissLabel`. Fixture in `client.tsx`, bundled by `Bun.build`, German overrides `Benachrichtigungen` and `Schließen`.
- Steps: add a toast, wait for it, settle (every `getAnimations()` finished, two frames), axe; then open the combobox, settle, axe. Axe tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`. A page reload between the wrapped and the control run.
- Accessible name is asserted through Playwright role queries (`region` named `Benachrichtigungen`, `button` named `Schließen`), not by reading the attribute.
- Leak scan: any element in the document whose `aria-label` or own text is `Notifications` or `Dismiss`, portals included.
- Control: the same page with unwrapped Base UI. The detector has to find both English strings there, or a clean result proves nothing (`controlDetectorWorks`).
- The first axe run reported `target-size` (serious) on the fixture's own undersized button near the toast. The fixture got `min-height`/`min-width: 44px` and spacing; no rule is disabled.

## Measurements

Two runs, byte-identical stdout, both exit 0.

```json
{
  "toastLabelOverridable": true,
  "comboboxDismissOverridable": true,
  "defaultEnglishLeaks": 0,
  "axeSeriousCritical": 0,
  "verdict": "pass",
  "detail": {
    "toastPropName": "label",
    "toastDomAttribute": "aria-label on div[role=region] (Toast.Viewport)",
    "comboboxPropName": "dismissLabel",
    "comboboxDismissNodes": 2,
    "comboboxDismissAttrs": ["span[aria-label]", "span[aria-label]"],
    "leaks": [],
    "controlUnwrappedLeaks": ["div[aria-label]=Notifications", "span[aria-label]=Dismiss"],
    "controlDetectorWorks": true
  }
}
```

Run 2 printed the same line.

Where the string reaches the DOM, from the Base UI 1.9.0 source:

| String           | Wrapper prop   | DOM                                                                                                              | Source                                                                                                                                                          |
| ---------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toast viewport   | `label`        | `aria-label` on the `div[role=region]`                                                                           | `toast/viewport/ToastViewport.mjs`: default props come first in `props: [defaultProps, elementProps]`, so a caller `aria-label` wins. A real prop path.         |
| Combobox dismiss | `dismissLabel` | `aria-label` on two visually hidden `span[role=button]`: one before `Combobox.Input`, one after `Combobox.Popup` | `combobox/utils/ComboboxInternalDismissButton.mjs`: `"aria-label": "Dismiss"` is written after the spread props and the component takes no props. No prop path. |

The two Dismiss spans are rendered only while the combobox is open (the start one) or mounted (the end one) and the focus manager is modal (`!inputInsidePopup || modal`), which is the default input-outside-popup combobox. They are siblings of `Combobox.Input` (start) and of `Combobox.Popup` under `Combobox.Positioner` (end), not children of the popup, so the wrapper needs a node on each side: `ComboboxField` around the input, `ComboboxPositioner`.

## Verdict

Q4: PASS

Verdict: PASS

By the rule: both overrides are the accessible name (region named `Benachrichtigungen` once, button named `Schließen` twice), `defaultEnglishLeaks` is 0 and `axeSeriousCritical` is 0 with the toast shown and the combobox open.

Caveat. The Toast half is a supported prop. The Combobox half is a DOM patch: a `MutationObserver` on the wrapper's nodes rewrites `aria-label="Dismiss"` in a ref callback, before paint. It depends on Base UI keeping that exact literal and structure, which is what the `base-ui.strings` scan (section 10) is for. It was not exercised for repeated open/close cycles, `modal` inside-popup inputs, or SSR (not exercised).

## Then

- `prim-p4` (Toast): `ToastViewport` takes `label: string` and passes it as `aria-label`. Required, no English default in the wrapper; the catalog supplies it.
- `prim-p3b` (Combobox): own `dismissLabel: string`, required. Wrap the input in an element with the relabel ref and put the same ref on `Positioner`. Re-run the overlay-open axe pass on the real wrapper, and add open/close cycles and an SSR check there.
- File an upstream issue on `@base-ui/react` for a `dismissLabel` (or localisation) prop on the Combobox dismiss buttons; drop the observer when it lands.
- `base-ui.strings` scan: pin both literals as the known two so a rename fails the scan instead of silently re-leaking English.

## Affects

- `docs/v3/concepts/quality-contract.md` section 10, Q4 row: pass; unchanged, frozen here.
- `prim-p3b` and `prim-p4` (wait on this contract).
- Gate G1: Q4 no longer blocks it.
