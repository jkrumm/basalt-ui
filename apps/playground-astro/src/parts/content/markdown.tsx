import { Markdown } from 'basalt-ui/content'
import type { ReactElement } from 'react'

const SOURCE = [
  '## Weekly load',
  'Two quality sessions and one long run. Volume rises by at most 10 percent a week.',
  '- Keep easy days easy\n- Taper in week four',
  '| Week | Km | Sessions |\n| - | - | - |\n| 1 | 32 | 3 |\n| 2 | 36 | 3 |',
  '```ts\nexport const weekLoad = (km: number) => km * 1.1\n```',
].join('\n\n')

export function Demo(): ReactElement {
  return <Markdown contentTrust="trusted">{SOURCE}</Markdown>
}
