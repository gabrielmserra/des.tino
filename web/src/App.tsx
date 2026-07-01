import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'

function Splash() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <p style={{ color: 'var(--muted)' }}>Carregando…</p>
    </div>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  if (loading) return <Splash />

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/"
          element={session ? <Dashboard /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
