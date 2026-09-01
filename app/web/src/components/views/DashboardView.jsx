import { useEffect, useState } from 'react'
import { api, money } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { SkelBar, SkelKpis } from '../Skeleton.jsx'
import AddTransactionModal from './AddTransactionModal.jsx'

export default function DashboardView({ refreshKey, bumpRefresh }) {
  const [summary, setSummary] = useState(null)
  const [recent, setRecent] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [s, r, cats] = await Promise.all([
          api('/dashboard/summary'),
          api('/transactions?limit=6'),
          api('/categories'),
        ])
        if (cancelled) return
        setSummary(s); setRecent(r); setCategories(cats)
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

  return (
    <section className="view active">
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Your finances at a glance.</p></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} disabled={loading}>+ Add transaction</button>
      </div>

      {loading || !summary ? <DashboardSkeleton /> : <DashboardContent summary={summary} recent={recent} categories={categories} />}

      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} onSaved={bumpRefresh} />}
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <SkelKpis count={4} />
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title"><h3>Spend by category (this month)</h3></div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="bar-row" key={i}>
              <SkelBar w="70%" h={12} />
              <SkelBar w="100%" h={14} />
              <SkelBar w="60%" h={12} />
            </div>
          ))}
        </div>
        <div className="card">
          <div className="section-title"><h3>Recent transactions</h3></div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="bar-row mini" key={i} style={{ padding: '9px 0' }}>
              <SkelBar w="60%" h={12} />
              <SkelBar w={70} h={12} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function DashboardContent({ summary, recent, categories }) {
  const kpis = [
    { label: 'Net worth', value: money(summary.netWorth), delta: `${summary.transactionCount} total transactions`, cls: '' },
    { label: 'Income (month)', value: money(summary.incomeThisMonth), delta: 'this calendar month', cls: 'good' },
    { label: 'Expense (month)', value: money(summary.expenseThisMonth), delta: 'this calendar month', cls: '' },
    { label: 'Savings rate', value: `${summary.savingsRateThisMonth}%`, delta: 'of income kept', cls: summary.savingsRateThisMonth < 10 ? 'critical' : 'good' },
  ]
  const max = Math.max(1, ...summary.spendByCategory.map(c => c.total))

  return (
    <>
      <div className="grid cols-4">
        {kpis.map(k => (
          <div className="card kpi" key={k.label}>
            <span className="label">{k.label}</span>
            <span className={`value ${k.cls}`}>{k.value}</span>
            <span className="delta">{k.delta}</span>
          </div>
        ))}
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-title"><h3>Spend by category (this month)</h3></div>
          {summary.spendByCategory.length ? summary.spendByCategory.map(c => (
            <div className="bar-row" key={c.categoryId}>
              <span className="name">{c.categoryName}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(c.total / max) * 100}%` }} /></div>
              <span className="pct">{money(c.total)}</span>
            </div>
          )) : <div className="empty">No expenses logged this month yet.</div>}
        </div>
        <div className="card">
          <div className="section-title"><h3>Recent transactions</h3></div>
          {recent.length ? recent.map(t => {
            const cat = categories.find(c => c.id === t.categoryId)
            return (
              <div className="bar-row mini" key={t.id}>
                <span className="name">{t.description || (cat ? cat.name : 'Transaction')} · {t.date}</span>
                <span className={`pct amount ${t.type}`}>{t.type === 'income' ? '+' : '-'}{money(t.amount)}</span>
              </div>
            )
          }) : <div className="empty">No transactions yet — add your first one.</div>}
        </div>
      </div>
    </>
  )
}
