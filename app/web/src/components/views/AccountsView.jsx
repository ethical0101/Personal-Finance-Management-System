import { useEffect, useState } from 'react'
import { api, money } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { SkelCards } from '../Skeleton.jsx'
import Modal from '../Modal.jsx'

export default function AccountsView({ refreshKey, bumpRefresh }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    api('/accounts')
      .then(a => { if (!cancelled) setAccounts(a) })
      .catch(e => { if (!cancelled) toast(e.message, 'error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  async function handleSubmit(fd) {
    await api('/accounts', {
      method: 'POST',
      body: { name: fd.get('name'), type: fd.get('type'), balance: Number(fd.get('balance')) },
    })
    toast('Account added.', 'success')
    bumpRefresh()
  }

  return (
    <section className="view active">
      <div className="page-head">
        <div><h1>Accounts</h1><p>Savings, checking and credit card accounts.</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} disabled={loading}>+ Add account</button>
      </div>
      {loading ? <SkelCards count={3} cols={3} /> : (
        <div className="grid cols-3">
          {accounts.length ? accounts.map(a => (
            <div className="card" key={a.id}>
              <div className="section-title"><h3>{a.name}</h3><span className="chip neutral">{a.type}</span></div>
              <div className="kpi"><span className="value">{money(a.balance)}</span><span className="delta">Current balance</span></div>
            </div>
          )) : <div className="empty">No accounts yet.</div>}
        </div>
      )}
      {showAdd && (
        <Modal title="Add account" onClose={() => setShowAdd(false)} onSubmit={handleSubmit}>
          <div className="field"><label>Name</label><input name="name" type="text" required placeholder="e.g. HDFC Savings" /></div>
          <div className="field">
            <label>Type</label>
            <select name="type" defaultValue="Savings">
              <option value="Savings">Savings</option>
              <option value="Checking">Checking</option>
              <option value="CreditCard">Credit Card</option>
            </select>
          </div>
          <div className="field"><label>Opening balance</label><input name="balance" type="number" step="0.01" defaultValue="0" /></div>
        </Modal>
      )}
    </section>
  )
}
