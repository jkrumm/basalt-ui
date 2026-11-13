/**
 * The MDX scenario (docs/v3/concepts/ai-mdx.md section 4): one authored page compiled at build time
 * and rendered through `mdxComponents`. The shot route is `/scenarios/mdx`.
 */
import { Post } from '../recipes/mdx'
import Content from './mdx-fixture.mdx'

export function MdxScenario() {
  return (
    <div data-shot="mdx" className="px-4 py-6">
      <Post Content={Content} />
    </div>
  )
}
