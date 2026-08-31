import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

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

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    try {
      await login(loginEmail.trim(), loginPassword)
    } catch (err) { setLoginError(err.message) }
  }

  async function handleSignup(e) {
    e.preventDefault()
    setSignupError('')
    try {
      await signup(name.trim(), signupEmail.trim(), signupPassword)
      toast('Account created. Welcome to Wealthline.', 'success')
    } catch (err) { setSignupError(err.message) }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="mark">W</span>
          <span className="name">Wealthline</span>
        </div>
        <div className="auth-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'login'} onClick={() => setTab('login')}>Log in</button>
          <button role="tab" aria-selected={tab === 'signup'} onClick={() => setTab('signup')}>Sign up</button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="loginEmail">Email</label>
              <input id="loginEmail" type="email" autoComplete="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="loginPassword">Password</label>
              <input id="loginPassword" type="password" autoComplete="current-password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
            </div>
            <div className="form-error">{loginError}</div>
            <button className="btn btn-primary btn-block" type="submit">Log in</button>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <div className="field">
              <label htmlFor="signupName">Full name</label>
              <input id="signupName" type="text" autoComplete="name" required value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="signupEmail">Email</label>
              <input id="signupEmail" type="email" autoComplete="email" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="signupPassword">Password</label>
              <input id="signupPassword" type="password" autoComplete="new-password" minLength={8} required value={signupPassword} onChange={e => setSignupPassword(e.target.value)} />
            </div>
            <div className="form-error">{signupError}</div>
            <button className="btn btn-primary btn-block" type="submit">Create account</button>
          </form>
        )}

        <p className="auth-foot">Demo credentials are created instantly — no email verification. Passwords are hashed with bcrypt server-side.</p>
      </div>
    </div>
  )
}
