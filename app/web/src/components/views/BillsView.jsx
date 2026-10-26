import { useEffect, useState } from 'react'
import { api, money } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { SkelTableRows } from '../Skeleton.jsx'
import Modal from '../Modal.jsx'
import Icon from '../Icon.jsx'

export default function BillsView({ refreshKey, bumpRefresh }) {
  const [bills, setBills] = useState([])
  const [subs, setSubs] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    Promise.all([api('/bills'), api('/categories'), api('/insights/subscriptions')])
      .then(([b, c, sb]) => { if (!cancelled) { setBills(b); setCategories(c); setSubs(sb) } })
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

  async function trackSub(sub) {
    try {
      const day = Math.min(28, Number(sub.lastCharged.slice(8)) || 1)
      await api('/bills', { method: 'POST', body: { name: sub.name, categoryId: sub.categoryId, amount: sub.amount, dueDay: day } })
      toast(`${sub.name} added to recurring bills.`, 'success')
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
        <div><h1>Bills &amp; Subscriptions</h1><p>Everything that repeats — including charges Wealthline spotted in your history that you never set up as a bill.</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} disabled={loading}><Icon name="plus" />Add bill</button>
      </div>
      {!loading && subs.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="section-title"><h3>Detected subscriptions</h3>
            <span className="chip info">{money(subs.reduce((a, x) => a + x.yearlyCost, 0)).replace('.00', '')} / year</span></div>
          <p style={{ fontSize: 13 }}>Found automatically: the same charge, same amount, month after month.</p>
          {subs.map(sb => (
            <div className="list-row" key={sb.name}>
              <div className="ico bill"><Icon name="repeat" size={17} /></div>
              <div className="mid"><div className="t">{sb.name}</div><div className="s">{money(sb.amount).replace('.00', '')}/mo · seen {sb.monthsSeen} months · last {sb.lastCharged}</div></div>
              <div style={{ textAlign: 'right' }}>
                <div className="amt">{money(sb.yearlyCost).replace('.00', '')}<span style={{ color: 'var(--ink-faint)', fontWeight: 600 }}>/yr</span></div>
                {sb.tracked ? <span className="chip good">Tracked</span> : <button className="btn btn-sm btn-primary" style={{ marginTop: 4 }} onClick={() => trackSub(sb)}>Track as bill</button>}
              </div>
            </div>
          ))}
        </div>
      )}
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
