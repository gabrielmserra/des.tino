import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  createBenefit,
  updateBenefit,
  setBenefitBalance,
  archiveBenefit,
  type BenefitInput,
} from '../lib/api'
import type { BenefitOverview } from '../lib/types'

const BENEFIT_COLORS = ['#2EAF7D', '#F5A623', '#4ECDC4', '#6C8EFF', '#FF6B9D', '#9B72F5']
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

type Props = {
  benefit: BenefitOverview | null // null = criar novo
  onClose: () => void
}

export function BenefitForm({ benefit, onClose }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [type, setType] = useState<'VR' | 'VA'>('VR')
  const [balance, setBalance] = useState('')
  const [renewalDay, setRenewalDay] = useState(1)
  const [recharge, setRecharge] = useState('')
  const [mode, setMode] = useState<'acumula' | 'zera'>('acumula')
  const [color, setColor] = useState(BENEFIT_COLORS[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (benefit) {
      setName(benefit.name)
      setType(benefit.benefit_type as 'VR' | 'VA')
      setBalance(String(benefit.balance).replace('.', ','))
      setRenewalDay(benefit.renewal_day)
      setRecharge(String(benefit.recharge_amount).replace('.', ','))
      setMode((benefit.recharge_mode as 'acumula' | 'zera') || 'acumula')
      setColor(benefit.color)
    } else {
      setName(''); setType('VR'); setBalance(''); setRenewalDay(1)
      setRecharge(''); setMode('acumula'); setColor(BENEFIT_COLORS[0])
    }
    setError('')
  }, [benefit])

  async function invalidate() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['benefitsOverview'] }),
      qc.invalidateQueries({ queryKey: ['benefitsBasic'] }),
      qc.invalidateQueries({ queryKey: ['benefitTotal'] }),
    ])
  }

  const submit = async () => {
    if (!name.trim()) return setError('Preencha o nome.')
    const input: BenefitInput = {
      name: name.trim(),
      benefit_type: type,
      renewal_day: renewalDay,
      recharge_amount: parseAmount(recharge),
      recharge_mode: mode,
      color,
    }
    setBusy(true)
    try {
      if (benefit) {
        await updateBenefit(benefit.id, input)
        const newBalance = parseAmount(balance)
        if (newBalance !== benefit.balance) await setBenefitBalance(benefit.id, newBalance)
      } else {
        await createBenefit({ ...input, balance: parseAmount(balance) })
      }
      await invalidate()
      onClose()
    } catch (e) {
      setError('Erro ao salvar: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!benefit) return
    setBusy(true)
    try {
      await archiveBenefit(benefit.id)
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
        className="w-full max-w-md overflow-y-auto rounded-t-2xl border-t p-5"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border-l)',
          maxHeight: '90vh',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{benefit ? 'Editar benefício' : 'Novo VR / VA'}</h2>
          <button onClick={onClose} style={{ color: 'var(--muted)' }} className="text-2xl leading-none">
            ×
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (ex: VR Caju, VA Alelo…)"
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />

        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
              TIPO
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'VR' | 'VA')}
              className="w-full rounded-lg border px-3 py-3 text-base outline-none"
              style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            >
              <option value="VR">VR</option>
              <option value="VA">VA</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
              {benefit ? 'AJUSTAR SALDO (R$)' : 'SALDO ATUAL (R$)'}
            </label>
            <input
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="w-full rounded-lg border px-3 py-3 text-base outline-none"
              style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            />
          </div>
        </div>

        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
              DIA DE RENOVAÇÃO
            </label>
            <select
              value={renewalDay}
              onChange={(e) => setRenewalDay(Number(e.target.value))}
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
              RECARGA (R$)
            </label>
            <input
              value={recharge}
              onChange={(e) => setRecharge(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="w-full rounded-lg border px-3 py-3 text-base outline-none"
              style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            />
          </div>
        </div>

        <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
          COMPORTAMENTO DA RECARGA
        </label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as 'acumula' | 'zera')}
          className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          <option value="acumula">Acumula (soma ao saldo)</option>
          <option value="zera">Zera (substitui o saldo)</option>
        </select>

        <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--muted)' }}>
          COR
        </label>
        <div className="mb-4 flex gap-2">
          {BENEFIT_COLORS.map((c) => (
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
          {busy ? 'Salvando…' : benefit ? 'Salvar' : 'Criar benefício'}
        </button>

        {benefit && (
          <button
            onClick={remove}
            disabled={busy}
            className="mt-2 w-full rounded-lg border py-3 font-semibold disabled:opacity-60"
            style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
          >
            Excluir (arquivar)
          </button>
        )}
      </div>
    </div>
  )
}
