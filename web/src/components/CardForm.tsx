import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createCard, updateCard, deleteCard, type CardInput } from '../lib/api'
import type { CardOverview } from '../lib/types'

const CARD_COLORS = [
  '#6C8EFF', '#2EAF7D', '#E05252', '#9B72F5',
  '#F5A623', '#4ECDC4', '#FF6B9D', '#FFB347',
]

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

type Props = {
  card: CardOverview | null // null = criar novo
  onClose: () => void
}

export function CardForm({ card, onClose }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [limit, setLimit] = useState('')
  const [dueDay, setDueDay] = useState(10)
  const [closingDay, setClosingDay] = useState(1)
  const [color, setColor] = useState(CARD_COLORS[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (card) {
      setName(card.name)
      setLimit(card.card_limit > 0 ? String(card.card_limit).replace('.', ',') : '')
      setDueDay(card.due_day)
      setClosingDay(card.closing_day)
      setColor(card.color)
    } else {
      setName(''); setLimit(''); setDueDay(10); setClosingDay(1); setColor(CARD_COLORS[0])
    }
    setError('')
  }, [card])

  async function invalidate() {
    await qc.invalidateQueries({ queryKey: ['cardsOverview'] })
  }

  const submit = async () => {
    if (!name.trim()) return setError('Preencha o nome do cartão.')
    const input: CardInput = {
      name: name.trim(),
      limit: parseAmount(limit),
      due_day: dueDay,
      closing_day: closingDay,
      color,
    }
    setBusy(true)
    try {
      if (card) await updateCard(card.id, input)
      else await createCard(input)
      await invalidate()
      onClose()
    } catch (e) {
      setError('Erro ao salvar: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!card) return
    setBusy(true)
    try {
      await deleteCard(card.id)
      await invalidate()
      onClose()
    } catch (e) {
      setError('Erro ao excluir: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border-t p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border-l)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{card ? 'Editar cartão' : 'Novo cartão'}</h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }} className="text-2xl leading-none">
            ×
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (ex: Nubank, Itaú Gold…)"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />

        <input
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          inputMode="decimal"
          placeholder="Limite (R$) — deixe vazio p/ sem limite"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />

        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
              FECHAMENTO
            </label>
            <select
              value={closingDay}
              onChange={(e) => setClosingDay(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-3 text-base outline-none"
              style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
              VENCIMENTO
            </label>
            <select
              value={dueDay}
              onChange={(e) => setDueDay(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-3 text-base outline-none"
              style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
          COR
        </label>
        <div className="mb-4 flex gap-2">
          {CARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-8 w-8 rounded-full"
              style={{
                background: c,
                boxShadow: color === c ? `0 0 0 3px var(--card), 0 0 0 5px ${c}` : 'none',
              }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>

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
          {busy ? 'Salvando…' : card ? 'Salvar' : 'Criar cartão'}
        </button>

        {card && (
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
