// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:chat-thread-composer
import { Composer } from 'basalt-ui/ai'
import type { ComposerMessage, ComposerStatus } from 'basalt-ui/ai'
import type { ListLoader } from 'basalt-ui/ui/combobox'

type Doc = { id: string; title: string }
type Send = (message: { text: string; metadata: { docs: string[] } }) => Promise<void>
type Props = { status: ComposerStatus; stop: () => void; send: Send; docs: ListLoader<Doc> }

/** The mentions travel beside the text as ids the server resolves, never parsed back out of it. */
export function ChatComposer({ status, stop, send, docs }: Props) {
  const onSend = ({ text, mentions }: ComposerMessage<Doc>) =>
    send({ text, metadata: { docs: mentions.map((m) => m.value.id) } })
  return (
    <Composer<Doc>
      aria-label="Message"
      status={status}
      onStop={stop}
      onSend={onSend}
      mentions={{ source: docs }}
      files={{ accept: 'image/*,.pdf', maxSize: 10_000_000 }}
      model={{
        'aria-label': 'Model',
        options: [
          { value: 'fast', label: 'Fast' },
          { value: 'deep', label: 'Deep' },
        ],
        defaultValue: 'fast',
      }}
    />
  )
}
// #endregion
