import { useState } from 'react'
import { ASSET_CLASSES, ASSET_CLASS_LABELS, type AssetClass } from '../lib/assetClasses'
import type { ImportedPortfolio } from '../lib/portfolioIo'
import { formatCurrency } from '../lib/format'
import type { MockPortfolioItemInput } from '../lib/types'

function parseAmount(raw: string): number {
  const s = raw.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.max(0, n)
}

const inputStyle = { background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }

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

// ── Escolha de como começar ────────────────────────────────────────
export function CreateMenuDialog({
  hasInvestments,
  hasProfile,
  onClose,
  onScratch,
  onCopyReal,
  onCopyTarget,
}: {
  hasInvestments: boolean
  hasProfile: boolean
  onClose: () => void
  onScratch: () => void
  onCopyReal: () => void
  onCopyTarget: () => void
}) {
  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-4 text-center text-lg font-bold">Como quer começar?</h2>
      <div className="flex flex-col gap-2">
        <button onClick={onScratch} className="rounded-lg py-3 font-bold text-white" style={{ background: 'var(--violet)' }}>
          Do zero
        </button>
        <button
          onClick={onCopyReal}
          disabled={!hasInvestments}
          className="rounded-lg border py-3 font-semibold disabled:opacity-40"
          style={{ borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          Copiar carteira real
        </button>
        <button
          onClick={onCopyTarget}
          disabled={!hasProfile}
          className="rounded-lg border py-3 font-semibold disabled:opacity-40"
          style={{ borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          Partir da meta do perfil
        </button>
      </div>
    </Sheet>
  )
}

// ── Renomear ─────────────────────────────────────────────────────────
export function RenamePortfolioDialog({
  name,
  onClose,
  onConfirm,
}: {
  name: string
  onClose: () => void
  onConfirm: (name: string) => void
}) {
  const [n, setN] = useState(name)
  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-4 text-center text-lg font-bold">Renomear carteira</h2>
      <input
        value={n}
        onChange={(e) => setN(e.target.value)}
        className="w-full rounded-lg border px-3 py-3 text-sm outline-none"
        style={inputStyle}
      />
      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-lg border py-3 font-semibold" style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}>
          Cancelar
        </button>
        <button
          onClick={() => n.trim() && onConfirm(n.trim())}
          className="flex-1 rounded-lg py-3 font-bold text-white"
          style={{ background: 'var(--violet)' }}
        >
          Salvar
        </button>
      </div>
    </Sheet>
  )
}

// ── Criar carteira (do zero / copiar real / partir da meta) ──────────
type TargetMap = Partial<Record<string, number>> // assetClass -> target_pct

export function CreatePortfolioDialog({
  mode,
  prefillItems,
  targets,
  onClose,
  onConfirm,
}: {
  mode: 'scratch' | 'copy_real' | 'copy_target'
  prefillItems: MockPortfolioItemInput[]
  targets: TargetMap
  onClose: () => void
  onConfirm: (name: string, items: MockPortfolioItemInput[]) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [totalHypothetical, setTotalHypothetical] = useState('')
  const initialRows: { assetClass: AssetClass; value: string }[] =
    mode === 'copy_target'
      ? ASSET_CLASSES.map((c) => ({ assetClass: c, value: '' }))
      : mode === 'copy_real' && prefillItems.length > 0
        ? prefillItems.map((it) => ({ assetClass: it.asset_class as AssetClass, value: String(it.value) }))
        : [{ assetClass: ASSET_CLASSES[0], value: '' }]
  const [rows, setRows] = useState(initialRows)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setRow = (i: number, patch: Partial<{ assetClass: AssetClass; value: string }>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i))
  const addRow = () => setRows((prev) => [...prev, { assetClass: ASSET_CLASSES[0], value: '' }])

  const applyHypotheticalTotal = (raw: string) => {
    setTotalHypothetical(raw)
    const total = parseAmount(raw)
    setRows((prev) =>
      prev.map((r) => ({ ...r, value: total > 0 ? (total * (targets[r.assetClass] ?? 0)).toFixed(2) : '' })),
    )
  }

  const save = async () => {
    setError('')
    if (!name.trim()) return setError('Informe um nome.')
    const items: MockPortfolioItemInput[] = rows
      .map((r) => ({ asset_class: r.assetClass, label: null, value: parseAmount(r.value) }))
      .filter((it) => it.value > 0)
    if (items.length === 0) return setError('Adicione pelo menos um item com valor.')
    setSaving(true)
    try {
      await onConfirm(name.trim(), items)
    } catch (e) {
      setError('Erro: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-4 text-center text-lg font-bold">Nova carteira fictícia</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da carteira"
        className="mb-2 w-full rounded-lg border px-3 py-3 text-sm outline-none"
        style={inputStyle}
      />
      {mode === 'copy_target' && (
        <>
          <input
            value={totalHypothetical}
            onChange={(e) => applyHypotheticalTotal(e.target.value)}
            inputMode="decimal"
            placeholder="Valor total hipotético (R$)"
            className="mb-1 w-full rounded-lg border px-3 py-3 text-sm outline-none"
            style={inputStyle}
          />
          <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
            Digite um valor total acima — os campos de cada classe abaixo são preenchidos
            sozinhos de acordo com a meta do seu perfil. Pode ajustar cada um na mão depois.
          </p>
        </>
      )}
      {mode === 'scratch' && (
        <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
          Monte sua carteira hipotética: pra cada item, escolha a classe de ativo e digite o
          valor em reais. Use "+ Adicionar item" pra incluir quantos quiser.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={r.assetClass}
              onChange={(e) => setRow(i, { assetClass: e.target.value as AssetClass })}
              className="flex-1 rounded-lg border px-2 py-2.5 text-sm outline-none"
              style={inputStyle}
            >
              {ASSET_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {ASSET_CLASS_LABELS[c]}
                </option>
              ))}
            </select>
            <input
              value={r.value}
              onChange={(e) => setRow(i, { value: e.target.value })}
              inputMode="decimal"
              placeholder="0,00"
              className="w-24 rounded-lg border px-2 py-2.5 text-right text-sm outline-none"
              style={inputStyle}
            />
            <button onClick={() => removeRow(i)} style={{ color: 'var(--muted)' }}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={addRow} className="mt-2 text-xs font-bold" style={{ color: 'var(--primary)' }}>
        + Adicionar item
      </button>
      {error && (
        <p className="mt-2 text-sm" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-lg border py-3 font-semibold" style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}>
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-lg py-3 font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--violet)' }}
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </Sheet>
  )
}

// ── Escolha de modo ao exportar ───────────────────────────────────────
export function ExportModeDialog({
  onClose,
  onChoose,
}: {
  onClose: () => void
  onChoose: (mode: 'absolute' | 'percentage') => void
}) {
  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold">Exportar carteira</h2>
      <p className="mb-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
        Com valores reais (R$) ou só os percentuais por classe, pra compartilhar sem revelar o
        patrimônio.
      </p>
      <div className="flex flex-col gap-2">
        <button onClick={() => onChoose('absolute')} className="rounded-lg py-3 font-bold text-white" style={{ background: 'var(--violet)' }}>
          Com valores em R$
        </button>
        <button
          onClick={() => onChoose('percentage')}
          className="rounded-lg border py-3 font-semibold"
          style={{ borderColor: 'var(--border-l)', color: 'var(--text)' }}
        >
          Só percentuais
        </button>
      </div>
    </Sheet>
  )
}

// ── Prévia de importação (nada é gravado até confirmar) ───────────────
export function ImportPreviewDialog({
  parsed,
  onClose,
  onConfirm,
}: {
  parsed: ImportedPortfolio
  onClose: () => void
  onConfirm: (name: string, items: MockPortfolioItemInput[]) => Promise<void>
}) {
  const [name, setName] = useState(parsed.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const confirm = async () => {
    if (!name.trim()) return setError('Informe um nome.')
    setSaving(true)
    setError('')
    try {
      await onConfirm(
        name.trim(),
        parsed.items.map((it) => ({ asset_class: it.asset_class, label: it.label ?? null, value: it.value })),
      )
    } catch (e) {
      setError('Erro: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold">Importar carteira</h2>
      <p className="mb-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
        Isso cria uma carteira fictícia nova -- não altera nenhum dado real.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da carteira"
        className="mb-3 w-full rounded-lg border px-3 py-3 text-sm outline-none"
        style={inputStyle}
      />
      <div className="flex flex-col gap-1.5">
        {parsed.items.map((it, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--card2)' }}>
            <span>{ASSET_CLASS_LABELS[it.asset_class as AssetClass] ?? it.asset_class}</span>
            <span className="font-semibold">
              {parsed.mode === 'absolute' ? formatCurrency(it.value) : `${(it.value * 100).toFixed(0)}%`}
            </span>
          </div>
        ))}
      </div>
      {error && (
        <p className="mt-3 text-center text-sm" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-lg border py-3 font-semibold" style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}>
          Cancelar
        </button>
        <button
          onClick={confirm}
          disabled={saving}
          className="flex-1 rounded-lg py-3 font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--violet)' }}
        >
          {saving ? 'Importando…' : 'Confirmar importação'}
        </button>
      </div>
    </Sheet>
  )
}

// ── Confirmar exclusão ────────────────────────────────────────────────
export function ConfirmDeletePortfolioDialog({
  name,
  onClose,
  onConfirm,
}: {
  name: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Sheet onClose={onClose}>
      <h2 className="mb-1 text-center text-lg font-bold">Excluir carteira fictícia?</h2>
      <p className="mb-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
        "{name}" e todos os seus itens serão apagados.
      </p>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-lg border py-3 font-semibold" style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}>
          Cancelar
        </button>
        <button onClick={onConfirm} className="flex-1 rounded-lg py-3 font-bold text-white" style={{ background: 'var(--red)' }}>
          Excluir
        </button>
      </div>
    </Sheet>
  )
}
