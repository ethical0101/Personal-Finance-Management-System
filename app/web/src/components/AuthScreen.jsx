import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import Icon from './Icon.jsx'

export default function AuthScreen() {
  const [tab, setTab] = useState('login')
  const { login, signup } = useAuth()
  const toast = useToast()

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [name, setName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupError, setSignupError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleLogin(e) {
    e.preventDefault(); setLoginError(''); setBusy(true)
    try { await login(loginEmail.trim(), loginPassword) } catch (err) { setLoginError(err.message) } finally { setBusy(false) }
  }
  async function handleSignup(e) {
    e.preventDefault(); setSignupError(''); setBusy(true)
    try { await signup(name.trim(), signupEmail.trim(), signupPassword); toast('Account created. Welcome to Wealthline.', 'success') }
    catch (err) { setSignupError(err.message) } finally { setBusy(false) }
  }
  function fillDemo() { setTab('login'); setLoginEmail('demo@gmail.com'); setLoginPassword('12345678') }

  return (
    <div className="auth-screen">
      <section className="auth-hero">
        <div className="brandline"><span className="logo-mark">W</span> Wealthline</div>
        <div>
          <h2>Know where every rupee goes.</h2>
          <p>Snap a bill, and Wealthline reads it, files it, and tells you what it does to your budget — before you spend the next one.</p>
          <ul>
            <li><Icon name="scan" /> Scan bills &amp; receipts with AI</li>
            <li><Icon name="zap" /> Daily safe-to-spend allowance</li>
            <li><Icon name="repeat" /> Finds forgotten subscriptions</li>
            <li><Icon name="shield" /> Flags unusual spending instantly</li>
          </ul>
        </div>
        <small>Software Metrics-Driven AI-Powered Personal Finance Management System</small>
      </section>

      <section className="auth-pane">
        <div className="auth-card">
          <h1>{tab === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p>{tab === 'login' ? 'Log in to see your money at a glance.' : 'Takes 20 seconds — no email verification.'}</p>
          <div className="auth-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'login'} onClick={() => setTab('login')}>Log in</button>
            <button role="tab" aria-selected={tab === 'signup'} onClick={() => setTab('signup')}>Sign up</button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="field"><label htmlFor="loginEmail">Email</label>
                <input id="loginEmail" type="email" autoComplete="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></div>
              <div className="field"><label htmlFor="loginPassword">Password</label>
                <input id="loginPassword" type="password" autoComplete="current-password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} /></div>
              <div className="form-error">{loginError}</div>
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
              <div className="demo-hint"><span>Just looking? Try the demo account <b>demo@gmail.com</b></span><button type="button" className="btn btn-sm btn-ghost" onClick={fillDemo}>Fill in</button></div>
            </form>
          ) : (
            <form onSubmit={handleSignup}>
              <div className="field"><label htmlFor="signupName">Full name</label>
                <input id="signupName" type="text" autoComplete="name" required value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="field"><label htmlFor="signupEmail">Email</label>
                <input id="signupEmail" type="email" autoComplete="email" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)} /></div>
              <div className="field"><label htmlFor="signupPassword">Password</label>
                <input id="signupPassword" type="password" autoComplete="new-password" minLength={8} required value={signupPassword} onChange={e => setSignupPassword(e.target.value)} /></div>
              <div className="form-error">{signupError}</div>
              <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
            </form>
          )}
          <p className="auth-foot">Passwords are hashed with bcrypt. Bill photos are analysed and never stored.</p>
        </div>
      </section>
    </div>
  )
}
