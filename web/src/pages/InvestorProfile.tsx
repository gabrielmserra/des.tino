import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { saveInvestorProfileResult, fetchInvestorProfileHistory } from '../lib/api'
import { QUESTIONS, PROFILE_EXPLANATIONS, scoreAnswers } from '../lib/investorProfileQuiz'
import { Disclaimer } from '../components/Disclaimer'
import { ConfirmDialog } from '../components/InvestmentDialogs'
import { formatDate } from '../lib/format'

export function InvestorProfile() {
  const qc = useQueryClient()
  const historyQ = useQuery({ queryKey: ['investorProfileHistory'], queryFn: fetchInvestorProfileHistory })
  const history = historyQ.data ?? []

  const [quizMode, setQuizMode] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmingRetake, setConfirmingRetake] = useState(false)

  if (historyQ.isLoading) {
    return (
      <div className="p-4">
        <p style={{ color: 'var(--muted)' }}>Carregando…</p>
      </div>
    )
  }

  const startQuiz = () => {
    setAnswers({})
    setError('')
    setQuizMode(true)
  }

  const allAnswered = QUESTIONS.every((q) => answers[q.id])

  const submit = async () => {
    if (!allAnswered) return
    setSaving(true)
    setError('')
    try {
      const { score, profile } = scoreAnswers(answers)
      await saveInvestorProfileResult(score, profile, answers)
      await qc.invalidateQueries({ queryKey: ['investorProfileHistory'] })
      setQuizMode(false)
    } catch (e) {
      setError('Erro ao salvar: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ── Questionário ─────────────────────────────────────────────────
  if (quizMode) {
    return (
      <div className="p-4 pb-8">
        <h2 className="mb-1 text-lg font-bold">Questionário de perfil de investidor</h2>
        <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
          Responda todas as perguntas pra ver o resultado.
        </p>
        <div className="flex flex-col gap-3">
          {QUESTIONS.map((q, i) => (
            <div key={q.id} className="rounded-xl border p-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <p className="mb-2 text-sm font-semibold">
                {i + 1}. {q.text}
              </p>
              <div className="flex flex-col gap-1.5">
                {q.options.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                    <input
                      type="radio"
                      name={q.id}
                      value={opt.value}
                      checked={answers[q.id] === opt.value}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))}
                      style={{ accentColor: 'var(--violet)' }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {error && (
          <p className="mt-3 text-sm" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setQuizMode(false)}
            className="flex-1 rounded-lg border py-3 font-semibold"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!allAnswered || saving}
            className="flex-1 rounded-lg py-3 font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--violet)' }}
          >
            {saving ? 'Salvando…' : 'Ver resultado'}
          </button>
        </div>
      </div>
    )
  }

  // ── Sem nenhuma tentativa ainda ──────────────────────────────────
  if (history.length === 0) {
    return (
      <div className="p-4">
        <div className="rounded-2xl border p-8 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="mb-2 text-4xl">🧭</p>
          <p className="mb-1 font-bold">Descubra seu perfil de investidor</p>
          <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
            Responda algumas perguntas sobre seus objetivos e tolerância a risco para ver uma
            comparação entre sua carteira e o alvo sugerido pro seu perfil.
          </p>
          <button
            onClick={startQuiz}
            className="rounded-lg px-4 py-3 font-bold text-white"
            style={{ background: 'var(--violet)' }}
          >
            ⚡ Fazer teste de perfil
          </button>
        </div>
      </div>
    )
  }

  // ── Resultado + histórico ────────────────────────────────────────
  const latest = history[0]
  return (
    <div className="p-4 pb-8">
      <div className="mb-4 rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
          SEU PERFIL
        </p>
        <p className="text-2xl font-bold" style={{ color: 'var(--violet)' }}>
          {latest.profile}
        </p>
        <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>
          Pontuação: {latest.score.toFixed(0)}/100
        </p>
        <p className="text-sm">{PROFILE_EXPLANATIONS[latest.profile]}</p>
      </div>

      <button
        onClick={() => setConfirmingRetake(true)}
        className="mb-4 rounded-lg border px-3 py-2 text-sm font-semibold"
        style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
      >
        🔄 Refazer teste
      </button>

      {confirmingRetake && (
        <ConfirmDialog
          title="Refazer o teste?"
          message="Suas respostas atuais continuam no histórico -- isso só adiciona uma nova tentativa, com um perfil novo."
          confirmText="Refazer"
          danger={false}
          onClose={() => setConfirmingRetake(false)}
          onConfirm={() => {
            setConfirmingRetake(false)
            startQuiz()
          }}
        />
      )}

      <div className="mb-5">
        <Disclaimer />
      </div>

      {history.length > 1 && (
        <>
          <h3 className="mb-2 text-sm font-bold">Histórico</h3>
          <div className="flex flex-col gap-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border p-3 text-sm"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <span style={{ color: 'var(--muted)' }}>{formatDate(item.created_at.slice(0, 10))}</span>
                <span className="font-semibold">{item.profile}</span>
                <span style={{ color: 'var(--muted)' }}>{item.score.toFixed(0)}/100</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
