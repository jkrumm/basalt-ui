---
name: SettingsLayout
use when: 'a page is settings: sections of rows under one title, with rows a link can point at'
never when: 'the page is a record or a dashboard (Page and Section), or one short form (FormField alone)'
subpath: basalt-ui/page
peers: ['@base-ui/react', '@tanstack/react-router']
slots: [settings-layout, settings-layout-header]
---

# SettingsLayout

The frame of a settings pane: a centred column with the pane's title and description over its
`FormSection`s, 40 px apart. A link to a row (`#row-id`, or the `row` prop) scrolls to it and
marks it once. It sets no padding of its own: the `Page` owns the gutter. Put the sections'
navigation beside it in a `SplitPage` with an `InnerNav`; a hit on a setting's name is an
`InnerNav` item whose `href` carries the row's `#id`.

## Signature

```ts
SettingsLayout({ title, description, row, className, children, }: SettingsLayoutProps): ReactElement
  title: NonNullable<ReactNode>  // The pane's name (`Profile`): an `h2`, which a `SplitPage` hands focus to when the pane opens
  description?: ReactNode  // One line under the title saying what the pane settles
  row?: string  // The id of the row to scroll to and mark, when the app reads it from somewhere the layout cannot (the router's hash)
  className?: string  // Layout only (`w-full`)
  children: ReactNode  // The pane's `FormSection`s
```

`SettingsLayoutProps` import from `basalt-ui/page`: `import type { SettingsLayoutProps } from 'basalt-ui/page'`.

## Example

```tsx
<SplitPage selected={selected} list={() => <InnerNav … />} detail={() => (
  <SettingsLayout title="Notifications" description="Where each event is sent.">
    <FormSection title="Email">…</FormSection>
  </SettingsLayout>
)} />
```
