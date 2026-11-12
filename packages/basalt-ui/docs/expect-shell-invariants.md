---
name: expectShellInvariants
use when: 'a test drives a page through `AppShell` and wants the frame held to the same geometry the library holds itself to'
never when: 'the check is a pixel comparison (use a screenshot gate) or the page runs outside AppShell'
subpath: basalt-ui/testing
peers: []
slots: []
---

# expectShellInvariants

Asserts the frame's geometry rules in each requested rail state at the page's current viewport:
footer rows inside the rail with a bottom inset of at least its horizontal padding, on the nav's
row height and pitch; nav rows evenly spaced within a section; one header height equal to `--shell-header-h`; nothing clipped or past the window;
the document never scrolling. On a phone the rail is absent and the tab bar stands in. Throws one
error listing every broken rule.

## Signature

```ts
expectShellInvariants(page: ShellInvariantsPage, options?: ShellInvariantsOptions): Promise<void>
  evaluate: <R>(fn: () => R) => Promise<R>
  locator: (selector: string) => { click(): Promise<unknown>; }
  setViewportSize: (size: { width: number; height: number; }) => Promise<void>
```
