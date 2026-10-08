import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchInvestorProfileHistory,
  fetchInvestments,
  fetchAllInvestmentMovements,
  fetchMonths,
  fetchMonthSummary,
  fetchTargetAllocations,
  saveTargetAllocation,
  resetTargetAllocations,
} from '../lib/api'
import { ASSET_CLASSES, ASSET_CLASS_LABELS, NAO_CLASSIFICADO, type AssetClass } from '../lib/assetClasses'
import { aggregateByClass, compareAllocation, diagnose, type ComparisonRow, type DiagnosisTone } from '../lib/allocationStrategy'
import { buildExportPayload, downloadPortfolioJson, type PortfolioMode } from '../lib/portfolioIo'
import { formatCurrency } from '../lib/format'
import { Disclaimer } from '../components/Disclaimer'
import { ExportModeDialog } from '../components/MockPortfolioDialogs'

const TONE_COLOR: Record<DiagnosisTone, { color: string; dim: string }> = {
  red: { color: 'var(--red)', dim: 'rgba(224,82,82,0.12)' },
  gold: { color: 'var(--accent)', dim: 'rgba(245,166,35,0.12)' },
  green: { color: 'var(--primary)', dim: 'rgba(46,175,125,0.12)' },
  blue: { color: 'var(--violet)', dim: 'rgba(155,114,245,0.12)' },
}

const STATUS_COLOR: Record<ComparisonRow['status'], string> = {
  dentro: 'var(--primary)',
  acima: 'var(--accent)',
  abaixo: 'var(--red)',
}
const STATUS_LABEL: Record<ComparisonRow['status'], string> = {
  dentro: 'Dentro da meta',
  acima: 'Acima',
  abaixo: 'Abaixo',
}

const CLASS_LABELS_WITH_UNCLASSIFIED: Record<string, string> = {
  ...ASSET_CLASS_LABELS,
  [NAO_CLASSIFICADO]: 'Não classificado',
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border-l)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export function AllocationComparison() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [exporting, setExporting] = useState(false)

  const historyQ = useQuery({ queryKey: ['investorProfileHistory'], queryFn: fetchInvestorProfileHistory })
  const profile = historyQ.data?.[0]?.profile ?? null

  const invQ = useQuery({ queryKey: ['investments'], queryFn: () => fetchInvestments() })
  const movQ = useQuery({ queryKey: ['investmentMovements'], queryFn: fetchAllInvestmentMovements })
  const monthsQ = useQuery({ queryKey: ['months'], queryFn: fetchMonths })
  const latestMonthId = monthsQ.data?.[0]?.id
  const summaryQ = useQuery({
    queryKey: ['summary', latestMonthId],
    queryFn: () => fetchMonthSummary(latestMonthId!),
    enabled: latestMonthId != null,
  })
  const targetsQ = useQuery({
    queryKey: ['targetAllocations', profile],
    queryFn: () => fetchTargetAllocations(profile!),
    enabled: profile != null,
  })

  const loading = historyQ.isLoading || invQ.isLoading || movQ.isLoading

  if (loading) {
    return (
      <div className="p-4">
        <p style={{ color: 'var(--muted)' }}>Carregando…</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4">
        <div className="rounded-2xl border p-8 text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <p className="mb-2 text-4xl">📊</p>
          <p className="mb-1 font-bold">Faça o teste de perfil primeiro</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            A comparação de alocação usa o alvo do seu perfil de investidor — abra a aba "Perfil de
            Investidor" pra responder o questionário.
          </p>
        </div>
      </div>
    )
  }

  const investments = invQ.data ?? []
  const movements = movQ.data ?? []
  const targets = targetsQ.data ?? []
  const monthlyExpenses = summaryQ.data?.total_saidas ?? 0

  const targetByClass = Object.fromEntries(
    targets.map((t) => [t.asset_class, { target_pct: t.target_pct, tolerance_pct: t.tolerance_pct }]),
  )
  const actualByClass = aggregateByClass(investments, movements)
  const comparisons = compareAllocation(actualByClass, targetByClass)
  const tips = diagnose(comparisons, investments, movements, monthlyExpenses)

  return (
    <div className="p-4 pb-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Alocação — perfil {profile}</h2>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => setExporting(true)}
            disabled={comparisons.length === 0}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            ↓ Exportar
          </button>
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            ✎ Editar metas
          </button>
        </div>
      </div>

      {comparisons.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhum investimento com saldo ainda.
        </p>
      ) : (
        <div className="mb-5 flex flex-col gap-2">
          {comparisons.map((c) => {
            const label = CLASS_LABELS_WITH_UNCLASSIFIED[c.asset_class] ?? c.asset_class
            const statusColor = STATUS_COLOR[c.status]
            const dev = c.deviation_pct * 100
            return (
              <div key={c.asset_class} className="rounded-xl border p-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs font-bold" style={{ color: statusColor }}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {formatCurrency(c.actual_value)} · atual {(c.actual_pct * 100).toFixed(0)}% · alvo{' '}
                  {(c.target_pct * 100).toFixed(0)}% ·{' '}
                  <span style={{ color: statusColor }}>
                    {dev >= 0 ? '+' : ''}
                    {dev.toFixed(0)}pp
                  </span>
                </p>
              </div>
            )
          })}
        </div>
      )}

      <h3 className="mb-2 text-sm font-bold">Diagnóstico</h3>
      <div className="mb-5 flex flex-col gap-2">
        {tips.map((tip, i) => {
          const { color, dim } = TONE_COLOR[tip.tone]
          return (
            <div key={i} className="rounded-xl p-3" style={{ background: dim }}>
              <div className="mb-1 flex items-center gap-1.5">
                <span>{tip.icon}</span>
                <span className="text-sm font-bold" style={{ color }}>
                  {tip.title}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {tip.body}
              </p>
            </div>
          )
        })}
      </div>

      <Disclaimer />

      {editing && (
        <EditTargetsSheet
          profile={profile}
          initial={targets}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ['targetAllocations', profile] })
            setEditing(false)
          }}
        />
      )}

      {exporting && (
        <ExportModeDialog
          onClose={() => setExporting(false)}
          onChoose={(mode: PortfolioMode) => {
            // "Não classificado" não é uma classe de ativo de verdade --
            // exportar fica de fora pra não gerar um arquivo que a
            // própria validação de import rejeitaria depois (classe
            // desconhecida, ou soma de percentuais < 100% sem ela).
            const exportable = comparisons.filter((c) => c.asset_class !== NAO_CLASSIFICADO)
            const classifiedTotal = exportable.reduce((a, c) => a + c.actual_value, 0)
            const items =
              mode === 'absolute'
                ? exportable.map((c) => ({ asset_class: c.asset_class, label: null, value: c.actual_value }))
                : exportable.map((c) => ({
                    asset_class: c.asset_class,
                    label: null,
                    value: classifiedTotal > 0 ? c.actual_value / classifiedTotal : 0,
                  }))
            const payload = buildExportPayload('Carteira atual', items, mode)
            downloadPortfolioJson('carteira_atual.json', payload)
            setExporting(false)
          }}
        />
      )}
    </div>
  )
}

function EditTargetsSheet({
  profile,
  initial,
  onClose,
  onSaved,
}: {
  profile: string
  initial: { asset_class: string; target_pct: number; tolerance_pct: number }[]
  onClose: () => void
  onSaved: () => void
}) {
  const byClass = Object.fromEntries(initial.map((t) => [t.asset_class, t]))
  const [values, setValues] = useState<Record<string, { target: string; tolerance: string }>>(
    Object.fromEntries(
      ASSET_CLASSES.map((cls) => [
        cls,
        {
          target: ((byClass[cls]?.target_pct ?? 0) * 100).toFixed(0),
          tolerance: ((byClass[cls]?.tolerance_pct ?? 0) * 100).toFixed(0),
        },
      ]),
    ),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField = (cls: string, field: 'target' | 'tolerance', value: string) =>
    setValues((prev) => ({ ...prev, [cls]: { ...prev[cls], [field]: value } }))

  const save = async () => {
    setError('')
    const parsed: Record<string, { target_pct: number; tolerance_pct: number }> = {}
    for (const cls of ASSET_CLASSES) {
      const t = parseFloat(values[cls].target.replace(',', '.'))
      const tol = parseFloat(values[cls].tolerance.replace(',', '.'))
      if (isNaN(t) || isNaN(tol)) {
        setError('Valores inválidos -- use só números.')
        return
      }
      parsed[cls] = { target_pct: Math.max(0, t) / 100, tolerance_pct: Math.max(0, tol) / 100 }
    }
    setSaving(true)
    try {
      for (const cls of ASSET_CLASSES) {
        await saveTargetAllocation(profile, cls, parsed[cls].target_pct, parsed[cls].tolerance_pct)
      }
      onSaved()
    } catch (e) {
      setError('Erro ao salvar: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const restoreDefaults = async () => {
    setError('')
    setSaving(true)
    try {
      const rows = await resetTargetAllocations(profile)
      const byC = Object.fromEntries(rows.map((r) => [r.asset_class, r]))
      setValues(
        Object.fromEntries(
          ASSET_CLASSES.map((cls) => [
            cls,
            {
              target: ((byC[cls]?.target_pct ?? 0) * 100).toFixed(0),
              tolerance: ((byC[cls]?.tolerance_pct ?? 0) * 100).toFixed(0),
            },
          ]),
        ),
      )
    } catch (e) {
      setError('Erro: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold">Metas — perfil {profile}</h2>
      <p className="mb-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
        % alvo e tolerância por classe de ativo (a soma dos alvos idealmente fecha 100%).
      </p>
      <div className="flex flex-col gap-2">
        {ASSET_CLASSES.map((cls) => (
          <div key={cls} className="flex items-center gap-2">
            <span className="flex-1 text-sm">{ASSET_CLASS_LABELS[cls as AssetClass]}</span>
            <input
              value={values[cls].target}
              onChange={(e) => setField(cls, 'target', e.target.value)}
              inputMode="decimal"
              placeholder="Alvo %"
              className="w-16 rounded-lg border px-2 py-2 text-right text-sm outline-none"
              style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            />
            <input
              value={values[cls].tolerance}
              onChange={(e) => setField(cls, 'tolerance', e.target.value)}
              inputMode="decimal"
              placeholder="Toler. %"
              className="w-16 rounded-lg border px-2 py-2 text-right text-sm outline-none"
              style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            />
          </div>
        ))}
      </div>
      {error && (
        <p className="mt-3 text-center text-sm" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          onClick={restoreDefaults}
          disabled={saving}
          className="flex-1 rounded-lg border py-2.5 text-xs font-semibold disabled:opacity-60"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          Restaurar padrão
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border py-2.5 text-xs font-semibold"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-lg py-2.5 text-xs font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--violet)' }}
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </Sheet>
  )
}
