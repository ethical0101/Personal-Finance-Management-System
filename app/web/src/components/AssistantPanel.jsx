import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { SUGGESTIONS } from '../lib/useAssistant.js'

export function Orb({ size = 84, thinking = false }) {
  return (
    <div className={`orb ${thinking ? 'thinking' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="orb-eye l" /><span className="orb-eye r" />
    </div>
  )
}

/** Docked AI assistant: orb, greeting, suggestion chips, chat. `page` = full-width Ask AI page. */
export default function AssistantPanel({ assistant, name, onClose, page = false }) {
  const { log, busy, ask, fresh } = assistant
  const [q, setQ] = useState('')
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [log, busy])
  function submit(e) { e.preventDefault(); ask(q); setQ('') }

  return (
    <div className={`assistant-inner ${page ? 'page' : ''}`}>
      <div className="assistant-head">
        <span className="assistant-title"><Icon name="insights" size={16} />AI Assistant</span>
        {onClose && <button className="icon-btn sm" onClick={onClose} aria-label="Hide assistant">✕</button>}
      </div>
      {fresh && (
        <div className="assistant-hero">
          <Orb thinking={busy} />
          <h3>Hi{name ? `, ${name}` : ''}</h3>
          <p>How can I help with your money today?</p>
        </div>
      )}
      <div className="chat-log" aria-live="polite">
        {log.slice(fresh ? 1 : 0).map((m, i) => <div key={i} className={`bubble ${m.role} ${m.err ? 'err' : ''}`}>{m.text}</div>)}
        {busy && <div className="bubble ai"><span className="typing"><i /><i /><i /></span></div>}
        <div ref={endRef} />
      </div>
      {fresh && (
        <div className="suggest-col">
          {SUGGESTIONS.slice(0, page ? 5 : 4).map(s => <button key={s} onClick={() => ask(s)}>{s}</button>)}
        </div>
      )}
      <form className="assistant-input" onSubmit={submit}>
        <input placeholder="Ask about your spending, budgets or goals…" value={q} onChange={e => setQ(e.target.value)} maxLength={500} />
        <button type="submit" disabled={busy || !q.trim()} aria-label="Send"><Icon name="send" size={17} /></button>
      </form>
    </div>
  )
}
