import { useEffect, useState } from 'react'
import { api, money } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import { SkelBar } from '../Skeleton.jsx'
import Icon from '../Icon.jsx'
import { TrendChart, Donut, ScoreRing } from '../charts.jsx'
import AddTransactionModal from './AddTransactionModal.jsx'

const short = n => money(Math.round(n)).replace('.00', '')
const dueLabel = d => d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : `In ${d} days`

export default function DashboardView({ refreshKey, bumpRefresh, go }) {
  const [summary, setSummary] = useState(null)
  const [recent, setRecent] = useState([])
  const [categories, setCategories] = useState([])
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [s, r, cats, b] = await Promise.all([
          api('/dashboard/summary'), api('/transactions?limit=6'), api('/categories'), api('/budgets'),
        ])
        if (cancelled) return
        setSummary(s); setRecent(r); setCategories(cats); setBudgets(b)
      } catch (e) { if (!cancelled) toast(e.message, 'error') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  return (
    <section>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Your money, this month, at a glance.</p></div>
        <div className="actions">
          <button className="btn btn-outline" onClick={() => go('scan')}><Icon name="scan" />Scan bill</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)} disabled={loading}><Icon name="plus" />Add transaction</button>
        </div>
      </div>
      {loading || !summary ? <DashboardSkeleton /> : <Content s={summary} recent={recent} categories={categories} budgets={budgets} go={go} />}
      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} onSaved={bumpRefresh} />}
    </section>
  )
}

function Content({ s, recent, categories, budgets, go }) {
  const sts = s.safeToSpend
  const spentTotal = s.spendByCategory.reduce((a, c) => a + c.total, 0)
  const onPace = sts.projectedMonthExpense <= sts.typicalMonthlyExpense * 1.1
  return (
    <div className="grid cols-3">
      <div className="card hero span-2">
        <div>
          <div className="eyebrow">Net worth</div>
          <div className="big">{short(s.netWorth)}</div>
          <div className="sub">Across {s.accounts.length} account{s.accounts.length === 1 ? '' : 's'} · {s.transactionCount} transactions tracked</div>
        </div>
        <div className="hero-chips">
          <div className="hero-chip"><div className="l">Income this month</div><div className="v">{short(s.incomeThisMonth)}</div></div>
          <div className="hero-chip"><div className="l">Spent this month</div><div className="v">{short(s.expenseThisMonth)}</div></div>
          <div className="hero-chip"><div className="l">Savings rate</div><div className="v">{s.savingsRateThisMonth}%</div></div>
        </div>
      </div>

      <div className="card safe">
        <div className="section-title"><h3>Safe to spend today</h3><span className="chip info"><Icon name="zap" size={13} />Daily allowance</span></div>
        {sts.perDay === null ? (
          <>
            <p>Set a few monthly budgets and Wealthline will tell you exactly how much you can spend each day without overshooting.</p>
            <button className="btn btn-primary btn-sm" onClick={() => go('budgets')}>Set up budgets</button>
          </>
        ) : (
          <>
            <div className="safe-num">{short(sts.perDay)}<small> / day</small></div>
            <p>{short(sts.remainingBudget)} left across {sts.budgetCount} budget{sts.budgetCount === 1 ? '' : 's'} · {sts.daysLeft} day{sts.daysLeft === 1 ? '' : 's'} to go</p>
            <div className="chips">
              {sts.budgetsOver > 0 && <span className="chip critical"><span className="dot" />{sts.budgetsOver} budget{sts.budgetsOver > 1 ? 's' : ''} over limit</span>}
              <span className={`chip ${onPace ? 'good' : 'warn'}`}>{onPace ? 'On pace' : 'Above usual'}: {short(sts.projectedMonthExpense)} projected</span>
            </div>
          </>
        )}
      </div>

      <div className="card span-2">
        <div className="section-title"><h3>Income vs expenses</h3>
          <div className="legend"><span><i style={{ background: 'var(--good)' }} />Income</span><span><i style={{ background: 'var(--accent)' }} />Expenses</span></div></div>
        <TrendChart data={s.trend} />
      </div>

      <div className="card">
        <div className="section-title"><h3>Financial health</h3><span className="chip neutral">{s.health.grade}</span></div>
        <div className="score-wrap">
          <ScoreRing score={s.health.score} />
          <div className="score-break">
            {s.health.breakdown.map(b => (
              <div className="row" key={b.label}>
                <div className="top"><span>{b.label}</span><span>{b.points}/{b.max}</span></div>
                <div className="mini-track"><div className="mini-fill" style={{ width: `${(b.points / b.max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title"><h3>Where it went</h3><span className="sub">this month</span></div>
        {spentTotal > 0 ? <Donut data={s.spendByCategory} total={spentTotal} /> : <div className="empty">No expenses logged this month yet.</div>}
      </div>

      <div className="card">
        <div className="section-title"><h3>Recent activity</h3><button className="btn btn-sm btn-ghost" onClick={() => go('transactions')}>View all</button></div>
        {recent.length ? recent.map(t => {
          const cat = categories.find(c => c.id === t.categoryId)
          const inc = t.type === 'income'
          return (
            <div className="list-row" key={t.id}>
              <div className={`ico ${inc ? 'in' : 'out'}`}>{(cat ? cat.name : 'T').slice(0, 1)}</div>
              <div className="mid"><div className="t">{t.description || (cat ? cat.name : 'Transaction')}</div><div className="s">{cat ? cat.name : '—'} · {t.date}</div></div>
              <div className={`amt ${inc ? 'in' : ''}`}>{inc ? '+' : '-'}{short(t.amount)}</div>
            </div>
          )
        }) : <div className="empty">No transactions yet — add your first one.</div>}
      </div>

      <div className="stack">
        <div className="card">
          <div className="section-title"><h3>Coming up</h3><button className="btn btn-sm btn-ghost" onClick={() => go('bills')}>Bills</button></div>
          {s.upcomingBills.length ? s.upcomingBills.map(b => (
            <div className="list-row" key={b.id}>
              <div className="ico bill"><Icon name="repeat" size={17} /></div>
              <div className="mid"><div className="t">{b.name}</div><div className="s">{dueLabel(b.dueInDays)} · {b.dueDate}</div></div>
              <div className="amt">{short(b.amount)}</div>
            </div>
          )) : <div className="empty">No recurring bills yet.</div>}
        </div>
        <div className="card">
          <div className="section-title"><h3>Budgets</h3><button className="btn btn-sm btn-ghost" onClick={() => go('budgets')}>Manage</button></div>
          {budgets.length ? budgets.slice(0, 4).map(b => {
            const cat = categories.find(c => c.id === b.categoryId)
            const over = b.percentUsed > 100
            return (
              <div key={b.id} style={{ marginBottom: 12 }}>
                <div className="section-title" style={{ marginBottom: 0 }}><span style={{ fontWeight: 700, fontSize: 13 }}>{cat ? cat.name : '—'}</span>
                  <span className={`chip ${over ? 'critical' : b.percentUsed > 80 ? 'warn' : 'good'}`}>{b.percentUsed}%</span></div>
                <div className="progress-track" style={{ margin: '7px 0 0' }}><div className={`progress-fill ${over ? 'over' : ''}`} style={{ width: `${Math.min(100, b.percentUsed)}%` }} /></div>
              </div>
            )
          }) : <div className="empty">No budgets yet.</div>}
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid cols-3">
      <div className="card span-2" style={{ minHeight: 230 }}><SkelBar w="22%" h={12} /><SkelBar w="45%" h={44} style={{ marginTop: 14 }} /><SkelBar w="60%" h={12} style={{ marginTop: 12 }} /></div>
      <div className="card"><SkelBar w="50%" h={14} /><SkelBar w="55%" h={38} style={{ marginTop: 18 }} /><SkelBar w="80%" h={12} style={{ marginTop: 14 }} /></div>
      <div className="card span-2" style={{ minHeight: 250 }}><SkelBar w="30%" h={14} /><SkelBar w="100%" h={170} style={{ marginTop: 16 }} /></div>
      <div className="card"><SkelBar w="45%" h={14} /><SkelBar w={120} h={120} style={{ marginTop: 16, borderRadius: '50%' }} /></div>
      {[0, 1, 2].map(i => (
        <div className="card" key={i}>{[0, 1, 2, 3].map(j => <div key={j} style={{ display: 'flex', gap: 12, padding: '10px 0' }}><SkelBar w={38} h={38} /><div style={{ flex: 1 }}><SkelBar w="70%" h={12} /><SkelBar w="40%" h={10} style={{ marginTop: 8 }} /></div></div>)}</div>
      ))}
    </div>
  )
}
