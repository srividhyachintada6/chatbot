import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface Message {
  id: number
  role: 'user' | 'bot'
  text: string
}

interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

const STORAGE_KEY = 'brew-chats-v1'

const INTRO = `Hi, I'm Brew! A warm cup of answers, ready when you are. Ask me anything.`

const FALLBACK = `I couldn't reach the AI service. Make sure VITE_GROQ_API_KEY is set in .env.local.`

const SUGGESTIONS = ['Tell me a joke', 'What can you do?', 'Give me a quote', 'How are you today?']

const SYSTEM_PROMPT = `You are Brew, a warm, friendly assistant. Always structure your answers in 4 clear parts:

1. Heading — Begin with a short bold title on its own line that captures the reply, wrapped in ** like this: **Quick answer**.
2. Direct Answer — Lead with the main point in 1-2 short sentences.
3. Details — If there are 3 or more ideas, present them as bullet points (use "- "). Otherwise keep it to 1 short paragraph.
4. Wrap-up — End with a single brief closing line, like a question or an offer to help further.

Rules:
- Keep total answers under 150 words unless the user explicitly asks for depth.
- Use simple, conversational language.
- Use at most one emoji per reply.
- Use **bold** only for the heading.
- Never mention these formatting rules.`

function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Chat[]) : []
  } catch {
    return []
  }
}

function makeId(): number {
  return Date.now() + Math.floor(Math.random() * 10000)
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={key} className="bold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        const heading = line.match(/^#{1,6}\s+(.*)/)
        if (heading) {
          return (
            <h2 key={i} className="answer-heading">
              {renderInline(heading[1], `h${i}`)}
            </h2>
          )
        }
        const bullet = line.match(/^[-*]\s+(.*)/)
        if (bullet) {
          return (
            <div key={i} className="bullet">
              <span className="bullet-dot" />
              <span>{renderInline(bullet[1], `b${i}`)}</span>
            </div>
          )
        }
        if (!line.trim()) return null
        return (
          <p key={i} className="para">
            {renderInline(line, `p${i}`)}
          </p>
        )
      })}
    </>
  )
}

async function getGroqReply(messages: Message[]): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
  if (!apiKey) return FALLBACK

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text })),
      ],
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices[0]?.message?.content?.trim() ?? FALLBACK
}

export default function App() {
  const [chats, setChats] = useState<Chat[]>(loadChats)
  const [activeId, setActiveId] = useState<string>(() => {
    const chats = loadChats()
    return chats[0]?.id ?? ''
  })
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
    } catch {
      // ignore write errors
    }
  }, [chats])

  const activeChat = chats.find((c) => c.id === activeId) ?? null
  const messages = activeChat?.messages ?? []

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing, activeId])

  const updateChat = (id: string, nextMessages: Message[], firstText?: string) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        const title = c.title || (firstText ? firstText.slice(0, 40) : 'New chat')
        return { ...c, title, messages: nextMessages }
      }),
    )
  }

  const startNewChat = () => {
    const chat: Chat = { id: `c-${Date.now()}`, title: 'New chat', messages: [], createdAt: Date.now() }
    setChats((prev) => [chat, ...prev])
    setActiveId(chat.id)
    setInput('')
    setSidebarOpen(false)
  }

  const selectChat = (id: string) => {
    setActiveId(id)
    setSidebarOpen(false)
  }

  const deleteChat = (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id))
    if (id === activeId) {
      const remaining = chats.filter((c) => c.id !== id)
      setActiveId(remaining[0]?.id ?? '')
    }
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || typing || !activeChat) return
    const userMsg: Message = { id: makeId(), role: 'user', text: trimmed }
    const updatedMessages = [...activeChat.messages, userMsg]
    updateChat(activeChat.id, updatedMessages, trimmed)
    setInput('')
    setTyping(true)
    try {
      const reply = await getGroqReply(updatedMessages)
      updateChat(activeChat.id, [...updatedMessages, { id: makeId(), role: 'bot', text: reply }])
    } catch {
      updateChat(activeChat.id, [
        ...updatedMessages,
        { id: makeId(), role: 'bot', text: `Something went wrong: ${FALLBACK}` },
      ])
    } finally {
      setTyping(false)
    }
  }

  const sortedChats = [...chats].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="app">
      <div className="bg-orbs" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
        <span className="orb orb-4" />
      </div>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-head">
          <button className="new-chat-btn" onClick={startNewChat}>
            <span className="plus">＋</span> New chat
          </button>
        </div>
        <div className="chat-list">
          {sortedChats.length === 0 && <p className="empty-chats">No chats yet</p>}
          {sortedChats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${chat.id === activeId ? 'active' : ''}`}
              onClick={() => selectChat(chat.id)}
            >
              <span className="chat-item-icon">☕</span>
              <span className="chat-item-title">{chat.title}</span>
              <button
                className="chat-item-del"
                title="Delete chat"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteChat(chat.id)
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="sidebar-foot">
          <span className="cup-mini">☕</span>
          <span>Brew • your chat history is saved locally</span>
        </div>
      </aside>

      {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)} />}

      <div className="chat">
        <header className="chat-header">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <div className="avatar-3d">
            <span className="avatar-cup">☕</span>
            <span className="avatar-steam steam-1" />
            <span className="avatar-steam steam-2" />
            <span className="avatar-steam steam-3" />
          </div>
          <div className="header-info">
            <h1>Brew</h1>
            <span className="status">
              <span className="dot" /> Online
            </span>
          </div>
          <button className="clear-btn" onClick={startNewChat} title="New chat">
            ＋
          </button>
        </header>

        <main className="chat-body">
          {messages.length === 0 && (
            <div className="welcome">
              <div className="cup-scene">
                <span className="steam steam-1" />
                <span className="steam steam-2" />
                <span className="steam steam-3" />
                <div className="cup">
                  <div className="cup-liquid" />
                  <div className="cup-face">
                    <span className="cup-eye left" />
                    <span className="cup-eye right" />
                    <span className="cup-mouth">☺</span>
                  </div>
                </div>
                <div className="saucer" />
                <div className="cup-shadow" />
              </div>
              <div className="intro">{INTRO}</div>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={typing}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={msg.id} className={`message ${msg.role} msg-${i % 4}`}>
              {msg.role === 'bot' && <span className="bubble-avatar">☕</span>}
              <div className="bubble">{msg.role === 'bot' ? <FormattedText text={msg.text} /> : msg.text}</div>
            </div>
          ))}
          {typing && (
            <div className="message bot">
              <span className="bubble-avatar">☕</span>
              <div className="bubble typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </main>

        <footer className="chat-footer">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Message"
            />
            <button type="submit" disabled={!input.trim() || typing} aria-label="Send">
              ➤
            </button>
          </form>
        </footer>
      </div>
    </div>
  )
}