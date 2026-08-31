import { useEffect, useState } from 'react'
import { api, money } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import AddTransactionModal from './AddTransactionModal.jsx'

export default function TransactionsView({ refreshKey, bumpRefresh }) {
  const [tx, setTx] = useState([])
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const toast = useToast()

  async function load() {
    const [t, cats, accs] = await Promise.all([api('/transactions'), api('/categories'), api('/accounts')])
    setTx(t); setCategories(cats); setAccounts(accs)
  }

  useEffect(() => { load() }, [refreshKey])

  async function handleDelete(id) {
    try {
      await api(`/transactions/${id}`, { method: 'DELETE' })
      bumpRefresh()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <section className="view active">
      <div className="page-head">
        <div><h1>Transactions</h1><p>Every transaction is checked for anomalies against your category history.</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add transaction</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th className="num">Amount</th><th>Flag</th><th></th></tr></thead>
          <tbody>
            {tx.length ? tx.map(t => {
              const cat = categories.find(c => c.id === t.categoryId)
              const acc = accounts.find(a => a.id === t.accountId)
              return (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>{t.description || '—'}</td>
                  <td>{cat ? cat.name : '—'}</td>
                  <td>{acc ? acc.name : '—'}</td>
                  <td className={`num amount ${t.type}`}>{t.type === 'income' ? '+' : '-'}{money(t.amount)}</td>
                  <td>{t.flaggedAnomaly
                    ? <span className="chip critical"><span className="dot" />Anomaly z={t.anomalyZScore}</span>
                    : <span className="chip neutral">Normal</span>}</td>
                  <td><button className="btn btn-sm btn-ghost" onClick={() => handleDelete(t.id)}>Delete</button></td>
                </tr>
              )
            }) : <tr><td colSpan={7}><div className="empty">No transactions yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} onSaved={bumpRefresh} />}
    </section>
  )
}
