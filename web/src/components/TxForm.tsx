import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTxForm } from '../lib/txform'
import { useMonths } from '../lib/month'
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
  fetchCardsBasic,
  fetchBenefitsBasic,
  type TxInput,
} from '../lib/api'
import { CATEGORIES } from '../lib/constants'
import { formatCurrency } from '../lib/format'
import type { TxType } from '../lib/types'

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.abs(n)
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: [string, string][]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-2">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className="flex-1 rounded-lg py-2 text-sm font-semibold"
          style={{
            background: value === v ? 'var(--primary)' : 'var(--card2)',
            color: value === v ? '#fff' : 'var(--muted)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function TxForm() {
  const { state, close } = useTxForm()
  const { selectedId } = useMonths()
  const qc = useQueryClient()

  const [flow, setFlow] = useState<'entrada' | 'saida'>('saida')
  const [freq, setFreq] = useState<'fixa' | 'variavel'>('variavel')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Outros')
  const [previsto, setPrevisto] = useState(false)
  const [origin, setOrigin] = useState('nenhum') // 'nenhum' | 'card:<id>' | 'benefit:<id>'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Origem (cartão/VR-VA) só existe para saída variável, igual ao desktop
  const showOrigin = flow === 'saida' && freq === 'variavel'
  const cardsQ = useQuery({ queryKey: ['cardsBasic'], queryFn: fetchCardsBasic })
  const benefitsQ = useQuery({ queryKey: ['benefitsBasic'], queryFn: fetchBenefitsBasic })

  // Preenche ao abrir (novo ou edição)
  useEffect(() => {
    if (!state) return
    if (state.mode === 'edit') {
      const t = state.tx
      setFlow(t.type.startsWith('entrada') ? 'entrada' : 'saida')
      setFreq(t.type.endsWith('fixa') ? 'fixa' : 'variavel')
      setDescription(t.description)
      setAmount(String(t.amount).replace('.', ','))
      setCategory(t.category || 'Outros')
      setPrevisto(t.is_expectation)
      if (t.benefit_id) setOrigin(`benefit:${t.benefit_id}`)
      else if (t.card_id) setOrigin(`card:${t.card_id}`)
      else setOrigin('nenhum')
    } else {
      setFlow('saida'); setFreq('variavel'); setDescription(''); setAmount('')
      setCategory('Outros'); setPrevisto(false); setOrigin('nenhum')
    }
    setError('')
  }, [state])

  if (!state) return null

  const isEdit = state.mode === 'edit'
  const isIncome = flow === 'entrada'

  const submit = async () => {
    if (!description.trim()) return setError('Preencha a descrição.')
    const value = parseAmount(amount)
    if (value <= 0) return setError('Digite um valor positivo.')
    if (selectedId == null) return setError('Nenhum mês selecionado.')

    const cardId = showOrigin && origin.startsWith('card:') ? Number(origin.split(':')[1]) : null
    const benefitId = showOrigin && origin.startsWith('benefit:') ? Number(origin.split(':')[1]) : null

    // Saldo de VR/VA não pode ficar negativo — bloqueia (gastos reais, não previsões)
    if (benefitId != null && !previsto) {
      const info = (benefitsQ.data ?? []).find((b) => b.id === benefitId)
      let avail = info ? info.balance : 0
      if (isEdit) {
        const old = state.tx
        if (old.benefit_id === benefitId && !old.is_expectation) avail += old.amount
      }
      if (value > avail + 1e-9) {
        return setError(
          `Saldo insuficiente em ${info?.name ?? 'benefício'}: disponível ${formatCurrency(avail)}. Reduza o valor ou troque a origem.`,
        )
      }
    }

    const type = `${flow}_${freq}` as TxType
    const payload: TxInput = {
      type,
      description: description.trim(),
      amount: value,
      category: isIncome ? 'Receita' : category,
      is_expectation: previsto,
      card_id: cardId,
      benefit_id: benefitId,
    }
    setBusy(true)
    try {
      if (isEdit) await updateTransaction(state.tx.id, payload)
      else await addTransaction(selectedId, payload)
      await invalidate()
      close()
    } catch (e) {
      setError('Erro ao salvar: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!isEdit) return
    setBusy(true)
    try {
      await deleteTransaction(state.tx.id)
      await invalidate()
      close()
    } catch (e) {
      setError('Erro ao excluir: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function invalidate() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['summary'] }),
      qc.invalidateQueries({ queryKey: ['cats'] }),
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['benefitTotal'] }),
      qc.invalidateQueries({ queryKey: ['totalInv'] }),
      qc.invalidateQueries({ queryKey: ['cardsOverview'] }),
      qc.invalidateQueries({ queryKey: ['benefitsBasic'] }),
    ])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border-t p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border-l)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? 'Editar lançamento' : 'Novo lançamento'}</h2>
          <button onClick={close} style={{ color: 'var(--muted)' }} className="text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="mb-3">
          <Seg
            options={[['entrada', 'Entrada'], ['saida', 'Saída']]}
            value={flow}
            onChange={(v) => setFlow(v as 'entrada' | 'saida')}
          />
        </div>
        <div className="mb-3">
          <Seg
            options={[['variavel', 'Variável'], ['fixa', 'Fixa']]}
            value={freq}
            onChange={(v) => setFreq(v as 'fixa' | 'variavel')}
          />
        </div>

        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição (ex: Mercado)"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />

        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />

        {!isIncome && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {showOrigin && (
          <div className="mb-3">
            <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
              ORIGEM / PAGAMENTO (opcional)
            </label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full rounded-lg border px-3 py-3 text-base outline-none"
              style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            >
              <option value="nenhum">Nenhum</option>
              {(cardsQ.data ?? []).map((c) => (
                <option key={`card:${c.id}`} value={`card:${c.id}`}>
                  {c.name}
                </option>
              ))}
              {(benefitsQ.data ?? []).map((b) => (
                <option key={`benefit:${b.id}`} value={`benefit:${b.id}`}>
                  {b.name} ({b.benefit_type}) — {formatCurrency(b.balance)}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="mb-4 flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
          <input
            type="checkbox"
            checked={previsto}
            onChange={(e) => setPrevisto(e.target.checked)}
          />
          Lançamento previsto (ainda não confirmado)
        </label>

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
          {busy ? 'Salvando…' : isEdit ? 'Salvar' : 'Adicionar'}
        </button>

        {isEdit && (
          <button
            onClick={remove}
            disabled={busy}
            className="mt-2 w-full rounded-lg border py-3 font-semibold disabled:opacity-60"
            style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
          >
            Excluir
          </button>
        )}
      </div>
    </div>
  )
}
