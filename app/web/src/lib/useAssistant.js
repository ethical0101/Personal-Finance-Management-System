import { useState } from 'react'
import { api } from './api.js'

export const SUGGESTIONS = [
  'Where did most of my money go this month?',
  'Am I on track with my budgets?',
  'How can I save ₹5,000 more every month?',
  'Which of my expenses is the biggest outlier?',
  'How long until I reach my savings goals?',
]

const HELLO = 'Hi! Ask me anything about your own money — spending, budgets, goals, trends. I answer only from your Wealthline data.'

/** Chat state shared by the docked assistant panel and the full Ask AI page. */
export function useAssistant() {
  const [log, setLog] = useState([{ role: 'ai', text: HELLO }])
  const [busy, setBusy] = useState(false)

  async function ask(text) {
    const question = (text || '').trim()
    if (!question || busy) return
    setBusy(true)
    setLog(l => [...l, { role: 'me', text: question }])
    try {
      const r = await api('/insights/ask', { method: 'POST', body: { question } })
      setLog(l => [...l, { role: 'ai', text: r.answer }])
    } catch (e) {
      setLog(l => [...l, { role: 'ai', err: true, text: e.message }])
    } finally { setBusy(false) }
  }
  return { log, busy, ask, fresh: log.length <= 1 }
}
