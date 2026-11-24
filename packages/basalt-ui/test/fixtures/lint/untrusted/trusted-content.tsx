// Blocks: see ../structure-rest/color-literal.tsx.

// @invalid
// @filename src/chat/reply.tsx
// @options {"authoredContent":["src/vault/**"]}
const A = ({ text }) => <Markdown contentTrust="trusted">{text}</Markdown>

// @invalid
// @filename src/chat/reply.tsx
import { Markdown } from 'basalt-ui/content'
const A = ({ note }) => <Markdown contentTrust={'trusted'}>{note}</Markdown>

// @invalid
// @filename src/chat/reply.tsx
const A = () => <Markdown contentTrust="trusted">{reply()}</Markdown>

// @invalid
// @filename src/chat/reply.tsx
const A = ({ body }) => <Markdown contentTrust="trusted" children={body} />

// @invalid
// @filename src/chat/reply.tsx
const A = (props) => <Markdown contentTrust="trusted" {...props} />

// @invalid
// @filename src/chat/reply.tsx
const A = ({ m }) => {
  const trust = 'trusted'
  return <Markdown contentTrust={trust}>{m.text}</Markdown>
}

// @invalid
// @filename src/chat/reply.tsx
const A = ({ m, authored }) => (
  <Markdown contentTrust={authored ? 'trusted' : 'untrusted'}>{m.text}</Markdown>
)

// @valid
const A = ({ mode }) => <Markdown contentTrust={mode}>{'Authored **text**'}</Markdown>

// @valid
const A = ({ reply }) => <Markdown contentTrust={'untrusted'}>{reply}</Markdown>

// @valid
const A = () => <Markdown contentTrust="trusted">{'Authored **text**'}</Markdown>

// @valid
import intro from './intro.md?raw'
const A = () => <Markdown contentTrust="trusted">{intro}</Markdown>

// @valid
// @filename src/vault/note-view.tsx
// @options {"authoredContent":["src/vault/**"]}
const A = ({ note }) => <Markdown contentTrust="trusted">{note}</Markdown>

// @valid
const A = ({ reply }) => <Markdown contentTrust="untrusted">{reply}</Markdown>

// @invalid
// @filename src/chat/reply.tsx
const trusted = { contentTrust: 'trusted' }
const A = ({ m }) => <Markdown {...trusted}>{m.text}</Markdown>

// @valid
// @filename src/chat/reply.tsx
const safe = { contentTrust: 'untrusted' }
const A = ({ m }) => <Markdown {...safe}>{m.text}</Markdown>
