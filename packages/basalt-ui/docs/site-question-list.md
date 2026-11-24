---
name: SiteQuestionList
use when: 'a landing or guide page answers the questions its readers ask before they start'
never when: 'the content is one long explanation (write it as prose with headings)'
subpath: basalt-ui/static
peers: [react]
slots: [site-question-list]
---

# SiteQuestionList

Questions and answers as native `<details>`: each opens on its own with no script, and the
browser's find-in-page opens the one that matches. The list takes its questions as data, so a
page can emit its own structured data from the same array; basalt emits none. From 64rem the
heading sits in a start column beside the list.

## Signature

```ts
SiteQuestionList({ title, description, questions, className, }: SiteQuestionListProps): ReactElement
  title?: ReactNode  // The section's `h2`
  description?: ReactNode
  questions: readonly SiteQuestion[]
  className?: string
```

`SiteQuestion` import from `basalt-ui/static`: `import type { SiteQuestion } from 'basalt-ui/static'`.

## Example

```tsx
<SiteQuestionList
  title="Questions"
  questions={[{ question: 'Is it free?', answer: 'Yes, and open source.' }]}
/>
```
