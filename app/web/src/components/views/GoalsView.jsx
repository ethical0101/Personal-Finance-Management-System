import { useEffect, useState } from 'react'
import { api, money } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { SkelCards } from '../Skeleton.jsx'
import Modal from '../Modal.jsx'

export default function GoalsView({ refreshKey, bumpRefresh }) {
  const [goals, setGoals] = useState([])
  const [avgSavings, setAvgSavings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [contributeGoal, setContributeGoal] = useState(null)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    Promise.all([api('/goals'), api('/dashboard/summary')])
      .then(([g, sum]) => {
        if (cancelled) return
        setGoals(g)
        const done = sum.trend.slice(0, -1).slice(-3).filter(t => t.income > 0)   // last full months
        setAvgSavings(done.length ? done.reduce((a, t) => a + (t.income - t.expense), 0) / done.length : 0)
      })
      .catch(e => { if (!cancelled) toast(e.message, 'error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  async function handleAddGoal(fd) {
    await api('/goals', {
      method: 'POST',
      body: { name: fd.get('name'), targetAmount: Number(fd.get('targetAmount')), deadline: fd.get('deadline') || null },
    })
    toast('Goal created.', 'success')
    bumpRefresh()
  }

  async function handleContribute(fd) {
    await api(`/goals/${contributeGoal.id}/contribute`, { method: 'POST', body: { amount: Number(fd.get('amount')) } })
    toast('Contribution recorded.', 'success')
    bumpRefresh()
  }

  function eta(g) {
    const remaining = Math.max(0, g.targetAmount - g.currentAmount)
    if (remaining === 0) return { text: 'Goal reached', tone: 'good' }
    if (avgSavings <= 0) return { text: 'Save more each month to reach this', tone: 'warn' }
    const months = Math.ceil(remaining / avgSavings)
    const when = new Date(); when.setMonth(when.getMonth() + months)
    const label = when.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    let behind = false, needed = null
    if (g.deadline) {
      const monthsLeft = Math.max(1, Math.round((new Date(g.deadline) - new Date()) / (30.4 * 86400000)))
      if (months > monthsLeft) { behind = true; needed = Math.ceil(remaining / monthsLeft) }
    }
    return { text: `On track for ${label} (~${months} mo at ${money(avgSavings).replace('.00', '')}/mo)`, tone: behind ? 'warn' : 'good', behind, needed }
  }

  return (
    <section className="view active">
      <div className="page-head">
        <div><h1>Financial Goals</h1><p>Track progress toward what you're saving for.</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} disabled={loading}>+ Add goal</button>
      </div>
      {loading ? <SkelCards count={3} cols={3} /> : (
        <div className="grid cols-3">
          {goals.length ? goals.map(g => {
            const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0
            return (
              <div className="card" key={g.id}>
                <div className="section-title"><h3>{g.name}</h3><span className="chip neutral">{pct}%</span></div>
                <p style={{ marginBottom: 6 }}>{money(g.currentAmount)} of {money(g.targetAmount)}{g.deadline ? ` · by ${g.deadline}` : ''}</p>
                <div className="progress-track"><div className="progress-fill ok" style={{ width: `${pct}%` }} /></div>
                {(() => { const e = eta(g); return (
                  <div style={{ marginTop: 8 }}>
                    <span className={`chip ${e.tone}`}>{e.behind ? 'Behind deadline' : e.text}</span>
                    {e.behind && <p style={{ fontSize: 12.5, margin: '8px 0 0' }}>{e.text}. To hit {g.deadline}, set aside <b>{money(e.needed).replace('.00', '')}/mo</b>.</p>}
                  </div>) })()}
                <div className="modal-foot" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => setContributeGoal(g)}>+ Contribute</button>
                </div>
              </div>
            )
          }) : <div className="empty">No goals yet — set your first savings target.</div>}
        </div>
      )}

      {showAdd && (
        <Modal title="Add goal" onClose={() => setShowAdd(false)} onSubmit={handleAddGoal}>
          <div className="field"><label>Name</label><input name="name" type="text" required placeholder="e.g. Emergency fund" /></div>
          <div className="field"><label>Target amount</label><input name="targetAmount" type="number" step="0.01" min="1" required /></div>
          <div className="field"><label>Deadline (optional)</label><input name="deadline" type="date" /></div>
        </Modal>
      )}
      {contributeGoal && (
        <Modal title="Add to goal" onClose={() => setContributeGoal(null)} onSubmit={handleContribute}>
          <div className="field"><label>Amount</label><input name="amount" type="number" step="0.01" min="0.01" required /></div>
        </Modal>
      )}
    </section>
  )
}
