---
name: MessageActions
use when: 'the copy, regenerate, feedback and edit buttons of a message the app draws itself'
never when: 'the message is a `Message`: give it `actions` instead'
subpath: basalt-ui/ai
peers: ['@base-ui/react', react-markdown, rehype-sanitize, remark-gfm, remend]
slots: [ai-message-actions]
---

# MessageActions

The actions of one message as a toolbar of icon buttons. Inside a `Message` they show on hover
and focus; alone they are always shown.

## Signature

```ts
MessageActions({ actions, reveal, }: MessageActionsProps): ReactElement | null
  actions: readonly MessageAction[]
  reveal?: "always" | "hover"  // `hover` shows them on hover and focus of the message (default); `always` keeps them shown
```

`MessageAction` import from `basalt-ui/ai`: `import type { MessageAction } from 'basalt-ui/ai'`.

## Example

```tsx
<MessageActions actions={[{ kind: 'copy', text }, { kind: 'regenerate', onSelect: regenerate }]} />
```
