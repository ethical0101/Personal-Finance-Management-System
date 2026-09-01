import { useEffect, useState } from 'react'
import { api, money } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { SkelRows } from '../Skeleton.jsx'
import Modal from '../Modal.jsx'

export default function BudgetsView({ refreshKey, bumpRefresh }) {
  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    Promise.all([api('/budgets'), api('/categories')])
      .then(([b, c]) => { if (!cancelled) { setBudgets(b); setCategories(c) } })
      .catch(e => { if (!cancelled) toast(e.message, 'error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  async function handleSubmit(fd) {
    await api('/budgets', {
      method: 'POST',
      body: { categoryId: fd.get('categoryId'), monthlyLimit: Number(fd.get('monthlyLimit')) },
    })
    toast('Budget saved.', 'success')
    bumpRefresh()
  }

  return (
    <section className="view active">
      <div className="page-head">
        <div><h1>Budgets</h1><p>Monthly limits per category, tracked against real spend.</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} disabled={loading}>+ Set budget</button>
      </div>
      <div className="card">
        {loading ? <SkelRows count={4} /> : budgets.length ? budgets.map(b => {
          const cat = categories.find(c => c.id === b.categoryId)
          const over = b.percentUsed > 100
          return (
            <div key={b.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="section-title" style={{ marginBottom: 4 }}>
                <h3 style={{ fontSize: 13.5 }}>{cat ? cat.name : '—'}</h3>
                <span className={`chip ${over ? 'critical' : 'neutral'}`}>{money(b.spent)} / {money(b.monthlyLimit)}</span>
              </div>
              <div className="progress-track"><div className={`progress-fill ${over ? 'over' : ''}`} style={{ width: `${Math.min(100, b.percentUsed)}%` }} /></div>
            </div>
          )
        }) : <div className="empty">No budgets set for this month yet.</div>}
      </div>
      {showAdd && (
        <Modal title="Set monthly budget" onClose={() => setShowAdd(false)} onSubmit={handleSubmit}>
          <div className="field">
            <label>Category</label>
            <select name="categoryId">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>
          <div className="field"><label>Monthly limit</label><input name="monthlyLimit" type="number" step="0.01" min="1" required /></div>
        </Modal>
      )}
    </section>
  )
}
