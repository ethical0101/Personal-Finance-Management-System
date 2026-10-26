import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import Icon from './Icon.jsx'
import DashboardView from './views/DashboardView.jsx'
import TransactionsView from './views/TransactionsView.jsx'
import AccountsView from './views/AccountsView.jsx'
import BudgetsView from './views/BudgetsView.jsx'
import GoalsView from './views/GoalsView.jsx'
import BillsView from './views/BillsView.jsx'
import InsightsView from './views/InsightsView.jsx'
import NotificationsView from './views/NotificationsView.jsx'
import MetricsView from './views/MetricsView.jsx'
import ScanView from './views/ScanView.jsx'
import AskView from './views/AskView.jsx'
import AssistantPanel from './AssistantPanel.jsx'
import { useAssistant } from '../lib/useAssistant.js'

const NAV = [
  { group: 'Overview', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  ] },
  { group: 'Money', items: [
    { id: 'transactions', label: 'Transactions', icon: 'transactions' },
    { id: 'accounts', label: 'Accounts', icon: 'accounts' },
    { id: 'budgets', label: 'Budgets', icon: 'budgets' },
    { id: 'goals', label: 'Goals', icon: 'goals' },
    { id: 'bills', label: 'Bills & Subscriptions', icon: 'bills' },
  ] },
  { group: 'Smart tools', items: [
    { id: 'insights', label: 'AI Insights', icon: 'insights' },
    { id: 'ask', label: 'Ask AI', icon: 'ask' },
  ] },
  { group: 'Project', items: [
    { id: 'metrics', label: 'Metrics Deck', icon: 'metrics' },
  ] },
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const [view, setView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('wealthline_theme') || null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [unread, setUnread] = useState(0)
  const [assistantOpen, setAssistantOpen] = useState(() => localStorage.getItem('wealthline_assistant') !== 'closed')
  const assistant = useAssistant()
  const firstName = user?.name?.split(' ')[0]

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

  const isDark = theme === 'dark' || (theme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)
  function toggleTheme() {
    const next = isDark ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('wealthline_theme', next)
  }
  function toggleAssistant() {
    const next = !assistantOpen
    setAssistantOpen(next)
    localStorage.setItem('wealthline_assistant', next ? 'open' : 'closed')
  }
  function go(id) { setView(id); setSidebarOpen(false) }

  const props = { refreshKey, bumpRefresh, go }
  const views = {
    dashboard: <DashboardView {...props} />,
    transactions: <TransactionsView {...props} />,
    accounts: <AccountsView {...props} />,
    budgets: <BudgetsView {...props} />,
    goals: <GoalsView {...props} />,
    bills: <BillsView {...props} />,
    insights: <InsightsView {...props} />,
    ask: <AskView {...props} assistant={assistant} name={firstName} />,
    scan: <ScanView {...props} />,
    notifications: <NotificationsView {...props} />,
    metrics: <MetricsView theme={theme} />,
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand"><span className="logo-mark">W</span><span className="t">Wealthline</span></div>
        <button className="btn btn-primary scan-cta" onClick={() => go('scan')}><Icon name="scan" /> Scan a bill</button>
        {NAV.map(g => (
          <div key={g.group}>
            <div className="nav-group">{g.group}</div>
            {g.items.map(n => (
              <button key={n.id} className={`navlink ${view === n.id ? 'active' : ''}`} onClick={() => go(n.id)}>
                <Icon name={n.icon} />{n.label}
              </button>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="avatar">{(user?.name || 'U').slice(0, 1).toUpperCase()}</span>
            <div className="who"><span className="n">{user?.name}</span><span className="e">{user?.email}</span></div>
          </div>
          <button className="navlink" onClick={logout}><Icon name="logout" />Log out</button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-nav-toggle" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
          <span className="greet">{greeting()}, <b>{firstName}</b></span>
          <span className="spacer" />
          <button className={`icon-btn ai-toggle ${assistantOpen ? 'on' : ''}`} title="AI assistant" onClick={toggleAssistant}><Icon name="insights" /></button>
          <button className="icon-btn" title="Scan a bill" onClick={() => go('scan')}><Icon name="camera" /></button>
          <button className="icon-btn" title="Notifications" onClick={() => go('notifications')}>
            <Icon name="bell" />{unread > 0 && <span className="dotbadge">{unread}</span>}
          </button>
          <button className="icon-btn" title="Toggle theme" onClick={toggleTheme}><Icon name={isDark ? 'sun' : 'moon'} /></button>
        </header>
        <main key={view} className={`content ${view === 'metrics' ? 'full-bleed' : ''}`}>
          {views[view]}
        </main>
      </div>

      {assistantOpen && view !== 'ask' && view !== 'metrics' && (
        <aside className="assistant"><AssistantPanel assistant={assistant} name={firstName} onClose={toggleAssistant} /></aside>
      )}
    </div>
  )
}
