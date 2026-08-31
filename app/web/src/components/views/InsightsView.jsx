import { useEffect, useState } from 'react'
import { api, money } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'

export default function InsightsView({ refreshKey }) {
  const [forecasts, setForecasts] = useState([])
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)
  const [actedOn, setActedOn] = useState({})
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([api('/insights/forecast'), api('/insights/recommendations')]).then(([f, r]) => {
      if (cancelled) return
      setForecasts(f); setRecs(r); setLoading(false)
    })
    return () => { cancelled = true }
  }, [refreshKey])

  async function handleAction(id, action) {
    await api(`/insights/recommendations/${id}/action`, { method: 'POST', body: { action } })
    setActedOn(a => ({ ...a, [id]: action }))
    toast(action === 'accepted' ? 'Recommendation accepted.' : 'Recommendation dismissed.', 'success')
  }

  return (
    <section className="view active">
      <div className="page-head">
        <div>
          <h1>AI Insights</h1>
          <p>Expense forecasts (linear regression) and Gemini-generated recommendations, built from your own transaction history.</p>
        </div>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="section-title"><h3>Next-month expense forecast</h3></div>
          {forecasts.length ? forecasts.map(f => (
            <div key={f.categoryId} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="section-title" style={{ marginBottom: 2 }}>
                <h3 style={{ fontSize: 13.5 }}>{f.categoryName}</h3>
                <span className="chip neutral">{f.method}</span>
              </div>
              <p style={{ margin: 0 }}>Forecast next month: <b className="mono" style={{ color: 'var(--ink)' }}>{money(f.forecast)}</b> (confidence: {f.confidence})</p>
            </div>
          )) : <div className="empty">Add a few expenses to unlock forecasts.</div>}
        </div>
        <div className="card">
          <div className="section-title"><h3>Recommendations</h3></div>
          {loading ? <div className="empty">Loading…</div> : recs.length ? recs.map(r => (
            <div className="rec-card" key={r.id}>
              <div className={`stripe ${r.severity}`} />
              <div className="body">
                <div className="msg">{r.message}</div>
                {r.suggestion && <div className="suggestion">{r.suggestion}</div>}
                {r.source && <div className="source">{r.source}</div>}
                {actedOn[r.id] ? (
                  <div className="suggestion" style={{ marginTop: 6 }}>{actedOn[r.id] === 'accepted' ? 'Accepted' : 'Dismissed'}</div>
                ) : (
                  <div className="rec-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => handleAction(r.id, 'accepted')}>Accept</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleAction(r.id, 'dismissed')}>Dismiss</button>
                  </div>
                )}
              </div>
            </div>
          )) : <div className="empty">No recommendations right now — you're on track.</div>}
        </div>
      </div>
    </section>
  )
}
