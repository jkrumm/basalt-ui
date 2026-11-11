import type { ReactElement, ReactNode } from 'react'
import { Skeleton } from '../ui/skeleton'

type Fact = ReactNode | null | false | undefined

type PageSummaryContent = {
  /** The headline sentence. It must state a live number: never describe the page. */
  sentence: ReactNode
  /** Short facts under the headline, e.g. `['3 need you', oldest && `oldest ${oldest}`]`. */
  facts?: readonly Fact[]
  /** After the headline: a date or a freshness word. */
  aside?: ReactNode
  loading?: false
}

/** While the sentence's data loads: a skeleton of the same shape, no content props needed. */
type PageSummaryLoading = Partial<Omit<PageSummaryContent, 'loading'>> & {
  loading: true
}

export type PageSummaryProps = PageSummaryContent | PageSummaryLoading

const NO_FACTS: readonly Fact[] = []

const isShown = (fact: Fact): boolean =>
  fact !== null && fact !== false && fact !== undefined && fact !== ''

/**
 * Each fact draws its own dot one gap to its inline-start, centred in the gap, and the list clips
 * inline overflow: the fact that opens a wrapped line starts at the list's edge, so its dot falls
 * outside the clip and a line never begins with `·`. A focus ring inside a fact is drawn inward
 * for the same reason.
 */
const FACT =
  "relative min-w-0 before:absolute before:inset-s-[calc(-1*var(--facts-gap))] before:w-(--facts-gap) before:text-center before:text-faint before:content-['·'] [&_:where(a,button,[tabindex])]:focus-visible:outline-offset-[-2px]"

/**
 * A page's opening: one headline sentence that carries a live number, an optional facts line under
 * it and an optional aside after it. It renders an `h2` at the headline step: the page's `h1` is
 * the `PageBar` title, and a second one would split the outline. The sentence states a fact, "12
 * open, 3 need you", never "Overview of your tickets"; the title already says what the page is.
 *
 * `null`, `false`, `undefined` and `''` facts drop, so conditional facts pass inline. `loading`
 * renders a skeleton of the same shape, with a facts bar when `facts` is passed, so the page does
 * not jump when the numbers arrive.
 *
 * @useWhen a page opens with a headline that carries its live number and a line of supporting facts
 * @neverWhen the headline would restate the page title (leave it out) or the figure is a KPI card (use `StatCard`)
 *
 * @example
 * <PageSummary
 *   sentence={`${open} open, ${needYou} need you`}
 *   facts={[oldest && `oldest ${oldest}`, `${runs} runs today`]}
 *   aside="Today"
 * />
 *
 * @example
 * <PageSummary loading facts={[]} />
 */
export function PageSummary(props: PageSummaryProps): ReactElement {
  if (props.loading === true) {
    return (
      <div data-slot="page-summary" aria-busy="true" className="flex min-w-0 flex-col gap-1">
        <Skeleton className="w-3/5 text-lg" />
        {props.facts !== undefined && <Skeleton className="w-2/5 text-xs" />}
      </div>
    )
  }
  const { sentence, facts = NO_FACTS, aside } = props
  const shown = facts.filter(isShown)
  return (
    <div data-slot="page-summary" className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 min-w-0 font-head text-lg font-semibold tracking-tight text-balance text-foreground">
          {sentence}
        </h2>
        {aside !== undefined && (
          <span
            data-slot="page-summary-aside"
            className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
          >
            {aside}
          </span>
        )}
      </div>
      {shown.length > 0 && (
        <p
          data-slot="page-summary-facts"
          className="m-0 flex flex-wrap gap-x-(--facts-gap) overflow-x-clip text-xs text-muted-foreground [--facts-gap:--spacing(3)]"
        >
          {shown.map((fact, i) => (
            <span key={i} data-slot="page-summary-fact" className={FACT}>
              {fact}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
