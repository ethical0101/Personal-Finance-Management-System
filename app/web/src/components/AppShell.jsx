import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import DashboardView from './views/DashboardView.jsx'
import TransactionsView from './views/TransactionsView.jsx'
import AccountsView from './views/AccountsView.jsx'
import BudgetsView from './views/BudgetsView.jsx'
import GoalsView from './views/GoalsView.jsx'
import BillsView from './views/BillsView.jsx'
import InsightsView from './views/InsightsView.jsx'
import NotificationsView from './views/NotificationsView.jsx'
import MetricsView from './views/MetricsView.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'goals', label: 'Goals' },
  { id: 'bills', label: 'Recurring Bills' },
  { id: 'insights', label: 'AI Insights' },
  { id: 'notifications', label: 'Notifications', badge: true },
  { id: 'metrics', label: 'Metrics' },
]

export default function AppShell() {
  const { user, logout } = useAuth()
  const [view, setView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('wealthline_theme') || null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [unread, setUnread] = useState(0)

  const bumpRefresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme)
    else document.documentElement.removeAttribute('data-theme')
  }, [theme])

  const refreshBadge = useCallback(async () => {
    try {
      const notes = await api('/notifications')
      setUnread(notes.filter(n => !n.read && n.type !== 'recommendation-event').length)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { refreshBadge() }, [refreshBadge, refreshKey])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('wealthline_theme', next)
  }

  function selectView(id) {
    setView(id)
    setSidebarOpen(false)
  }

  const views = {
    dashboard: <DashboardView refreshKey={refreshKey} bumpRefresh={bumpRefresh} />,
    transactions: <TransactionsView refreshKey={refreshKey} bumpRefresh={bumpRefresh} />,
    accounts: <AccountsView refreshKey={refreshKey} bumpRefresh={bumpRefresh} />,
    budgets: <BudgetsView refreshKey={refreshKey} bumpRefresh={bumpRefresh} />,
    goals: <GoalsView refreshKey={refreshKey} bumpRefresh={bumpRefresh} />,
    bills: <BillsView refreshKey={refreshKey} bumpRefresh={bumpRefresh} />,
    insights: <InsightsView refreshKey={refreshKey} bumpRefresh={bumpRefresh} />,
    notifications: <NotificationsView refreshKey={refreshKey} bumpRefresh={bumpRefresh} />,
    metrics: <MetricsView />,
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand"><span className="mark">W</span><span>Wealthline</span></div>
        {NAV.map(n => (
          <button
            key={n.id}
            className={`navlink ${view === n.id ? 'active' : ''}`}
            onClick={() => selectView(n.id)}
          >
            {n.label}
            {n.badge && unread > 0 && <span className="badge">{unread}</span>}
          </button>
        ))}
        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="avatar">{(user?.name || 'U').slice(0, 1).toUpperCase()}</span>
            <div className="who"><span className="n">{user?.name}</span><span className="e">{user?.email}</span></div>
          </div>
          <button className="navlink" onClick={logout}>Log out</button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="mobile-nav-toggle" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <button className="icon-btn" title="Toggle theme" onClick={toggleTheme}>◐</button>
        </header>
        <main className={`content ${view === 'metrics' ? 'full-bleed' : ''}`}>
          {views[view]}
        </main>
      </div>
    </div>
  )
}
