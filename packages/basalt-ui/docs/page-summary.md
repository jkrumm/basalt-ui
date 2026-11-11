---
name: PageSummary
use when: 'a page opens with a headline that carries its live number and a line of supporting facts'
never when: 'the headline would restate the page title (leave it out) or the figure is a KPI card (use `StatCard`)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [page-summary, page-summary-aside, page-summary-fact, page-summary-facts]
---

# PageSummary

A page's opening: one headline sentence that carries a live number, an optional facts line under
it and an optional aside after it. It renders an `h2` at the headline step: the page's `h1` is
the `PageBar` title, and a second one would split the outline. The sentence states a fact, "12
open, 3 need you", never "Overview of your tickets"; the title already says what the page is.

## Signature

```ts
PageSummary(props: PageSummaryProps): ReactElement
  one of: loading=false | loading=true
  sentence?: ReactNode
  facts?: readonly Fact[]
  aside?: ReactNode
  loading?: false | true
```
