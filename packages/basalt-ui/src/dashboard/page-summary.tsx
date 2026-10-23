/**
 * PageSummary — a page's opening (docs/waves/design-parity/SPEC.md § 6.9): one headline sentence
 * that carries at least one live number, an optional facts line under it, and an optional `aside`
 * after the headline (beside it, wrapping under it when the line is full). It renders an `h2` at the `h1` type step (head face, −0.02em): the page's own
 * h1 is the shell breadcrumb's / `PageTitle`'s, and a second one would split the outline. The facts
 * are the proportional sans at `xs`, muted, `·`-separated — a time fact may take mono itself, the line does
 * not (D33).
 *
 * The sentence MUST state a live fact — "12 open, 3 need you", never "Overview of your tickets".
 * A sentence without a number is the page restating its own name, which the breadcrumb already does.
 * That is the reviewer's rule too: a page summary without a number is a defect.
 *
 * `null` / `false` / `undefined` / `''` facts drop, so conditional facts pass inline. A facts line
 * that wraps never opens a line with `·`: each fact owns its separator as a pseudo-element in the gap
 * before it (logical, so RTL mirrors), and the list clips inline overflow, so the dot of the fact that starts a line falls
 * outside the clip.
 *
 * `loading` renders a skeleton of the same shape — the headline bar, plus a facts bar when `facts`
 * is passed — so the page does not jump when the numbers arrive.
 *
 * @example
 * import { PageSummary } from 'basalt-ui'
 *
 * <PageSummary
 *   sentence={`${open} open, ${needYou} need you`}
 *   facts={[oldest && `oldest ${oldest}`, `${runs} runs today`]}
 *   aside="Today"
 * />
 *
 * @example
 * <PageSummary loading facts={[]} />
 */
import { Skeleton } from '@mantine/core'
import type { ReactNode } from 'react'
import { cx, pickDataAttributes } from '../common/props'
import type { BasaltProps, DataAttributes } from '../common/props'
import classes from './page-summary.module.css'

type Fact = ReactNode | null | false | undefined

type PageSummaryContent = {
  /** The headline sentence. It must state a live number — never describe the page. */
  sentence: ReactNode
  /** Short facts under the headline, e.g. `['3 need you', oldest && `oldest ${oldest}`]`. */
  facts?: readonly Fact[]
  /** After the headline: a date or a freshness word. */
  aside?: ReactNode
  loading?: false
}

/** While the sentence's data loads: a skeleton of the same shape, no content props needed. */
type PageSummaryLoading = Partial<Omit<PageSummaryContent, 'loading'>> & { loading: true }

export type PageSummaryProps = BasaltProps &
  DataAttributes &
  (PageSummaryContent | PageSummaryLoading)

const NO_FACTS: readonly Fact[] = []

const isShown = (fact: Fact): boolean =>
  fact !== null && fact !== false && fact !== undefined && fact !== ''

export function PageSummary(props: PageSummaryProps) {
  const { className, style } = props
  const common = {
    ...pickDataAttributes(props),
    className: cx(classes.root, className),
    'data-page-summary': '',
    style,
  }

  if (props.loading === true) {
    return (
      <div {...common} aria-busy="true">
        <Skeleton className={classes.sentenceSkeleton} width="55%" radius="sm" />
        {props.facts !== undefined && (
          <Skeleton className={classes.factsSkeleton} width="35%" radius="sm" />
        )}
      </div>
    )
  }

  const { sentence, facts = NO_FACTS, aside } = props
  const shown = facts.filter(isShown)
  return (
    <div {...common}>
      <div className={classes.top}>
        <h2 className={classes.sentence}>{sentence}</h2>
        {aside !== undefined && <span className={classes.aside}>{aside}</span>}
      </div>
      {shown.length > 0 && (
        <p className={classes.facts} data-page-summary-facts>
          {shown.map((fact, i) => (
            <span key={i} className={classes.fact} data-page-summary-fact>
              {fact}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
