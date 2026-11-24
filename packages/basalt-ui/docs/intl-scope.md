---
name: IntlScope
use when: 'one region (a preview, a print view, a fixed-locale page) must format differently from the app'
never when: 'the whole app takes one locale and zone (pass them to `BasaltProvider`), or one call needs another zone (pass it to that format call)'
subpath: basalt-ui
peers: []
slots: []
---

# IntlScope

A subtree that formats under its own `locale`, `timeZone` or `messages`: every `useFormat` and
`useMessages` below it reads these instead of the provider's. `BasaltProvider` renders one for the
whole app.

## Signature

```ts
IntlScope({ locale, timeZone, messages, children, }: BasaltIntlProps & { children?: ReactNode; }): ReactNode
  locale?: string  // BCP 47 tag the formatters and plural rules read
  timeZone?: string  // IANA zone dates print in
  messages?: Partial<BasaltMessages>  // Overrides over the English defaults, by key
  children?: ReactNode
```

## Example

```tsx
<IntlScope locale="de-DE" timeZone="Europe/Berlin">
  <InvoicePreview />
</IntlScope>
```
