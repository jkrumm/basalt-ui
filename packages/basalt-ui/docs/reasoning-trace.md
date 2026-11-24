---
name: ReasoningTrace
use when: 'the reasoning and tool calls behind a model reply, from another runtime than partView reads'
never when: 'the steps are a process the person drives (use a StepRail or a Stepper)'
subpath: basalt-ui/ai
peers: ['@base-ui/react', '@shikijs/langs', '@shikijs/themes', pele, react-markdown, rehype-sanitize, remark-gfm, remend, shiki]
slots: [ai-trace]
---

# ReasoningTrace

The steps behind a reply, folded to one line once it has settled. `partView` draws a message's
reasoning and tool parts through it; draw it yourself for steps another runtime reports.

## Signature

```ts
ReasoningTrace({ steps, settled, toolRenderers, }: ReasoningTraceProps): ReactElement
  steps: readonly TraceStep[]
  settled?: boolean  // False while the reply streams: the rail stays open
  toolRenderers?: Record<string, (view: ToolView) => ReactNode>  // A tool's own row by tool name, as `partView`'s option of the same name
```

`ToolView`, `TraceStep` import from `basalt-ui/ai`: `import type { ToolView, TraceStep } from 'basalt-ui/ai'`.

## Example

```tsx
<ReasoningTrace steps={[{ kind: 'reasoning', text: 'Checking stock' }, { kind: 'tool', view }]} settled />
```
