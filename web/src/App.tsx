import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { MonthProvider } from './lib/month'
import { ThemeProvider } from './lib/theme'
import { TxFormProvider } from './lib/txform'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Cards } from './pages/Cards'
import { Planning } from './pages/Planning'
import { Debts } from './pages/Debts'
import { Investments } from './pages/Investments'
import { Goals } from './pages/Goals'
import { FixedBills } from './pages/FixedBills'
import { FutureCommitments } from './pages/FutureCommitments'
import { More } from './pages/More'
import { Settings } from './pages/Settings'

// Carregado sob demanda: só quem usa a importação baixa o pdfjs-dist (~440kB)
const Import = lazy(() => import('./pages/Import').then((m) => ({ default: m.Import })))

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
        <Route path="/esqueci-senha" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {session ? (
          <Route
            element={
              <ThemeProvider>
                <MonthProvider>
                  <TxFormProvider>
                    <Layout />
                  </TxFormProvider>
                </MonthProvider>
              </ThemeProvider>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/lancamentos" element={<Transactions />} />
            <Route path="/cartoes" element={<Cards />} />
            <Route path="/beneficios" element={<Navigate to="/cartoes" replace />} />
            <Route path="/planejamento" element={<Planning />} />
            <Route path="/dividas" element={<Debts />} />
            <Route path="/investimentos" element={<Investments />} />
            <Route path="/metas" element={<Goals />} />
            <Route path="/contas-fixas" element={<FixedBills />} />
            <Route path="/compromissos-futuros" element={<FutureCommitments />} />
            <Route
              path="/importar"
              element={
                <Suspense fallback={<Splash />}>
                  <Import />
                </Suspense>
              }
            />
            <Route path="/mais" element={<More />} />
            <Route path="/configuracoes" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}
