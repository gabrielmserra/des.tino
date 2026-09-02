import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getRememberMe, setRememberMe as persistRememberMe } from '../lib/supabase'
import './AuthDesktop.css'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(getRememberMe)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    persistRememberMe(rememberMe)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) {
      // Mostra a causa real para diagnóstico (credencial x chave/config x rede)
      if (/invalid login credentials/i.test(error)) {
        setError('E-mail ou senha inválidos.')
      } else {
        setError(error)
      }
    }
  }

  return (
    <>
    {/* Mobile (<860px) — layout atual, sem alterações */}
    <div className="flex min-h-full items-center justify-center p-6 min-[860px]:hidden">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">
            des<span style={{ color: 'var(--primary)' }}>.</span>tino
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Suas finanças, no bolso.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border p-6"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
            E-MAIL
          </label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border px-3 py-3 text-base outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            placeholder="voce@email.com"
          />

          <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
            SENHA
          </label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border px-3 py-3 text-base outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            placeholder="••••••••"
          />

          {error && (
            <p className="mb-3 text-sm" style={{ color: 'var(--red)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg py-3 font-bold text-white disabled:opacity-60"
            style={{ background: 'var(--primary)' }}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <Link
            to="/esqueci-senha"
            className="mt-3 block text-center text-sm"
            style={{ color: 'var(--muted)' }}
          >
            Esqueci minha senha
          </Link>
        </form>

        <Link
          to="/cadastro"
          className="mt-4 block text-center text-sm font-semibold"
          style={{ color: 'var(--primary)' }}
        >
          Criar conta
        </Link>
      </div>
    </div>

    {/* Desktop (>=860px) — handoff de design: painel de marca + formulário */}
    <div className="login-desktop hidden min-[860px]:flex">
      <div className="ld-brand">
        <div className="ld-brand-top">
          <img src="/destino-logo.png" alt="des.tino" style={{ height: 26, display: 'block' }} />
        </div>

        <div className="ld-brand-mid">
          <h1>
            Organize seu dinheiro
            <br />
            <b>com destino certo.</b>
          </h1>
          <p>Acompanhe entradas, saídas e investimentos em um só lugar, mês após mês.</p>
        </div>

        <div className="ld-route">
          <svg width="280" height="70" viewBox="0 0 280 70" fill="none">
            <path d="M10 50 Q 70 15 140 35 T 270 20" stroke="#2EAF7D" strokeWidth="1.2" strokeOpacity="0.35" fill="none" />
            <circle cx="10" cy="50" r="3" fill="#2EAF7D" fillOpacity="0.5" />
            <circle cx="140" cy="35" r="4" fill="#2EAF7D" />
            <circle cx="140" cy="35" r="4" fill="none" stroke="#2EAF7D" strokeOpacity="0.4" strokeWidth="6" />
            <circle cx="270" cy="20" r="3" fill="#F5A623" fillOpacity="0.7" />
          </svg>
        </div>
      </div>

      <div className="ld-form-side">
        <form onSubmit={onSubmit} className="ld-form-box">
          <h2>Bem-vindo de volta</h2>
          <div className="ld-sub">Entre com sua conta para continuar</div>

          <div className="ld-field">
            <label>E-mail</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
            />
            <div className="ld-bar" />
          </div>

          <div className="ld-field">
            <label>Senha</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
            />
            <div className="ld-bar" />
          </div>

          <div className="ld-row-between">
            <label className="ld-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Lembrar de mim
            </label>
            <Link to="/esqueci-senha" className="ld-forgot">
              Esqueci minha senha
            </Link>
          </div>

          {error && <p className="ld-error">{error}</p>}

          <button type="submit" disabled={loading} className="ld-btn">
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <div className="ld-divider">OU</div>

          <div className="ld-footer-line">
            Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
          </div>
        </form>
      </div>
    </div>
    </>
  )
}
