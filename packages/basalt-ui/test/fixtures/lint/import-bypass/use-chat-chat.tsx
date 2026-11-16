// Fixture: import-boundary/use-chat-chat (the unlessCallHas chat guard)
// @invalid
const chat = useChat()
// @invalid
const chat = useChat({ api: '/api/chat' })
// @invalid
const chat = ai.useChat({ id })
// @valid
const chat = useChat({ chat })
// @valid
const chat = useChat({ chat: sharedChat })
// @valid
const chat = useChat({ ...options })
// @valid
const chat = useChat(options)
// @valid
const store = useChatStore()
// @invalid
import { useChat as useLegacyChat } from 'ai/react'
export const legacy = () => useLegacyChat({ api: '/api/chat' })
// @invalid
const opts = { id: 'support' }
const chat = useChat(opts)
// @valid
const opts = { id: 'support', chat: sharedChat }
const chat = useChat(opts)
// @valid
const opts = { ...base }
const chat = useChat(opts)
// @valid
import { useChat as useLegacyChat } from 'ai/react'
export const legacy = () => useLegacyChat({ chat })
