import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchBenefitsOverview } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { BenefitForm } from '../components/BenefitForm'
import type { BenefitOverview } from '../lib/types'

export function Benefits() {
  const [formBenefit, setFormBenefit] = useState<BenefitOverview | 'new' | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['benefitsOverview'],
    queryFn: fetchBenefitsOverview,
  })

  const benefits = data ?? []

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vale Refeição / Alimentação</h1>
        <button
          onClick={() => setFormBenefit('new')}
          className="rounded-lg px-3 py-2 text-sm font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          + VR/VA
        </button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Carregando…
        </p>
      ) : benefits.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhum benefício. Toque em "+ VR/VA" para adicionar.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {benefits.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border p-4"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{b.name}</span>
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: b.color }}
                  >
                    {b.benefit_type}
                  </span>
                </div>
                <button
                  onClick={() => setFormBenefit(b)}
                  className="text-sm"
                  style={{ color: 'var(--muted)' }}
                >
                  Editar
                </button>
              </div>

              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Saldo disponível
              </p>
              <p className="mb-2 text-2xl font-bold" style={{ color: b.color }}>
                {formatCurrency(b.balance)}
              </p>

              <p
                className="text-xs"
                style={{ color: b.days_until_renewal <= 3 ? 'var(--accent)' : 'var(--muted)' }}
              >
                Renova em {b.days_until_renewal}d
              </p>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                Recarga: {formatCurrency(b.recharge_amount)} (
                {b.recharge_mode === 'acumula' ? 'acumula' : 'zera'})
              </p>
            </div>
          ))}
        </div>
      )}

      {formBenefit !== null && (
        <BenefitForm
          benefit={formBenefit === 'new' ? null : formBenefit}
          onClose={() => setFormBenefit(null)}
        />
      )}
    </div>
  )
}
