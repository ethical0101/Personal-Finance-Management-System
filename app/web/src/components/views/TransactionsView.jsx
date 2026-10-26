import { useEffect, useState } from 'react'
import { api, money } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { SkelTableRows } from '../Skeleton.jsx'
import Icon from '../Icon.jsx'
import AddTransactionModal from './AddTransactionModal.jsx'

export default function TransactionsView({ refreshKey, bumpRefresh }) {
  const [tx, setTx] = useState([])
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('')
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [t, cats, accs] = await Promise.all([api('/transactions'), api('/categories'), api('/accounts')])
        if (cancelled) return
        setTx(t); setCategories(cats); setAccounts(accs)
      } catch (e) {
        if (!cancelled) toast(e.message, 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const visible = tx.filter(t => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    if (catFilter && t.categoryId !== catFilter) return false
    if (query) {
      const cat = categories.find(c => c.id === t.categoryId)
      const hay = `${t.description} ${cat ? cat.name : ''} ${t.date} ${t.amount}`.toLowerCase()
      if (!hay.includes(query.toLowerCase())) return false
    }
    return true
  })

  function exportCsv() {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [['Date', 'Type', 'Description', 'Category', 'Account', 'Amount', 'Flagged']]
    for (const t of visible) {
      rows.push([t.date, t.type, t.description, categories.find(c => c.id === t.categoryId)?.name, accounts.find(a => a.id === t.accountId)?.name, t.amount, t.flaggedAnomaly ? 'yes' : 'no'])
    }
    const blob = new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `wealthline-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(a.href)
    toast(`Exported ${visible.length} transactions.`, 'success')
  }

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
        <div className="actions">
          <button className="btn btn-outline" onClick={exportCsv} disabled={loading || !visible.length}><Icon name="download" />Export CSV</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)} disabled={loading}><Icon name="plus" />Add transaction</button>
        </div>
      </div>
      <div className="toolbar">
        <div className="search"><Icon name="search" /><input className="input" placeholder="Search description, category, date or amount" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <div className="seg">{[['all', 'All'], ['expense', 'Expenses'], ['income', 'Income']].map(([v, l]) => <button key={v} aria-pressed={typeFilter === v} onClick={() => setTypeFilter(v)}>{l}</button>)}</div>
        <select className="input" value={catFilter} onChange={e => setCatFilter(e.target.value)}><option value="">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th className="num">Amount</th><th>Flag</th><th></th></tr></thead>
          <tbody>
            {loading ? <SkelTableRows rows={6} cols={7} /> : visible.length ? visible.map(t => {
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
            }) : <tr><td colSpan={7}><div className="empty">{tx.length ? "No transactions match your filters." : "No transactions yet."}</div></td></tr>}
          </tbody>
        </table>
      </div>
      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} onSaved={bumpRefresh} />}
    </section>
  )
}
