import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { detectParser } from '../lib/parsers/registry'
import type { NormalizedRow } from '../lib/parsers/types'
import { ensureMonth, importTransactionsBulk, fetchMonths, fetchTransactions, fetchImportCutoffDay, fetchCardsBasic } from '../lib/api'
import { formatCurrency, formatDate, MONTHS_PT, billingMonth } from '../lib/format'
import { CATEGORIES, PAYMENT_METHODS } from '../lib/constants'
import type { Transaction } from '../lib/types'

type Candidate = NormalizedRow & {
  include: boolean
  monthId: number | null
  monthName: string
  dupLabel: string
  category: string
  paymentMethod: string
  description: string
}

// Mesmo valor + mesmo dia exato (sem tolerância) — gastos recorrentes no
// mesmo lugar e valor (ex: café todo dia no trabalho) não podem virar
// falso positivo só por caírem em dias diferentes.
function findDuplicate(row: NormalizedRow, existing: Transaction[]): string {
  for (const tx of existing) {
    if (Math.abs(tx.amount - row.amount) > 0.01) continue
    const txDateRaw = tx.payment_date || tx.created_at
    if (!txDateRaw) continue
    const txDate = txDateRaw.slice(0, 10)
    if (txDate !== row.date) continue
    return `"${tx.description}" (${formatCurrency(tx.amount)} em ${formatDate(txDate)})`
  }
  return ''
}

export function Import() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [doneCount, setDoneCount] = useState<number | null>(null)
  const [cardId, setCardId] = useState<number | null>(null)
  const cardsQ = useQuery({ queryKey: ['cardsBasic'], queryFn: fetchCardsBasic })
  const needsCard = candidates.some((c) => c.isCreditCardCharge)

  const patch = (i: number, changes: Partial<Candidate>) =>
    setCandidates((prev) => prev.map((p, pi) => (pi === i ? { ...p, ...changes } : p)))

  const loadCandidates = async (rows: NormalizedRow[]) => {
    const cutoffDay = await fetchImportCutoffDay()
    const months = await fetchMonths()
    const byName = new Map(months.map((m) => [m.name, m]))
    const needed = Array.from(
      new Set(
        rows.map((r) => {
          const { year, month } = billingMonth(
            Number(r.date.slice(0, 4)),
            Number(r.date.slice(5, 7)),
            Number(r.date.slice(8, 10)),
            cutoffDay,
          )
          return `${year}-${String(month).padStart(2, '0')}`
        }),
      ),
    )
    let createdAny = false
    for (const key of needed) {
      const [y, m] = key.split('-').map(Number)
      const name = `${MONTHS_PT[m - 1]} ${y}`
      if (!byName.has(name)) {
        const id = await ensureMonth(name, y, m)
        byName.set(name, { id, name, year: y, month: m, opening_balance: null })
        createdAny = true
      }
    }
    if (createdAny) await qc.invalidateQueries({ queryKey: ['months'] })

    const txCache = new Map<number, Transaction[]>()
    const cands: Candidate[] = []
    for (const r of rows) {
      const { year: y, month: m } = billingMonth(
        Number(r.date.slice(0, 4)),
        Number(r.date.slice(5, 7)),
        Number(r.date.slice(8, 10)),
        cutoffDay,
      )
      const name = `${MONTHS_PT[m - 1]} ${y}`
      const month = byName.get(name)
      const monthId = month ? month.id : null
      let dupLabel = ''
      if (monthId != null) {
        if (!txCache.has(monthId)) txCache.set(monthId, await fetchTransactions(monthId))
        dupLabel = findDuplicate(r, txCache.get(monthId)!)
      }
      cands.push({
        ...r,
        // Aporte/resgate também vem marcado por padrão — a importação só lê
        // entradas/saídas/saldo, nunca mexe na aba Investimentos por conta
        // própria, então não há risco de contar em dobro.
        include: !dupLabel,
        monthId,
        monthName: name,
        dupLabel,
        category: r.direction === 'entrada' ? 'Receita' : r.suggestedCategory,
        paymentMethod: r.suggestedPaymentMethod,
        description: r.description,
      })
    }
    // Mais recente primeiro.
    cands.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    setCandidates(cands)
    if (cands.some((c) => c.isCreditCardCharge) && cardId == null) {
      const cards = cardsQ.data ?? (await fetchCardsBasic())
      if (cards.length > 0) setCardId(cards[0].id)
    }
  }

  const onFile = async (file: File) => {
    setStatus('')
    setDoneCount(null)
    setFileName(file.name)
    setCandidates([])
    setCardId(null)
    setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      const parser = detectParser(buf, file.name)
      if (!parser) {
        setStatus('Formato não reconhecido. Verifique se é um extrato do Banco Inter (.ofx, .csv ou .pdf).')
        return
      }
      const rows = await parser.parse(buf)
      if (rows.length === 0) {
        setStatus('Nenhum lançamento encontrado nesse arquivo.')
        return
      }
      await loadCandidates(rows)
    } catch (e) {
      setStatus('Erro ao ler o arquivo: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    const selected = candidates.filter((c) => c.include && c.monthId != null)
    if (selected.length === 0) return
    if (needsCard && cardId == null) {
      setStatus('Escolha o cartão de crédito da fatura antes de confirmar.')
      return
    }
    setImporting(true)
    setStatus('')
    try {
      await importTransactionsBulk(
        selected.map((c) => ({
          month_id: c.monthId!,
          type: c.direction === 'entrada' ? 'entrada_variavel' : 'saida_variavel',
          description: c.description.trim() || 'Lançamento importado',
          amount: c.amount,
          category: c.category || 'Outros',
          payment_method: c.isCreditCardCharge ? 'credito' : c.paymentMethod,
          payment_date: c.date,
          card_id: c.isCreditCardCharge ? cardId : null,
        })),
      )
      setDoneCount(selected.length)
      setCandidates([])
      setFileName('')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['transactions'] }),
        qc.invalidateQueries({ queryKey: ['summary'] }),
        qc.invalidateQueries({ queryKey: ['cats'] }),
        qc.invalidateQueries({ queryKey: ['expensesByMethod'] }),
      ])
    } catch (e) {
      setStatus('Erro ao importar: ' + (e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const nSelected = candidates.filter((c) => c.include).length

  return (
    <div className="p-4 pb-8">
      <h1 className="mb-1 text-2xl font-bold">Importar extrato</h1>
      <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
        Banco Inter — extrato da conta corrente (.ofx, .csv, .pdf) ou fatura do cartão de crédito (.csv)
      </p>

      <div className="mb-4 rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <label>
          <span
            className="mb-2 block cursor-pointer rounded-lg py-2.5 text-center text-sm font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            📄 Escolher arquivo
          </span>
          <input
            type="file"
            accept=".ofx,.csv,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
          />
        </label>
        {fileName && (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {fileName}
          </p>
        )}
        {busy && (
          <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
            Lendo arquivo…
          </p>
        )}
        {needsCard && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-bold" style={{ color: 'var(--text)' }}>
              Cartão de crédito da fatura
            </label>
            <select
              value={cardId ?? ''}
              onChange={(e) => setCardId(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            >
              {(cardsQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        {status && (
          <p className="mt-2 text-sm" style={{ color: 'var(--red)' }}>
            {status}
          </p>
        )}
        {doneCount != null && (
          <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--primary)' }}>
            ✓ {doneCount} lançamento(s) importado(s) com sucesso.
          </p>
        )}
      </div>

      {candidates.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold">
              {nSelected} de {candidates.length} selecionado(s)
            </span>
            <button
              onClick={confirm}
              disabled={nSelected === 0 || importing || (needsCard && cardId == null)}
              className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: 'var(--primary)' }}
            >
              {importing ? 'Importando…' : `Confirmar importação (${nSelected})`}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {candidates.map((c, i) => (
              <div
                key={i}
                className="rounded-xl border p-3"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={c.include}
                    onChange={(e) => patch(i, { include: e.target.checked })}
                    className="mt-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <input
                      value={c.description}
                      onChange={(e) => patch(i, { description: e.target.value })}
                      className="w-full bg-transparent text-sm font-semibold outline-none"
                      style={{ color: 'var(--text)' }}
                    />
                    <p
                      className="mt-0.5 text-[11px]"
                      style={{ color: c.dupLabel || c.isInvestmentLike ? 'var(--accent)' : 'var(--muted)' }}
                    >
                      {formatDate(c.date)} · {c.monthName} · {c.direction === 'entrada' ? '+' : '−'}{' '}
                      {formatCurrency(c.amount)}
                      {c.dupLabel && ` · ⚠ possível duplicata: ${c.dupLabel}`}
                      {c.isInvestmentLike && ' · 💡 parece ser investimento (aporte/resgate)'}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2 pl-6">
                  <select
                    value={c.category}
                    onChange={(e) => patch(i, { category: e.target.value })}
                    className="flex-1 rounded border px-2 py-1.5 text-xs outline-none"
                    style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
                  >
                    {[...new Set([...CATEGORIES, 'Investimentos', 'Receita'])].map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {c.isCreditCardCharge ? (
                    <span
                      className="flex flex-1 items-center justify-center rounded border px-2 py-1.5 text-xs font-semibold"
                      style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                    >
                      💳 Crédito
                    </span>
                  ) : (
                    <select
                      value={c.paymentMethod}
                      onChange={(e) => patch(i, { paymentMethod: e.target.value })}
                      className="flex-1 rounded border px-2 py-1.5 text-xs outline-none"
                      style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
                    >
                      {Object.entries(PAYMENT_METHODS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
