import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

export default function SettingsView({ theme, setTheme, assistantOpen, toggleAssistant, bumpRefresh }) {
  const { user, updateUser, logout } = useAuth()
  const toast = useToast()
  const [me, setMe] = useState(null)
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' })
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [delPw, setDelPw] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => { api('/settings/me').then(setMe).catch(() => {}) }, [])

  async function saveProfile(e) {
    e.preventDefault(); setBusy('profile')
    try {
      const r = await api('/settings/profile', { method: 'PUT', body: profile })
      updateUser(r.user); toast('Profile updated.', 'success')
    } catch (err) { toast(err.message, 'error') } finally { setBusy('') }
  }
  async function changePassword(e) {
    e.preventDefault()
    if (pw.next !== pw.confirm) { toast('The new passwords do not match.', 'error'); return }
    setBusy('pw')
    try {
      await api('/settings/password', { method: 'POST', body: { current: pw.current, next: pw.next } })
      setPw({ current: '', next: '', confirm: '' }); toast('Password changed.', 'success')
    } catch (err) { toast(err.message, 'error') } finally { setBusy('') }
  }
  async function exportData() {
    setBusy('export')
    try {
      const data = await api('/settings/export')
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a'); a.href = url; a.download = 'wealthline-export.json'; a.click(); URL.revokeObjectURL(url)
      toast('Your data was downloaded.', 'success')
    } catch (err) { toast(err.message, 'error') } finally { setBusy('') }
  }
  async function clearData() {
    setBusy('clear')
    try {
      await api('/settings/clear-data', { method: 'POST' })
      setConfirmClear(false); bumpRefresh(); toast('All transactions, budgets, goals and bills were cleared.', 'success')
      api('/settings/me').then(setMe).catch(() => {})
    } catch (err) { toast(err.message, 'error') } finally { setBusy('') }
  }
  async function deleteAccount(e) {
    e.preventDefault(); setBusy('delete')
    try { await api('/settings/account', { method: 'DELETE', body: { password: delPw } }); logout() }
    catch (err) { toast(err.message, 'error'); setBusy('') }
  }

  const themeNow = theme || 'system'
  return (
    <section>
      <div className="page-head">
        <div><h1>Settings</h1><p>Manage your profile, security, appearance and data.</p></div>
      </div>

      <div className="grid cols-2 stagger">
        <form className="card" onSubmit={saveProfile}>
          <div className="section-title"><h3>Profile</h3>{me && <span className="chip neutral">{me.stats.transactions} transactions</span>}</div>
          <div className="profile-row"><span className="avatar lg">{(profile.name || 'U').slice(0, 1).toUpperCase()}</span><div><b>{user?.name}</b><div className="sub">{user?.email}</div></div></div>
          <div className="field"><label>Full name</label><input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} required minLength={2} maxLength={60} /></div>
          <div className="field"><label>Email</label><input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} required /></div>
          <button className="btn btn-primary" disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save profile'}</button>
        </form>

        <form className="card" onSubmit={changePassword}>
          <div className="section-title"><h3>Change password</h3></div>
          <div className="field"><label>Current password</label><input type="password" autoComplete="current-password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} required /></div>
          <div className="field"><label>New password</label><input type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} required /></div>
          <div className="field"><label>Confirm new password</label><input type="password" autoComplete="new-password" minLength={8} value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} required /></div>
          <button className="btn btn-primary" disabled={busy === 'pw'}>{busy === 'pw' ? 'Updating…' : 'Update password'}</button>
        </form>

        <div className="card">
          <div className="section-title"><h3>Appearance &amp; assistant</h3></div>
          <div className="field"><label>Theme</label>
            <div className="seg">
              {['system', 'light', 'dark'].map(t => <button key={t} type="button" aria-pressed={themeNow === t} onClick={() => setTheme(t === 'system' ? null : t)} style={{ textTransform: 'capitalize' }}>{t}</button>)}
            </div>
          </div>
          <div className="field"><label>AI assistant panel</label>
            <div className="seg">
              <button type="button" aria-pressed={assistantOpen} onClick={() => !assistantOpen && toggleAssistant()}>Show</button>
              <button type="button" aria-pressed={!assistantOpen} onClick={() => assistantOpen && toggleAssistant()}>Hide</button>
            </div>
            <span className="sub" style={{ marginTop: 6 }}>Shown on wide screens next to your dashboard.</span>
          </div>
        </div>

        <div className="card">
          <div className="section-title"><h3>Your data</h3></div>
          <p>Download everything Wealthline stores about you (accounts, transactions, budgets, goals, bills) as a JSON file.</p>
          <button className="btn btn-outline" onClick={exportData} disabled={busy === 'export'}>{busy === 'export' ? 'Preparing…' : 'Download my data'}</button>
          <hr className="sep" />
          <p>Start fresh: remove all transactions, budgets, goals, bills and notifications. Your login and categories stay.</p>
          {!confirmClear
            ? <button className="btn btn-ghost" onClick={() => setConfirmClear(true)}>Clear my data…</button>
            : <div className="confirm-row"><span>This cannot be undone.</span><button className="btn btn-danger btn-sm" onClick={clearData} disabled={busy === 'clear'}>{busy === 'clear' ? 'Clearing…' : 'Yes, clear everything'}</button><button className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>Cancel</button></div>}
        </div>

        <div className="card danger-zone span-2">
          <div className="section-title"><h3>Account</h3></div>
          <div className="account-actions">
            <button className="btn btn-outline" onClick={logout}>Log out</button>
            {!showDelete && <button className="btn btn-danger-outline" onClick={() => setShowDelete(true)}>Delete my account…</button>}
          </div>
          {showDelete && (
            <form className="delete-form" onSubmit={deleteAccount}>
              <p>Deleting your account permanently removes all your data. Enter your password to confirm.</p>
              <div className="confirm-row">
                <input className="input" type="password" placeholder="Password" value={delPw} onChange={e => setDelPw(e.target.value)} required />
                <button className="btn btn-danger" disabled={busy === 'delete'}>{busy === 'delete' ? 'Deleting…' : 'Delete forever'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowDelete(false); setDelPw('') }}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
