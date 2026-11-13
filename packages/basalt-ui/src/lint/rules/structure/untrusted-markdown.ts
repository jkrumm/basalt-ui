/**
 * `basalt/untrusted-markdown` (guardrails section 4, row 13): registered ahead of its body. The
 * four forms (`dangerouslySetInnerHTML` on a non-literal, `rehype-raw`, MDX evaluate/run,
 * `contentTrust="trusted"` without a literal, import or authored path) are built by v3-ai-i5;
 * until then the id is in the table with no form and reports nothing.
 */
import { defineRules } from '../../rule-table'

export const untrustedMarkdownRules = defineRules({
  'untrusted-markdown': {
    family: 'structure',
    profiles: ['parts', 'app'],
    defect:
      'contentTrust defaulted to trusted; //attacker.example passed the prefix check (self-agent-content, gap-perf)',
    forms: [],
  },
})
