import { useEffect, useState } from 'react'
import { api, money } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { SkelRows, SkelList } from '../Skeleton.jsx'

export default function InsightsView({ refreshKey }) {
  const [forecasts, setForecasts] = useState([])
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)
  const [actedOn, setActedOn] = useState({})
  const [simCat, setSimCat] = useState('')
  const [simCut, setSimCut] = useState(20)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([api('/insights/forecast'), api('/insights/recommendations')])
      .then(([f, r]) => { if (!cancelled) { setForecasts(f); setRecs(r) } })
      .catch(e => { if (!cancelled) toast(e.message, 'error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  async function handleAction(id, action) {
    await api(`/insights/recommendations/${id}/action`, { method: 'POST', body: { action } })
    setActedOn(a => ({ ...a, [id]: action }))
    toast(action === 'accepted' ? 'Recommendation accepted.' : 'Recommendation dismissed.', 'success')
  }

  const simRow = forecasts.find(f => f.categoryId === simCat) || forecasts[0]
  const monthlySave = simRow ? simRow.forecast * (simCut / 100) : 0

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
          {loading ? <SkelRows count={3} /> : forecasts.length ? forecasts.map(f => (
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
          {loading ? <SkelList count={3} /> : recs.length ? recs.map(r => (
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
      <div className="card" style={{ marginTop: 18 }}>
        <div className="section-title"><h3>What-if savings simulator</h3><span className="chip info">Try it</span></div>
        {loading ? <SkelRows count={2} /> : simRow ? (
          <div className="grid cols-2" style={{ alignItems: 'center' }}>
            <div>
              <div className="field"><label>If I cut spending on</label>
                <select value={simRow.categoryId} onChange={e => setSimCat(e.target.value)}>{forecasts.map(f => <option key={f.categoryId} value={f.categoryId}>{f.categoryName} (forecast {money(f.forecast).replace('.00', '')}/mo)</option>)}</select></div>
              <div className="field"><label>by {simCut}%</label>
                <input type="range" min="5" max="60" step="5" value={simCut} onChange={e => setSimCut(Number(e.target.value))} style={{ accentColor: 'var(--accent)' }} /></div>
            </div>
            <div className="impact" style={{ margin: 0 }}>
              <div className="row"><span>Saved every month</span><span className="mono">{money(monthlySave).replace('.00', '')}</span></div>
              <div className="row"><span>Saved in a year</span><span className="mono">{money(monthlySave * 12).replace('.00', '')}</span></div>
              <div className="note">That is {money(monthlySave * 12).replace('.00', '')} you could move into a goal — based on your forecast for {simRow.categoryName}.</div>
            </div>
          </div>
        ) : <div className="empty">Add a few expenses to unlock the simulator.</div>}
      </div>
    </section>
  )
}
