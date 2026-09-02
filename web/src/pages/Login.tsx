import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getRememberMe, setRememberMe as persistRememberMe } from '../lib/supabase'
import './Auth.css'

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
    {/* Mobile (<860px) — handoff de design */}
    <div className="auth-mobile min-[860px]:hidden">
      <div className="am-top">
        <img className="am-logo" src="/destino-logo.png" alt="des.tino" />
      </div>
      <div className="am-head">
        <h1>Bem-vindo de volta</h1>
        <p>Entre com sua conta para continuar</p>
      </div>
      <div className="am-route">
        <svg width="200" height="50" viewBox="0 0 200 50" fill="none">
          <path d="M8 36 Q 50 10 100 24 T 192 14" stroke="#2EAF7D" strokeWidth="1.2" strokeOpacity="0.35" fill="none" />
          <circle cx="8" cy="36" r="2.5" fill="#2EAF7D" fillOpacity="0.5" />
          <circle cx="100" cy="24" r="3.5" fill="#2EAF7D" />
          <circle cx="100" cy="24" r="3.5" fill="none" stroke="#2EAF7D" strokeOpacity="0.4" strokeWidth="5" />
          <circle cx="192" cy="14" r="2.5" fill="#F5A623" fillOpacity="0.7" />
        </svg>
      </div>
      <form onSubmit={onSubmit} className="am-form">
        <div className="am-field">
          <label>E-mail</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </div>

        <div className="am-field">
          <label>Senha</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
          />
        </div>

        <div className="am-row-between">
          <label className="am-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Lembrar de mim
          </label>
          <Link to="/esqueci-senha" className="am-forgot">
            Esqueci minha senha
          </Link>
        </div>

        {error && <p className="am-error">{error}</p>}

        <button type="submit" disabled={loading} className="am-btn">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        <div className="am-divider">OU</div>

        <div className="am-footer-line">
          Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
        </div>
      </form>
    </div>

    {/* Desktop (>=860px) — handoff de design: painel de marca + formulário */}
    <div className="login-desktop hidden min-[860px]:flex">
      <div className="ld-brand">
        <div className="ld-brand-top">
          <img src="/destino-logo.png" alt="des.tino" style={{ height: 26, display: 'block' }} />
        </div>

        <div className="ld-brand-mid ld-mid-fixed-gap">
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
