import { Prose } from 'basalt-ui/page'
import type { ReactElement } from 'react'

export function Demo(): ReactElement {
  return (
    <Prose>
      <h2 id="reading-dashboards">Reading dashboards</h2>
      <p>
        A dashboard answers one question first. The headline figure names its base, and every chart
        below it explains the figure instead of repeating it.
      </p>
      <ul>
        <li>Lead with the answer.</li>
        <li>Show the threshold as a line, not a footnote.</li>
      </ul>
      <pre>
        <code>bunx basalt-ui init</code>
      </pre>
    </Prose>
  )
}
