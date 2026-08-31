import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Download, X } from 'lucide-react'
import { useMonths } from '../lib/month'
import { useTxForm } from '../lib/txform'
import { fetchTransactions, fetchCardsBasic, fetchDebitCardsBasic, fetchBenefitsBasic } from '../lib/api'
import { Skeleton } from '../components/Skeleton'
import { formatCurrency, formatDate } from '../lib/format'
import { CATEGORIES, PAYMENT_METHODS } from '../lib/constants'
import type { Transaction, TxType, CardBasic, DebitCard, BenefitBasic } from '../lib/types'

const IS_INCOME: Record<TxType, boolean> = {
  entrada_fixa: true,
  entrada_variavel: true,
  saida_fixa: false,
  saida_variavel: false,
}

type Filter = 'todos' | 'entradas' | 'saidas'
type SortOrder = 'recentes' | 'antigos'
type DateFilterMode = 'todas' | 'periodo' | 'dia'

// Data real do pagamento — não a ordem de importação/criação no banco.
function txDate(t: Transaction): string {
  return (t.payment_date || t.created_at || '').slice(0, 10)
}

// Parcela de compra no cartão mostra "🧾 descrição (N/M)" em vez da
// descrição crua.
function txDisplayDesc(t: Transaction): string {
  if (t.card_purchase_id && t.installment_number && t.installment_total) {
    return `🧾 ${t.description} (${t.installment_number}/${t.installment_total})`
  }
  return t.description
}

function origemTag(
  t: Transaction,
  cards: CardBasic[],
  debitCards: DebitCard[],
  benefits: BenefitBasic[],
): string | null {
  if (t.payment_method === 'credito' && t.card_id) {
    return cards.find((c) => c.id === t.card_id)?.name ?? 'Crédito'
  }
  if (t.payment_method === 'debito' && t.debit_card_id) {
    return debitCards.find((d) => d.id === t.debit_card_id)?.name ?? 'Débito'
  }
  if (t.payment_method === 'vr_va' && t.benefit_id) {
    return benefits.find((b) => b.id === t.benefit_id)?.name ?? 'VR/VA'
  }
  if (t.payment_method) return PAYMENT_METHODS[t.payment_method] ?? t.payment_method
  return null
}

export function Transactions() {
  const { selectedId, selected } = useMonths()
  const { openEdit } = useTxForm()
  const [filter, setFilter] = useState<Filter>('todos')
  const [sortOrder, setSortOrder] = useState<SortOrder>('recentes')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [methodFilter, setMethodFilter] = useState<string>('')
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('todas')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [dateSingle, setDateSingle] = useState<string>('')
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', selectedId],
    queryFn: () => fetchTransactions(selectedId!),
    enabled: selectedId != null,
  })
  const cardsQ = useQuery({ queryKey: ['cardsBasic'], queryFn: fetchCardsBasic })
  const debitCardsQ = useQuery({ queryKey: ['debitCardsBasic'], queryFn: fetchDebitCardsBasic })
  const benefitsQ = useQuery({ queryKey: ['benefitsBasic'], queryFn: fetchBenefitsBasic })

  const all = data ?? []
  const hasActiveFilters =
    filter !== 'todos' || categoryFilter !== '' || methodFilter !== '' || dateFilterMode !== 'todas'
  const txs = all
    .filter((t) => {
      if (filter === 'entradas') return IS_INCOME[t.type]
      if (filter === 'saidas') return !IS_INCOME[t.type]
      return true
    })
    .filter((t) => !categoryFilter || (t.category || 'Outros') === categoryFilter)
    .filter((t) => !methodFilter || t.payment_method === methodFilter)
    .filter((t) => {
      if (dateFilterMode === 'dia') return !dateSingle || txDate(t) === dateSingle
      if (dateFilterMode === 'periodo') {
        if (dateFrom && txDate(t) < dateFrom) return false
        if (dateTo && txDate(t) > dateTo) return false
      }
      return true
    })
    .sort((a, b) => {
      const da = txDate(a)
      const db_ = txDate(b)
      return sortOrder === 'recentes' ? (da < db_ ? 1 : da > db_ ? -1 : 0) : da < db_ ? -1 : da > db_ ? 1 : 0
    })

  const handleExport = async () => {
    if (exporting || all.length === 0) return
    setExporting(true)
    try {
      // Carregado sob demanda: exceljs é pesado (~1MB), só baixa quem exporta.
      const { exportMonthXlsx } = await import('../lib/exportXlsx')
      await exportMonthXlsx(selected?.name ?? 'lancamentos', all)
    } finally {
      setExporting(false)
    }
  }

  const chip = (f: Filter, label: string) => (
    <button
      key={f}
      onClick={() => setFilter(f)}
      className="rounded-full px-4 py-1.5 text-sm font-semibold"
      style={{
        background: filter === f ? 'var(--primary)' : 'var(--card2)',
        color: filter === f ? '#fff' : 'var(--muted)',
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h1 className="text-2xl font-bold">Lançamentos</h1>
        <button
          onClick={handleExport}
          disabled={exporting || all.length === 0}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
          style={{ borderColor: 'var(--border-l)', color: 'var(--text)', background: 'var(--card)' }}
        >
          <Download size={14} strokeWidth={2} />
          {exporting ? 'Exportando…' : 'Exportar Excel'}
        </button>
      </div>
      <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
        {selected?.name}
      </p>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {chip('todos', 'Todos')}
          {chip('entradas', 'Entradas')}
          {chip('saidas', 'Saídas')}
        </div>
        <button
          onClick={() => setSortOrder((o) => (o === 'recentes' ? 'antigos' : 'recentes'))}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: 'var(--card2)', color: 'var(--muted)' }}
        >
          {sortOrder === 'recentes' ? (
            <ArrowDownWideNarrow size={14} strokeWidth={2} />
          ) : (
            <ArrowUpWideNarrow size={14} strokeWidth={2} />
          )}
          {sortOrder === 'recentes' ? 'Mais recentes' : 'Mais antigos'}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          <option value="">Todas as categorias</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          <option value="">Todas as formas de pagamento</option>
          {Object.entries(PAYMENT_METHODS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <select
          value={dateFilterMode}
          onChange={(e) => setDateFilterMode(e.target.value as DateFilterMode)}
          className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          <option value="todas">Todas as datas</option>
          <option value="periodo">Período</option>
          <option value="dia">Dia específico</option>
        </select>
        {dateFilterMode === 'periodo' && (
          <>
            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
              De
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none"
                style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
              />
            </label>
            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
              Até
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none"
                style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
              />
            </label>
          </>
        )}
        {dateFilterMode === 'dia' && (
          <input
            type="date"
            value={dateSingle}
            onChange={(e) => setDateSingle(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none"
            style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
          />
        )}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilter('todos')
              setCategoryFilter('')
              setMethodFilter('')
              setDateFilterMode('todas')
              setDateFrom('')
              setDateTo('')
              setDateSingle('')
            }}
            className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ color: 'var(--muted)' }}
          >
            <X size={12} strokeWidth={2.5} />
            Limpar filtros
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : txs.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhum lançamento neste filtro.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {txs.map((t) => {
            const income = IS_INCOME[t.type]
            const color = income ? 'var(--primary)' : 'var(--red)'
            const tag = origemTag(t, cardsQ.data ?? [], debitCardsQ.data ?? [], benefitsQ.data ?? [])
            return (
              <li
                key={t.id}
                onClick={() => openEdit(t)}
                className="flex cursor-pointer items-center justify-between rounded-xl border p-3 active:opacity-70"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-semibold"
                    style={{ color: t.is_expectation ? 'var(--muted)' : 'var(--text)' }}
                  >
                    {txDisplayDesc(t)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {t.category || 'Outros'}
                    </span>
                    {t.is_expectation && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: 'var(--card2)', color: 'var(--accent)' }}
                      >
                        previsto
                      </span>
                    )}
                    {tag && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: 'var(--card2)', color: 'var(--muted)' }}
                      >
                        {tag}
                      </span>
                    )}
                    {t.payment_date && (
                      <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                        {formatDate(t.payment_date)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="ml-3 shrink-0 font-bold" style={{ color }}>
                  {income ? '' : '- '}
                  {formatCurrency(Math.abs(t.amount))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
