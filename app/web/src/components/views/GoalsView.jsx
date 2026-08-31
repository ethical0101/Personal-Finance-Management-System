import { useEffect, useState } from 'react'
import { api, money } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import Modal from '../Modal.jsx'

export default function GoalsView({ refreshKey, bumpRefresh }) {
  const [goals, setGoals] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [contributeGoal, setContributeGoal] = useState(null)
  const toast = useToast()

  useEffect(() => { api('/goals').then(setGoals) }, [refreshKey])

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

  return (
    <section className="view active">
      <div className="page-head">
        <div><h1>Financial Goals</h1><p>Track progress toward what you're saving for.</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add goal</button>
      </div>
      <div className="grid cols-3">
        {goals.length ? goals.map(g => {
          const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0
          return (
            <div className="card" key={g.id}>
              <div className="section-title"><h3>{g.name}</h3><span className="chip neutral">{pct}%</span></div>
              <p style={{ marginBottom: 6 }}>{money(g.currentAmount)} of {money(g.targetAmount)}{g.deadline ? ` · by ${g.deadline}` : ''}</p>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
              <div className="modal-foot" style={{ justifyContent: 'flex-start', marginTop: 12 }}>
                <button className="btn btn-sm btn-primary" onClick={() => setContributeGoal(g)}>+ Contribute</button>
              </div>
            </div>
          )
        }) : <div className="empty">No goals yet — set your first savings target.</div>}
      </div>

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
