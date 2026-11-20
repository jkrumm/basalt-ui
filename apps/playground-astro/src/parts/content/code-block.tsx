import { CodeBlock } from 'basalt-ui/content'
import type { ReactElement } from 'react'

const SOURCE = 'export function weekLoad(km: number): number {\n  return km * 1.1\n}'

export function Demo(): ReactElement {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <CodeBlock lang="ts" code={SOURCE} />
      <CodeBlock lang="bash" code="bun add basalt-ui" />
    </div>
  )
}
