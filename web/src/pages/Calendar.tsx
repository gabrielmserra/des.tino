import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCalendarEvents,
  markCalendarEventDone,
  addTransaction,
  ensureMonth,
  type CalendarEvent,
} from '../lib/api'
import { formatCurrency, MONTHS_PT } from '../lib/format'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const SOURCE_LABELS: Record<CalendarEvent['source'], string> = {
  fixed_bill: 'Conta fixa',
  debt: 'Dívida',
  goal: 'Meta',
  card_invoice: 'Fatura de cartão',
  card_invoice_open: 'Fatura em aberto',
  card_installment: 'Parcela de cartão',
  expectation: 'Previsto',
  income: 'Entrada prevista',
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function monthBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return {
    startIso: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    endIso: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    daysInMonth: end.getDate(),
    firstWeekday: start.getDay(),
  }
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

function EventRow({ event, onDone }: { event: CalendarEvent; onDone: (e: CalendarEvent) => void }) {
  const color = event.is_income ? 'var(--primary)' : 'var(--red)'
  const canMark = event.ref_table !== 'plan_income_items'
  return (
    <div className="flex items-center justify-between gap-2 border-b py-2.5 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{event.label}</p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {SOURCE_LABELS[event.source] ?? event.source}
          {event.status === 'overdue' && <span style={{ color: 'var(--red)' }}> · vencido</span>}
        </p>
      </div>
      <span className="shrink-0 text-sm font-bold" style={{ color }}>
        {event.is_income ? '+' : '-'}{formatCurrency(Number(event.amount))}
      </span>
      {canMark && (
        <button
          onClick={() => onDone(event)}
          className="shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-bold"
          style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
        >
          Feito
        </button>
      )}
    </div>
  )
}

function AddExpectationForm({ year, month, day, onAdded }: { year: number; month: number; day: number; onAdded: () => void }) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'saida_variavel' | 'entrada_variavel'>('saida_variavel')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const value = Number(amount.replace(',', '.'))
    if (!description.trim() || !value || value <= 0) {
      setError('Preencha a descrição e um valor positivo.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const monthId = await ensureMonth(`${MONTHS_PT[month - 1]} ${year}`, year, month)
      await addTransaction(monthId, {
        type,
        description: description.trim(),
        amount: value,
        category: 'Outros',
        is_expectation: true,
        payment_date: `${year}-${pad(month)}-${pad(day)}`,
      })
      setDescription('')
      setAmount('')
      onAdded()
    } catch (e) {
      setError('Erro ao adicionar: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
      <p className="mb-2 text-xs font-bold" style={{ color: 'var(--muted)' }}>+ ADICIONAR PREVISTO NESTE DIA</p>
      <div className="mb-2 flex gap-2">
        <button
          onClick={() => setType('saida_variavel')}
          className="flex-1 rounded-lg border py-1.5 text-xs font-bold"
          style={type === 'saida_variavel' ? { background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' } : { borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          Saída
        </button>
        <button
          onClick={() => setType('entrada_variavel')}
          className="flex-1 rounded-lg border py-1.5 text-xs font-bold"
          style={type === 'entrada_variavel' ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' } : { borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          Entrada
        </button>
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição"
        className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Valor (R$)"
        inputMode="decimal"
        className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
      />
      {error && <p className="mb-2 text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-lg py-2 text-sm font-bold text-white disabled:opacity-60"
        style={{ background: 'var(--primary)' }}
      >
        {busy ? 'Adicionando…' : 'Adicionar'}
      </button>
    </div>
  )
}

function DayDialog({
  year, month, day, events, onClose, onChanged,
}: {
  year: number; month: number; day: number
  events: CalendarEvent[]
  onClose: () => void
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const markDone = async (event: CalendarEvent) => {
    setBusyId(event.ref_id)
    setError('')
    try {
      await markCalendarEventDone(event.ref_table, event.ref_id, event.event_date)
      onChanged()
    } catch (e) {
      setError('Erro ao confirmar: ' + (e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold">{day} de {MONTHS_PT[month - 1]}</h2>
      {events.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Nada previsto pra este dia.</p>
      ) : (
        <div className="mt-3">
          {events.map((e) => (
            <EventRow key={`${e.ref_table}-${e.ref_id}`} event={e} onDone={markDone} />
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-center text-xs" style={{ color: 'var(--red)' }}>{error}</p>}
      {busyId !== null && <p className="mt-1 text-center text-xs" style={{ color: 'var(--muted)' }}>Confirmando…</p>}
      <AddExpectationForm year={year} month={month} day={day} onAdded={onChanged} />
      <button
        onClick={onClose}
        className="mt-3 w-full rounded-lg border py-2.5 text-sm font-semibold"
        style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
      >
        Fechar
      </button>
    </Sheet>
  )
}

export function Calendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const qc = useQueryClient()

  const { startIso, endIso, daysInMonth, firstWeekday } = useMemo(() => monthBounds(year, month), [year, month])

  const { data, isLoading } = useQuery({
    queryKey: ['calendarEvents', startIso, endIso],
    queryFn: () => fetchCalendarEvents(startIso, endIso),
  })

  const events = data ?? []
  const byDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>()
    for (const e of events) {
      const d = Number(e.event_date.slice(8, 10))
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(e)
    }
    return map
  }, [events])

  const goPrev = () => (month === 1 ? (setYear(year - 1), setMonth(12)) : setMonth(month - 1))
  const goNext = () => (month === 12 ? (setYear(year + 1), setMonth(1)) : setMonth(month + 1))

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const isToday = (d: number) => year === today.getFullYear() && month === today.getMonth() + 1 && d === today.getDate()

  const refresh = () => qc.invalidateQueries({ queryKey: ['calendarEvents'] })

  return (
    <div className="p-4 pb-8">
      <h1 className="text-2xl font-bold">Calendário</h1>
      <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
        Tudo que já tem data neste app, num lugar só — contas fixas, dívidas, metas, fatura de cartão e previstos.
      </p>

      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={goPrev}
          className="rounded-lg border px-3 py-1.5 text-sm font-bold"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          ‹
        </button>
        <span className="font-bold">{MONTHS_PT[month - 1]} {year}</span>
        <button
          onClick={goNext}
          className="rounded-lg border px-3 py-1.5 text-sm font-bold"
          style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
        >
          ›
        </button>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>Carregando…</p>
      ) : (
        <>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-bold" style={{ color: 'var(--muted)' }}>
            {WEEKDAYS.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={`blank-${i}`} />
              const dayEvents = byDay.get(d) ?? []
              const hasOverdue = dayEvents.some((e) => e.status === 'overdue')
              const income = dayEvents.filter((e) => e.is_income).reduce((s, e) => s + Number(e.amount), 0)
              const expense = dayEvents.filter((e) => !e.is_income).reduce((s, e) => s + Number(e.amount), 0)
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border p-1"
                  style={{
                    borderColor: isToday(d) ? 'var(--primary)' : 'var(--border)',
                    borderWidth: isToday(d) ? 2 : 1,
                    background: hasOverdue ? 'rgba(224,82,82,0.12)' : 'var(--card)',
                  }}
                >
                  <span className="text-xs font-bold">{d}</span>
                  {expense > 0 && (
                    <span className="text-[9px] font-bold leading-none" style={{ color: 'var(--red)' }}>
                      -{formatCurrency(expense)}
                    </span>
                  )}
                  {income > 0 && (
                    <span className="text-[9px] font-bold leading-none" style={{ color: 'var(--primary)' }}>
                      +{formatCurrency(income)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {selectedDay !== null && (
        <DayDialog
          year={year}
          month={month}
          day={selectedDay}
          events={byDay.get(selectedDay) ?? []}
          onClose={() => setSelectedDay(null)}
          onChanged={refresh}
        />
      )}
    </div>
  )
}
