import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import './AuthDesktop.css'

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
        {/* Mobile (<860px) — layout atual, sem alterações */}
        <div className="flex min-h-full items-center justify-center p-6 min-[860px]:hidden">
          <div className="w-full max-w-sm text-center">
            <h1 className="mb-4 text-3xl font-bold">
              des<span style={{ color: 'var(--primary)' }}>.</span>tino
            </h1>
            <div className="rounded-2xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <p className="mb-2 text-lg font-bold">Quase lá!</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Enviamos um link de confirmação para <strong>{email}</strong>. Abra seu e-mail
                e confirme pra poder entrar.
              </p>
            </div>
            <Link to="/login" className="mt-4 block text-center text-sm" style={{ color: 'var(--muted)' }}>
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
    {/* Mobile (<860px) — layout atual, sem alterações */}
    <div className="flex min-h-full items-center justify-center p-6 min-[860px]:hidden">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">
            des<span style={{ color: 'var(--primary)' }}>.</span>tino
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Crie sua conta.
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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border px-3 py-3 text-base outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            placeholder="Mínimo 6 caracteres"
          />

          <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
            CONFIRMAR SENHA
          </label>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <Link to="/login" className="mt-4 block text-center text-sm" style={{ color: 'var(--muted)' }}>
          Já tem conta? Entrar
        </Link>
      </div>
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
