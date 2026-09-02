import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import './Auth.css'

export function SignUp() {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) return setError('Preencha todos os campos.')
    if (password !== confirm) return setError('As senhas não coincidem.')
    if (password.length < 6) return setError('A senha deve ter ao menos 6 caracteres.')

    setLoading(true)
    const { error, needsConfirmation } = await signUp(email.trim(), password)
    setLoading(false)
    if (error) {
      if (/already registered/i.test(error)) {
        setError('Este e-mail já está cadastrado.')
      } else {
        setError(error)
      }
      return
    }
    if (needsConfirmation) {
      setConfirmationSent(true)
    }
    // Se não precisar confirmar, a sessão já foi criada — o próprio
    // AuthProvider detecta e o App troca pra tela principal sozinho.
  }

  if (confirmationSent) {
    return (
      <>
        {/* Mobile (<860px) — mesmo sistema visual do handoff, sem tela própria definida pro handoff */}
        <div className="auth-mobile min-[860px]:hidden">
          <div className="am-top">
            <img className="am-logo" src="/destino-logo.png" alt="des.tino" />
          </div>
          <div className="am-head">
            <h1>Quase lá!</h1>
            <p>
              Enviamos um link de confirmação para <strong>{email}</strong>. Abra seu e-mail e
              confirme pra poder entrar.
            </p>
          </div>
          <div className="am-form">
            <Link to="/login" className="am-back-link">
              ← Voltar para login
            </Link>
          </div>
        </div>

        {/* Desktop (>=860px) — mesmo sistema visual do handoff, sem tela própria definida pro handoff */}
        <div className="login-desktop hidden min-[860px]:flex">
          <div className="ld-brand">
            <div className="ld-brand-top">
              <img src="/destino-logo.png" alt="des.tino" style={{ height: 26, display: 'block' }} />
            </div>
            <div className="ld-brand-mid">
              <h1>
                Comece a organizar
                <br />
                <b>suas finanças hoje.</b>
              </h1>
              <p>Crie sua conta gratuita e acompanhe entradas, saídas e investimentos em um só lugar.</p>
            </div>
            <div />
          </div>

          <div className="ld-form-side">
            <div className="ld-form-box">
              <h2>Quase lá!</h2>
              <div className="ld-sub">
                Enviamos um link de confirmação para <strong>{email}</strong>. Abra seu e-mail e
                confirme pra poder entrar.
              </div>
              <Link to="/login" className="ld-back-link">
                ← Voltar para login
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
    {/* Mobile (<860px) — handoff de design */}
    <div className="auth-mobile min-[860px]:hidden">
      <div className="am-top">
        <Link to="/login" className="am-back" aria-label="Voltar">
          ←
        </Link>
        <img className="am-logo" src="/destino-logo.png" alt="des.tino" />
      </div>
      <div className="am-head">
        <h1>Criar conta</h1>
        <p>Comece a usar o des.tino gratuitamente</p>
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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        <div className="am-field">
          <label>Confirmar senha</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••••"
          />
        </div>

        {error && <p className="am-error">{error}</p>}

        <button type="submit" disabled={loading} className="am-btn">
          {loading ? 'Criando conta…' : 'Criar conta'}
        </button>

        <div className="am-divider">OU</div>

        <div className="am-footer-line">
          Já tem conta? <Link to="/login">Entrar</Link>
        </div>
      </form>
    </div>

    {/* Desktop (>=860px) — handoff de design: mesmo sistema visual do Login, sem ilustração de rota */}
    <div className="login-desktop hidden min-[860px]:flex">
      <div className="ld-brand">
        <div className="ld-brand-top">
          <img src="/destino-logo.png" alt="des.tino" style={{ height: 26, display: 'block' }} />
        </div>

        <div className="ld-brand-mid">
          <h1>
            Comece a organizar
            <br />
            <b>suas finanças hoje.</b>
          </h1>
          <p>Crie sua conta gratuita e acompanhe entradas, saídas e investimentos em um só lugar.</p>
        </div>

        <div />
      </div>

      <div className="ld-form-side">
        <form onSubmit={onSubmit} className="ld-form-box">
          <h2>Criar conta</h2>
          <div className="ld-sub">Comece a usar o des.tino gratuitamente</div>

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
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
            <div className="ld-bar" />
          </div>

          <div className="ld-field">
            <label>Confirmar senha</label>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••••"
            />
            <div className="ld-bar" />
          </div>

          {error && <p className="ld-error">{error}</p>}

          <button type="submit" disabled={loading} className="ld-btn">
            {loading ? 'Criando conta…' : 'Criar conta'}
          </button>

          <div className="ld-divider">OU</div>

          <div className="ld-footer-line">
            Já tem conta? <Link to="/login">Entrar</Link>
          </div>
        </form>
      </div>
    </div>
    </>
  )
}
