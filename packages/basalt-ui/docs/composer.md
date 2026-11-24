---
name: Composer
use when: 'a person writes a message that is sent: a chat prompt, a reply, a mail body'
never when: 'the text is a field of a form that saves with the form (use Textarea), or a search box (use Input)'
subpath: basalt-ui/ai
peers: ['@base-ui/react', react-markdown, rehype-sanitize, remark-gfm, remend]
slots: [composer, composer-files, composer-footer, composer-input]
---

# Composer

A message box: a growing textarea over a footer of add, mention, model and send. Text, mentions
and files come back to `onSend` as data.

## Signature

```ts
Composer<Value = unknown>({ "aria-label": label, onSend, status, onStop, placeholder, defaultValue, mentions, add, files: fileRules, model, disabled, className, }: ComposerProps<Value>): ReactElement
  aria-label: string
  onSend: (message: ComposerMessage<Value>) => unknown  // Sends the message
  status?: ComposerStatus  // `useChat`'s status; `submitted` and `streaming` turn send into stop
  onStop?: () => void  // `useChat`'s `stop`
  placeholder?: string
  defaultValue?: string  // The draft at mount
  mentions?: ComposerMentions<Value>  // Turns on `@` mentions over these options
  add?: readonly ComposerAddItem[]  // The add menu's entries
  files?: ComposerFiles  // Turns on attachments through the add menu
  model?: ModelPickerProps  // A model picker in the footer
  disabled?: boolean
  className?: string  // Layout only (`w-full`, `max-w-3xl`)
```

`ComposerMessage`, `ComposerProps`, `ComposerStatus`, `ModelPickerProps` import from `basalt-ui/ai`: `import type { ComposerMessage, ComposerProps, ComposerStatus, ModelPickerProps } from 'basalt-ui/ai'`.

## Example

```tsx
const { status, stop, sendMessage } = useChat({ chat })
<Composer aria-label="Message" status={status} onStop={stop} onSend={({ text }) => sendMessage({ text })} />
```
