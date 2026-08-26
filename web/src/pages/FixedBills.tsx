import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchFixedBills,
  fetchFixedBillInstances,
  ensureFixedBillInstances,
  createFixedBill,
  updateFixedBill,
  deleteFixedBill,
  updateFixedBillInstanceAmount,
  payFixedBillInstance,
  undoFixedBillPayment,
} from '../lib/api'
import { formatCurrency, MONTHS_PT } from '../lib/format'
import { CATEGORIES, PAYMENT_METHODS } from '../lib/constants'
import type { FixedBill, FixedBillInstance } from '../lib/types'

const today = new Date()
const REAL_YEAR = today.getFullYear()
const REAL_MONTH = today.getMonth() + 1
const REAL_MONTH_NAME = `${MONTHS_PT[today.getMonth()]} ${REAL_YEAR}`

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

const METHOD_KEYS = Object.keys(PAYMENT_METHODS)

export function FixedBills() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editBill, setEditBill] = useState<FixedBill | null>(null)
  const [payTarget, setPayTarget] = useState<{ bill: FixedBill; inst: FixedBillInstance } | null>(null)
  const [undoTarget, setUndoTarget] = useState<FixedBillInstance | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FixedBill | null>(null)

  const ensureQ = useQuery({
    queryKey: ['ensureFixedBillInstances', REAL_YEAR, REAL_MONTH],
    queryFn: () => ensureFixedBillInstances(REAL_YEAR, REAL_MONTH),
  })
  const billsQ = useQuery({ queryKey: ['fixedBills'], queryFn: fetchFixedBills })
  const instQ = useQuery({
    queryKey: ['fixedBillInstances'],
    queryFn: fetchFixedBillInstances,
    enabled: ensureQ.isSuccess,
  })

  const bills = (billsQ.data ?? []).filter((b) => b.active)
  const instances = instQ.data ?? []
  const loading = billsQ.isLoading || instQ.isLoading || ensureQ.isLoading

  async function invalidateAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['fixedBills'] }),
      qc.invalidateQueries({ queryKey: ['fixedBillInstances'] }),
      qc.invalidateQueries({ queryKey: ['pendingFixedBills'] }),
    ])
  }

  return (
    <div className="p-4">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contas Fixas</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg px-3 py-2 text-sm font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          + Nova conta
        </button>
      </div>
      <p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>
        Mês corrente: {REAL_MONTH_NAME}
      </p>

      {loading ? (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Carregando…
        </p>
      ) : bills.length === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhuma conta fixa cadastrada. Cadastre uma em "+ Nova conta".
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {bills.map((bill) => {
            const inst = instances.find(
              (i) => i.bill_id === bill.id && i.due_year === REAL_YEAR && i.due_month === REAL_MONTH,
            )
            const amount = inst ? inst.amount : bill.expected_amount
            const paid = Boolean(inst?.paid_at)
            return (
              <div
                key={bill.id}
                className="rounded-2xl border p-4"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{bill.name}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: 'var(--card2)', color: 'var(--muted)' }}
                      >
                        vence dia {bill.due_day} · {bill.category}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setEditBill(bill)} className="shrink-0 text-sm" style={{ color: 'var(--muted)' }}>
                    Editar
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    {formatCurrency(amount)}
                  </span>
                  {paid ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>
                        ✓ Paga
                      </span>
                      <button
                        onClick={() => inst && setUndoTarget(inst)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                      >
                        Desfazer
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                        Pendente
                      </span>
                      <button
                        onClick={() => inst && setPayTarget({ bill, inst })}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                        style={{ background: 'var(--primary)' }}
                      >
                        Pagar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <FixedBillFormSheet
          onClose={() => setShowForm(false)}
          onSave={async (r) => {
            await createFixedBill(r.name, r.amount, r.dueDay, r.category, r.paymentMethod)
            await ensureFixedBillInstances(REAL_YEAR, REAL_MONTH)
            await invalidateAll()
            setShowForm(false)
          }}
        />
      )}

      {editBill && (
        <FixedBillFormSheet
          bill={editBill}
          onClose={() => setEditBill(null)}
          onSave={async (r) => {
            await updateFixedBill(editBill.id, r.name, r.amount, r.dueDay, r.category, r.paymentMethod, true)
            await invalidateAll()
            setEditBill(null)
          }}
          onDelete={() => {
            setDeleteTarget(editBill)
            setEditBill(null)
          }}
        />
      )}

      {payTarget && (
        <PayBillSheet
          bill={payTarget.bill}
          inst={payTarget.inst}
          onClose={() => setPayTarget(null)}
          onConfirm={async (amount) => {
            if (Math.abs(amount - payTarget.inst.amount) > 0.001) {
              await updateFixedBillInstanceAmount(payTarget.inst.id, amount)
            }
            await payFixedBillInstance(payTarget.inst.id)
            await invalidateAll()
            setPayTarget(null)
          }}
        />
      )}

      {undoTarget && (
        <ConfirmSheet
          title="Desfazer pagamento?"
          message="A conta volta a aparecer como pendente."
          confirmText="Desfazer"
          onClose={() => setUndoTarget(null)}
          onConfirm={async () => {
            await undoFixedBillPayment(undoTarget.id)
            await invalidateAll()
            setUndoTarget(null)
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmSheet
          title="Excluir conta fixa?"
          message={`"${deleteTarget.name}" será excluída de vez (lançamentos já pagos não são apagados).`}
          confirmText="Excluir"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteFixedBill(deleteTarget.id)
            await invalidateAll()
            setDeleteTarget(null)
          }}
        />
      )}
    </div>
  )
}

// ── Sheets ───────────────────────────────────────────────────────────

function SheetBase({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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
        {children}
      </div>
    </div>
  )
}

function ConfirmSheet({
  title, message, confirmText, onClose, onConfirm,
}: { title: string; message: string; confirmText: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <SheetBase onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold">{title}</h2>
      <p className="mb-4 text-center text-sm" style={{ color: 'var(--muted)' }}>{message}</p>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-lg border py-3 font-semibold"
                style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}>
          Cancelar
        </button>
        <button onClick={onConfirm} className="flex-1 rounded-lg py-3 font-bold text-white"
                style={{ background: 'var(--red)' }}>
          {confirmText}
        </button>
      </div>
    </SheetBase>
  )
}

type FormResult = { name: string; amount: number; dueDay: number; category: string; paymentMethod: string | null }

function FixedBillFormSheet({
  bill, onClose, onSave, onDelete,
}: { bill?: FixedBill; onClose: () => void; onSave: (r: FormResult) => Promise<void>; onDelete?: () => void }) {
  const [name, setName] = useState(bill?.name ?? '')
  const [amount, setAmount] = useState(bill ? String(bill.expected_amount).replace('.', ',') : '')
  const [dueDay, setDueDay] = useState(bill?.due_day ?? 1)
  const [category, setCategory] = useState(bill?.category ?? 'Moradia')
  const [method, setMethod] = useState(bill?.payment_method ?? METHOD_KEYS[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!name.trim()) return setError('Preencha o nome.')
    const amt = parseAmount(amount)
    if (amt <= 0) return setError('Informe um valor esperado positivo.')
    setBusy(true)
    setError('')
    try {
      await onSave({ name: name.trim(), amount: amt, dueDay, category, paymentMethod: method })
    } catch (e) {
      setError('Erro ao salvar: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetBase onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">{bill ? 'Editar conta fixa' : 'Nova conta fixa'}</h2>
        <button onClick={onClose} style={{ color: 'var(--muted)' }} className="text-2xl leading-none">×</button>
      </div>

      <input
        value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Nome (ex: Internet, Luz, Aluguel…)"
        className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
        style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
      />
      <div className="mb-3 flex gap-2">
        <input
          value={amount} onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal" placeholder="Valor esperado (R$)"
          className="flex-1 rounded-lg border px-3 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        />
        <select
          value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))}
          className="w-32 rounded-lg border px-2 py-3 text-base outline-none"
          style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>dia {d}</option>
          ))}
        </select>
      </div>
      <select
        value={category} onChange={(e) => setCategory(e.target.value)}
        className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
        style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
      >
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select
        value={method} onChange={(e) => setMethod(e.target.value)}
        className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
        style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
      >
        {METHOD_KEYS.map((k) => <option key={k} value={k}>{PAYMENT_METHODS[k]}</option>)}
      </select>

      {error && <p className="mb-3 text-sm" style={{ color: 'var(--red)' }}>{error}</p>}

      <button
        onClick={submit} disabled={busy}
        className="w-full rounded-lg py-3 font-bold text-white disabled:opacity-60"
        style={{ background: 'var(--primary)' }}
      >
        {busy ? 'Salvando…' : 'Salvar'}
      </button>

      {onDelete && (
        <button
          onClick={onDelete}
          className="mt-2 w-full rounded-lg border py-3 font-semibold"
          style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
        >
          Excluir conta fixa
        </button>
      )}
    </SheetBase>
  )
}

function PayBillSheet({
  bill, inst, onClose, onConfirm,
}: { bill: FixedBill; inst: FixedBillInstance; onClose: () => void; onConfirm: (amount: number) => Promise<void> }) {
  const [amount, setAmount] = useState(String(inst.amount).replace('.', ','))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const amt = parseAmount(amount)
    if (amt <= 0) return setError('Informe um valor positivo.')
    setBusy(true)
    setError('')
    try {
      await onConfirm(amt)
    } catch (e) {
      setError('Erro ao pagar: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetBase onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold" style={{ color: 'var(--primary)' }}>
        Confirmar pagamento
      </h2>
      <p className="mb-1 text-center text-sm">{bill.name}</p>
      <p className="mb-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
        Só marca a conta como paga — não lança despesa nem mexe no saldo.
      </p>

      <input
        value={amount} onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal" placeholder="Valor (R$)"
        className="mb-3 w-full rounded-lg border px-3 py-3 text-base outline-none"
        style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
      />

      {error && <p className="mb-3 text-sm" style={{ color: 'var(--red)' }}>{error}</p>}

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-lg border py-3 font-semibold"
                style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}>
          Cancelar
        </button>
        <button onClick={submit} disabled={busy} className="flex-1 rounded-lg py-3 font-bold text-white disabled:opacity-60"
                style={{ background: 'var(--primary)' }}>
          {busy ? 'Confirmando…' : 'Confirmar'}
        </button>
      </div>
    </SheetBase>
  )
}
