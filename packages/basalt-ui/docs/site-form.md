---
name: SiteForm
use when: 'a content page collects a few fields and a server or form service takes the post'
never when: 'the form needs a live error summary, async checks or a multi-step flow (use `Form` from `basalt-ui/form` in an app)'
subpath: basalt-ui/static
peers: [react]
slots: [form]
---

# SiteForm

A native form: it posts to `action` with no client JavaScript. The browser validates `required` and
`type`, and `:user-invalid` marks a field after the reader leaves it, never on the first key.

## Signature

```ts
SiteForm({ action, method, children, className, }: SiteFormProps): ReactElement
  action: string  // Where the browser sends the form: a URL on your site or a form service
  method?: "post" | "get"  // Default `post`
  children: ReactNode
  className?: string
```

`SiteFormProps` import from `basalt-ui/static`: `import type { SiteFormProps } from 'basalt-ui/static'`.

## Example

```tsx
<SiteForm action="/subscribe">
  <SiteField label="Email" name="email" type="email" autoComplete="email" required />
  <SiteSubmit>Subscribe</SiteSubmit>
</SiteForm>
```
