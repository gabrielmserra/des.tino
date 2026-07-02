import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createDebitCard, updateDebitCard, deleteDebitCard } from '../lib/api'
import type { DebitCardOverview } from '../lib/types'

const COLORS = ['#6C8EFF', '#2EAF7D', '#E05252', '#9B72F5', '#F5A623', '#4ECDC4', '#FF6B9D', '#FFB347']

type Props = {
  card: DebitCardOverview | null // null = criar novo
  onClose: () => void
}

export function DebitCardForm({ card, onClose }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (card) {
      setName(card.name)
      setColor(card.color)
    } else {
      setName(''); setColor(COLORS[0])
    }
    setError('')
  }, [card])

  async function invalidate() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['debitCardsOverview'] }),
      qc.invalidateQueries({ queryKey: ['debitCardsBasic'] }),
    ])
  }

  const submit = async () => {
    if (!name.trim()) return setError('Preencha o nome.')
    setBusy(true)
    try {
      if (card) await updateDebitCard(card.id, { name: name.trim(), color })
      else await createDebitCard({ name: name.trim(), color })
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
      await deleteDebitCard(card.id)
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
          <h2 className="text-lg font-bold">{card ? 'Editar débito' : 'Novo cartão de débito'}</h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }} className="text-2xl leading-none">
            ×
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (ex: Nubank Débito…)"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />

        <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
          COR
        </label>
        <div className="mb-4 flex gap-2">
          {COLORS.map((c) => (
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
