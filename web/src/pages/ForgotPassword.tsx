import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './AuthDesktop.css'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  const submit = async () => {
    if (!email.trim()) return setError('Digite seu e-mail.')
    setStatus('sending')
    setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setStatus('sent')
    } catch (e) {
      setStatus('error')
      setError((e as Error).message || 'Erro ao enviar o link.')
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
        </div>

        <div className="rounded-2xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h2 className="mb-1 text-lg font-bold">Esqueceu sua senha?</h2>
          <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
            Digite seu e-mail e enviaremos um link para criar uma nova senha.
          </p>

          <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
            E-MAIL
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className="mb-4 w-full rounded-lg border px-3 py-3 text-base outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
          />

          {status === 'sent' && (
            <p className="mb-3 text-sm" style={{ color: 'var(--primary)' }}>
              Link enviado! Verifique seu e-mail.
            </p>
          )}
          {error && (
            <p className="mb-3 text-sm" style={{ color: 'var(--red)' }}>
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={status === 'sending'}
            className="w-full rounded-lg py-3 font-bold text-white disabled:opacity-60"
            style={{ background: 'var(--primary)' }}
          >
            {status === 'sending' ? 'Enviando…' : 'Enviar link de redefinição'}
          </button>
        </div>

        <Link to="/login" className="mt-4 block text-center text-sm" style={{ color: 'var(--muted)' }}>
          ← Voltar para login
        </Link>
      </div>
    </div>

    {/* Desktop (>=860px) — handoff de design: mesmo sistema visual do Login/Cadastro */}
    <div className="login-desktop hidden min-[860px]:flex">
      <div className="ld-brand">
        <div className="ld-brand-top">
          <img src="/destino-logo.png" alt="des.tino" style={{ height: 26, display: 'block' }} />
        </div>

        <div className="ld-brand-mid">
          <h1>
            Sem problemas,
            <br />
            <b>vamos recuperar.</b>
          </h1>
          <p>Digite seu e-mail cadastrado e enviaremos um link para você criar uma nova senha.</p>
        </div>

        <div />
      </div>

      <div className="ld-form-side">
        <div className="ld-form-box">
          <h2>Esqueceu sua senha?</h2>
          <div className="ld-sub">Digite seu e-mail e enviaremos um link para criar uma nova senha.</div>

          <div className="ld-field">
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
            />
            <div className="ld-bar" />
          </div>

          {status === 'sent' && <p className="ld-success">Link enviado! Verifique seu e-mail.</p>}
          {error && <p className="ld-error">{error}</p>}

          <button onClick={submit} disabled={status === 'sending'} className="ld-btn">
            {status === 'sending' ? 'Enviando…' : 'Enviar link de redefinição'}
          </button>

          <Link to="/login" className="ld-back-link">
            ← Voltar para login
          </Link>
        </div>
      </div>
    </div>
    </>
  )
}
