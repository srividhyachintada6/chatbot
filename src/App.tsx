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

const INTRO = `Hi, I'm viYa! A smart AI assistant, ready when you are. Ask me anything.`

const FALLBACK = `I couldn't reach the AI service. Make sure VITE_GROQ_API_KEY is set in .env.local.`

const SUGGESTIONS = ['Tell me a joke', 'What can you do?', 'Give me a quote', 'How are you today?']

const SYSTEM_PROMPT = `You are viYa, a smart, friendly assistant. Always structure your answers in 4 clear parts:

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
    const list = Array.isArray(parsed) ? (parsed as Chat[]) : []
    return list.map((c) => {
      if (!c.title || c.title === 'New chat') {
        const firstUser = (c.messages ?? []).find((m) => m.role === 'user')
        if (firstUser) return { ...c, title: generateTitle(firstUser.text) }
      }
      return c
    })
  } catch {
    return []
  }
}

function makeId(): number {
  return Date.now() + Math.floor(Math.random() * 10000)
}

interface BrandIconProps {
  size?: number
}

function BrandIcon({ size = 24 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M9 6a6 6 0 0 0-6 6v17a6 6 0 0 0 6 6h7.5v7.2a1.4 1.4 0 0 0 2.4 1l8.6-8.2H39a6 6 0 0 0 6-6V12a6 6 0 0 0-6-6H9Z"
        fill="currentColor"
      />
      <path d="M24 15.5l2 4.3 4.3 2-4.3 2-2 4.3-2-4.3-4.3-2 4.3-2 2-4.3Z" fill="var(--gold)" />
      <circle cx="40" cy="8" r="2.4" fill="currentColor" opacity="0.85" />
      <circle cx="43" cy="17" r="1.6" fill="var(--gold)" opacity="0.75" />
      <path d="M39.4 10.2l2.4 4.4" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
    </svg>
  )
}

const SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'of',
  'for',
  'on',
  'in',
  'with',
  'to',
  'at',
  'by',
  'vs',
])

function toTitleCase(input: string): string {
  const words = input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
  if (!words.length) return 'New chat'
  return words
    .map((w, i) => (i === 0 || !SMALL_WORDS.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function generateTitle(raw: string): string {
  const cleaned = raw.replace(/[^\w\s'.-]/g, ' ').replace(/\s+/g, ' ').trim()
  const lower = cleaned.toLowerCase()
  if (!lower) return 'New chat'

  const diff = lower.match(/what(?:'s| is)? the difference between (.+?) and (.+)$/)
  if (diff) return `${toTitleCase(diff[1])} vs ${toTitleCase(diff[2])}`

  const learn = lower.match(/how do (?:i|you|we) (?:learn|start learning) (.+)$/)
  if (learn) return `Learning ${toTitleCase(learn[1])}`

  const explain = lower.match(/^(?:please )?explain (.+)$/)
  if (explain) return toTitleCase(explain[1])

  const create = lower.match(/(?:can you (?:please )?)?(?:help me (?:to )?)?(?:create|make|build|write|generate) (?:a |an |the )?(.+)$/)
  if (create) return `${toTitleCase(create[1])} Help`

  const give = lower.match(/^(?:please )?(?:give|show|tell|provide|share) me (?:a |an |the )?(.+)$/)
  if (give) return toTitleCase(give[1])

  const howTo = lower.match(/how to (.+)$/)
  if (howTo) return toTitleCase(howTo[1])

  const want = lower.match(/^(?:i want to|i need to|i'd like to|i would like to|want to|need to|help me to) (.+)$/)
  if (want) return toTitleCase(want[1])

  if (lower.match(/^what can (?:i|you|we) do/)) return 'What I Can Do'

  if (lower.match(/^how (?:are|am) (?:i|you|we) doing?/)) return 'How I Am'

  const how = lower.match(/^how (?:do |does |can )?(.+)$/)
  if (how) return toTitleCase(how[1])

  const what = lower.match(/^(?:what is|what are|what's|what about) (?:the )?(.+)$/)
  if (what) return toTitleCase(what[1])

  const polite = lower.replace(/^(hi|hello|hey|yo|good morning|good afternoon|good evening|dear|please)\s*[, ]*/, '')
  const words = polite.split(/\s+/).filter(Boolean)
  const stop = new Set([
    'a',
    'an',
    'the',
    'to',
    'of',
    'for',
    'and',
    'with',
    'me',
    'my',
    'i',
    'you',
    'your',
    'can',
    'help',
    'about',
    'that',
    'this',
    'it',
    'is',
    'are',
    'do',
    'does',
  ])
  const meaningful = words.filter((w) => !stop.has(w))
  return toTitleCase((meaningful.length ? meaningful : words).slice(0, 4).join(' '))
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
        let title = c.title
        if (!title || title === 'New chat') {
          const source = firstText ?? nextMessages.find((m) => m.role === 'user')?.text
          title = source ? generateTitle(source) : 'New chat'
        }
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
              <span className="chat-item-icon">
                  <BrandIcon size={15} />
                </span>
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
          <span className="cup-mini">
              <BrandIcon size={14} />
            </span>
          <span>viYa • your chat history is saved locally</span>
        </div>
      </aside>

      {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)} />}

      <div className="chat">
        <header className="chat-header">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <div className="avatar-3d">
            <span className="avatar-cup">
              <BrandIcon size={24} />
            </span>
            <span className="avatar-steam steam-1" />
            <span className="avatar-steam steam-2" />
            <span className="avatar-steam steam-3" />
          </div>
          <div className="header-info">
            <h1>
              vi<span className="brand-accent">Y</span>a
            </h1>
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
              <div className="logo-scene">
                <div className="logo-ring">
                  <BrandIcon size={72} />
                  <span className="logo-spark spark-1" />
                  <span className="logo-spark spark-2" />
                </div>
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
              {msg.role === 'bot' && (
                <span className="bubble-avatar">
                  <BrandIcon size={16} />
                </span>
              )}
              <div className="bubble">{msg.role === 'bot' ? <FormattedText text={msg.text} /> : msg.text}</div>
            </div>
          ))}
          {typing && (
            <div className="message bot">
              <span className="bubble-avatar">
                <BrandIcon size={16} />
              </span>
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