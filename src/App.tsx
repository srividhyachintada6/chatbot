import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface Message {
  id: number
  role: 'user' | 'bot'
  text: string
}

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

let nextId = 0

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
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || typing) return
    const updated = [...messages, { id: nextId++, role: 'user' as const, text: trimmed }]
    setMessages(updated)
    setInput('')
    setTyping(true)
    try {
      const reply = await getGroqReply(updated)
      setMessages((prev) => [...prev, { id: nextId++, role: 'bot', text: reply }])
    } catch {
      setMessages((prev) => [...prev, { id: nextId++, role: 'bot', text: `Something went wrong: ${FALLBACK}` }])
    } finally {
      setTyping(false)
    }
  }

  return (
    <div className="chat">
      <header className="chat-header">
        <div className="avatar">☕</div>
        <div className="header-info">
          <h1>Brew</h1>
          <span className="status">
            <span className="dot" /> Online
          </span>
        </div>
        <button className="clear-btn" onClick={() => setMessages([])} title="Clear chat">
          ✕
        </button>
      </header>

      <main className="chat-body">
        {messages.length === 0 && (
          <div className="welcome">
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
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
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
  )
}
