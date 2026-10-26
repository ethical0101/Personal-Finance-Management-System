import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api.js'
import Icon from '../Icon.jsx'

const SUGGESTIONS = [
  'Where did most of my money go this month?',
  'Am I on track with my budgets?',
  'How can I save ₹5,000 more every month?',
  'Which of my expenses is the biggest outlier?',
  'How long until I reach my savings goals?',
]

export default function AskView() {
  const [log, setLog] = useState([{ role: 'ai', text: "Hi! Ask me anything about your own money — spending, budgets, goals, trends. I answer only from your Wealthline data." }])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [log, busy])

  async function ask(question) {
    const text = (question ?? q).trim()
    if (!text || busy) return
    setQ(''); setBusy(true)
    setLog(l => [...l, { role: 'me', text }])
    try {
      const r = await api('/insights/ask', { method: 'POST', body: { question: text } })
      setLog(l => [...l, { role: 'ai', text: r.answer }])
    } catch (e) {
      setLog(l => [...l, { role: 'ai', err: true, text: e.message }])
    } finally { setBusy(false) }
  }

  return (
    <section>
      <div className="page-head">
        <div><h1>Ask AI</h1><p>A finance assistant that has read your accounts, budgets, goals and recent transactions — and nothing else.</p></div>
      </div>
      <div className="card chat">
        <div className="chat-log" aria-live="polite">
          {log.map((m, i) => <div key={i} className={`bubble ${m.role} ${m.err ? 'err' : ''}`}>{m.text}</div>)}
          {busy && <div className="bubble ai"><span className="typing"><i /><i /><i /></span></div>}
          <div ref={endRef} />
        </div>
        {log.length <= 1 && (
          <div className="suggest-row">{SUGGESTIONS.map(s => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>
        )}
        <form className="chat-input" onSubmit={e => { e.preventDefault(); ask() }}>
          <input className="input" placeholder="Ask about your spending, budgets or goals…" value={q} onChange={e => setQ(e.target.value)} maxLength={500} />
          <button className="btn btn-primary" type="submit" disabled={busy || !q.trim()}><Icon name="send" />Send</button>
        </form>
      </div>
    </section>
  )
}
