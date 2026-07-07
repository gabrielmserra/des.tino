import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

type Status = 'checking' | 'ready' | 'invalid' | 'success'

// Acessada pelo link de e-mail (?redirectTo=/reset-password#access_token=...&type=recovery).
// O supabase-js (detectSessionInUrl: true) processa o hash sozinho e cria uma
// sessão temporária — só então a tela de "definir nova senha" é liberada.
export function ResetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loading) return
    if (session) {
      setStatus((s) => (s === 'success' ? s : 'ready'))
      return
    }
    const t = setTimeout(() => {
      setStatus((s) => (s === 'checking' ? 'invalid' : s))
    }, 2500)
    return () => clearTimeout(t)
  }, [session, loading])

  const submit = async () => {
    if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não coincidem.')
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setStatus('success')
      await supabase.auth.signOut()
    } catch (e) {
      setError((e as Error).message || 'Erro ao atualizar a senha.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div
        className="w-full max-w-sm rounded-2xl border p-6"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <h1 className="mb-1 text-center text-2xl font-bold">
          des<span style={{ color: 'var(--primary)' }}>.</span>tino
        </h1>

        {status === 'checking' && (
          <p className="mt-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Verificando link…
          </p>
        )}

        {status === 'invalid' && (
          <>
            <p className="mt-4 text-center text-3xl">⚠️</p>
            <p className="mt-2 text-center font-bold">Link inválido</p>
            <p className="mt-1 text-center text-sm" style={{ color: 'var(--muted)' }}>
              Este link expirou ou já foi utilizado. Solicite um novo na tela de login.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="mt-4 w-full rounded-lg py-3 font-bold text-white"
              style={{ background: 'var(--primary)' }}
            >
              Voltar para login
            </button>
          </>
        )}

        {status === 'ready' && (
          <>
            <p className="mb-4 mt-1 text-center text-sm" style={{ color: 'var(--muted)' }}>
              Digite e confirme sua nova senha.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha (mín. 6 caracteres)"
              autoComplete="new-password"
              className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
              style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmar senha"
              autoComplete="new-password"
              className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
              style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            />
            {error && (
              <p className="mb-3 text-sm" style={{ color: 'var(--red)' }}>
                {error}
              </p>
            )}
            <button
              onClick={submit}
              disabled={busy}
              className="w-full rounded-lg py-3 font-bold text-white disabled:opacity-60"
              style={{ background: 'var(--primary)' }}
            >
              {busy ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </>
        )}

        {status === 'success' && (
          <>
            <p className="mt-4 text-center text-3xl">✅</p>
            <p className="mt-2 text-center font-bold">Senha atualizada!</p>
            <p className="mt-1 text-center text-sm" style={{ color: 'var(--muted)' }}>
              Sua senha foi redefinida com sucesso. Faça login novamente.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="mt-4 w-full rounded-lg py-3 font-bold text-white"
              style={{ background: 'var(--primary)' }}
            >
              Ir para login
            </button>
          </>
        )}
      </div>
    </div>
  )
}
