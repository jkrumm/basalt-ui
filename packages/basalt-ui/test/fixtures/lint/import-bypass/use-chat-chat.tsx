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
