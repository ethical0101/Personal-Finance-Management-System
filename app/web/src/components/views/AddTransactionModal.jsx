import { useEffect, useState } from 'react'
import { api, todayStr } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import Modal from '../Modal.jsx'

export default function AddTransactionModal({ onClose, onSaved }) {
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    Promise.all([api('/categories'), api('/accounts')]).then(([cats, accs]) => {
      if (!cancelled) { setCategories(cats); setAccounts(accs) }
    })
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(fd) {
    const result = await api('/transactions', {
      method: 'POST',
      body: {
        type: fd.get('type'),
        amount: Number(fd.get('amount')),
        categoryId: fd.get('categoryId'),
        accountId: fd.get('accountId'),
        description: fd.get('description'),
        date: fd.get('date'),
      },
    })
    toast(
      result.anomaly.isAnomaly ? 'Transaction added — flagged as unusual.' : 'Transaction added.',
      result.anomaly.isAnomaly ? 'error' : 'success',
    )
    onSaved()
  }

  return (
    <Modal title="Add transaction" onClose={onClose} onSubmit={handleSubmit}>
      <div className="field">
        <label>Type</label>
        <select name="type" defaultValue="expense">
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>
      <div className="field"><label>Amount</label><input name="amount" type="number" step="0.01" min="0.01" required /></div>
      <div className="field">
        <label>Category</label>
        <select name="categoryId">
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Account</label>
        <select name="accountId">
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="field"><label>Description</label><input name="description" type="text" placeholder="e.g. Grocery run" /></div>
      <div className="field"><label>Date</label><input name="date" type="date" defaultValue={todayStr()} required /></div>
    </Modal>
  )
}
