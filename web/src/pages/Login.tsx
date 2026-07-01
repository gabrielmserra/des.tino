import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) setError('E-mail ou senha inválidos.')
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
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
        </form>

        <p className="mt-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
          Use a mesma conta do aplicativo.
        </p>
      </div>
    </div>
  )
}
