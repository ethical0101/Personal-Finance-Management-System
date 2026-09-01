import { useEffect, useState } from 'react'
import { api, money } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { SkelTableRows } from '../Skeleton.jsx'
import Modal from '../Modal.jsx'

export default function BillsView({ refreshKey, bumpRefresh }) {
  const [bills, setBills] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    Promise.all([api('/bills'), api('/categories')])
      .then(([b, c]) => { if (!cancelled) { setBills(b); setCategories(c) } })
      .catch(e => { if (!cancelled) toast(e.message, 'error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  async function handleDelete(id) {
    try {
      await api(`/bills/${id}`, { method: 'DELETE' })
      bumpRefresh()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleSubmit(fd) {
    await api('/bills', {
      method: 'POST',
      body: {
        name: fd.get('name'), categoryId: fd.get('categoryId'),
        amount: Number(fd.get('amount')), dueDay: Number(fd.get('dueDay')),
      },
    })
    toast('Recurring bill added.', 'success')
    bumpRefresh()
  }

  return (
    <section className="view active">
      <div className="page-head">
        <div><h1>Recurring Bills</h1><p>Bills that repeat every month.</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} disabled={loading}>+ Add bill</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Name</th><th>Category</th><th className="num">Amount</th><th className="num">Due day</th><th></th></tr></thead>
          <tbody>
            {loading ? <SkelTableRows rows={3} cols={5} /> : bills.length ? bills.map(b => {
              const cat = categories.find(c => c.id === b.categoryId)
              return (
                <tr key={b.id}>
                  <td>{b.name}</td><td>{cat ? cat.name : '—'}</td>
                  <td className="num">{money(b.amount)}</td><td className="num">{b.dueDay}</td>
                  <td><button className="btn btn-sm btn-ghost" onClick={() => handleDelete(b.id)}>Delete</button></td>
                </tr>
              )
            }) : <tr><td colSpan={5}><div className="empty">No recurring bills yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <Modal title="Add recurring bill" onClose={() => setShowAdd(false)} onSubmit={handleSubmit}>
          <div className="field"><label>Name</label><input name="name" type="text" required placeholder="e.g. Internet" /></div>
          <div className="field">
            <label>Category</label>
            <select name="categoryId">{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>
          <div className="field"><label>Amount</label><input name="amount" type="number" step="0.01" min="0.01" required /></div>
          <div className="field"><label>Due day of month</label><input name="dueDay" type="number" min="1" max="28" defaultValue="1" required /></div>
        </Modal>
      )}
    </section>
  )
}
