import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import AppShell from './components/AppShell.jsx'

function Root() {
  const { user, token } = useAuth()
  return (user && token) ? <AppShell /> : <AuthScreen />
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ToastProvider>
  )
}
