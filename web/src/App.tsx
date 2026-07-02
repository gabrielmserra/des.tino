import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { MonthProvider } from './lib/month'
import { TxFormProvider } from './lib/txform'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Cards } from './pages/Cards'
import { Benefits } from './pages/Benefits'

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
        {session ? (
          <Route
            element={
              <MonthProvider>
                <TxFormProvider>
                  <Layout />
                </TxFormProvider>
              </MonthProvider>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/lancamentos" element={<Transactions />} />
            <Route path="/cartoes" element={<Cards />} />
            <Route path="/beneficios" element={<Benefits />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}
