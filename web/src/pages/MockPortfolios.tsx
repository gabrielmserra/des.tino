import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchMockPortfolios,
  fetchMockPortfolioItems,
  createMockPortfolioBulk,
  renameMockPortfolio,
  deleteMockPortfolio,
  fetchInvestments,
  fetchAllInvestmentMovements,
  fetchInvestorProfileHistory,
  fetchTargetAllocations,
} from '../lib/api'
import { ASSET_CLASSES, ASSET_CLASS_LABELS, NAO_CLASSIFICADO } from '../lib/assetClasses'
import { aggregateByClass, aggregateMockByClass, compareAllocation, diagnose, type DiagnosisTone } from '../lib/allocationStrategy'
import { Disclaimer } from '../components/Disclaimer'
import {
  CreateMenuDialog,
  RenamePortfolioDialog,
  CreatePortfolioDialog,
  ConfirmDeletePortfolioDialog,
  ExportModeDialog,
  ImportPreviewDialog,
} from '../components/MockPortfolioDialogs'
import { buildExportPayload, downloadPortfolioJson, validateImportPayload, type PortfolioMode, type ImportedPortfolio } from '../lib/portfolioIo'
import type { MockPortfolio, MockPortfolioItemInput } from '../lib/types'

const SOURCE_LABEL: Record<string, string> = {
  scratch: 'Do zero',
  copy_real: 'Cópia da carteira real',
  copy_target: 'Cópia da meta do perfil',
  import: 'Importada',
}

const TONE_COLOR: Record<DiagnosisTone, { color: string; dim: string }> = {
  red: { color: 'var(--red)', dim: 'rgba(224,82,82,0.12)' },
  gold: { color: 'var(--accent)', dim: 'rgba(245,166,35,0.12)' },
  green: { color: 'var(--primary)', dim: 'rgba(46,175,125,0.12)' },
  blue: { color: 'var(--violet)', dim: 'rgba(155,114,245,0.12)' },
}

const CLASS_LABELS_WITH_UNCLASSIFIED: Record<string, string> = {
  ...ASSET_CLASS_LABELS,
  [NAO_CLASSIFICADO]: 'Não classificado',
}

type CreateMode = 'scratch' | 'copy_real' | 'copy_target' | null

export function MockPortfolios() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>(null)
  const [renaming, setRenaming] = useState<MockPortfolio | null>(null)
  const [deleting, setDeleting] = useState<MockPortfolio | null>(null)
  const [exporting, setExporting] = useState(false)
  const [importParsed, setImportParsed] = useState<ImportedPortfolio | null>(null)
  const [importError, setImportError] = useState('')

  const portfoliosQ = useQuery({ queryKey: ['mockPortfolios'], queryFn: fetchMockPortfolios })
  const invQ = useQuery({ queryKey: ['investments'], queryFn: () => fetchInvestments() })
  const movQ = useQuery({ queryKey: ['investmentMovements'], queryFn: fetchAllInvestmentMovements })
  const historyQ = useQuery({ queryKey: ['investorProfileHistory'], queryFn: fetchInvestorProfileHistory })
  const profile = historyQ.data?.[0]?.profile ?? null
  const targetsQ = useQuery({
    queryKey: ['targetAllocations', profile],
    queryFn: () => fetchTargetAllocations(profile!),
    enabled: profile != null,
  })

  const portfolios = portfoliosQ.data ?? []
  const investments = invQ.data ?? []
  const movements = movQ.data ?? []
  const targets = targetsQ.data ?? []

  const itemsQ = useQuery({
    queryKey: ['mockPortfolioItems', selectedId],
    queryFn: () => fetchMockPortfolioItems(selectedId!),
    enabled: selectedId != null,
  })

  const invalidateAll = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['mockPortfolios'] }),
      qc.invalidateQueries({ queryKey: ['mockPortfolioItems'] }),
    ])

  const realByClass = aggregateByClass(investments, movements)
  const targetByClass = Object.fromEntries(targets.map((t) => [t.asset_class, t.target_pct]))

  // ── Tela de comparação ───────────────────────────────────────────
  const selected = portfolios.find((p) => p.id === selectedId)
  if (selectedId != null && selected) {
    const items = itemsQ.data ?? []
    const mockByClass = aggregateMockByClass(items)
    const targetFull = Object.fromEntries(
      targets.map((t) => [t.asset_class, { target_pct: t.target_pct, tolerance_pct: t.tolerance_pct }]),
    )

    const realTotal = Object.values(realByClass).reduce((a, b) => a + b, 0)
    const mockTotal = Object.values(mockByClass).reduce((a, b) => a + b, 0)
    const classesSeen = new Set([...Object.keys(realByClass), ...Object.keys(mockByClass), ...Object.keys(targetByClass)])
    const ordered: string[] = ASSET_CLASSES.filter((c) => classesSeen.has(c))
    if (classesSeen.has(NAO_CLASSIFICADO)) ordered.push(NAO_CLASSIFICADO)

    const mockComparisons = profile ? compareAllocation(mockByClass, targetFull) : []
    const tips = profile ? diagnose(mockComparisons, [], [], 0) : []

    return (
      <div className="p-4 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setSelectedId(null)}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            ← Voltar
          </button>
          <button
            onClick={() => setExporting(true)}
            disabled={items.length === 0}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            ↓ Exportar
          </button>
        </div>
        <h2 className="mb-4 text-lg font-bold">{selected.name}</h2>

        {ordered.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Nada pra comparar ainda.
          </p>
        ) : (
          <div className="mb-5 flex flex-col gap-2">
            {ordered.map((cls) => {
              const realPct = realTotal > 0 ? ((realByClass[cls] ?? 0) / realTotal) * 100 : 0
              const mockPct = mockTotal > 0 ? ((mockByClass[cls] ?? 0) / mockTotal) * 100 : 0
              const targetPct = targetByClass[cls]
              return (
                <div key={cls} className="rounded-xl border p-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  <p className="mb-1 text-sm font-semibold">{CLASS_LABELS_WITH_UNCLASSIFIED[cls] ?? cls}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    Real {realPct.toFixed(0)}% · Fictícia{' '}
                    <span style={{ color: 'var(--violet)', fontWeight: 700 }}>{mockPct.toFixed(0)}%</span> · Alvo{' '}
                    {targetPct != null ? `${(targetPct * 100).toFixed(0)}%` : '—'}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {profile && (
          <>
            <h3 className="mb-2 text-sm font-bold">Diagnóstico da carteira fictícia (vs. meta {profile})</h3>
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
          </>
        )}

        <Disclaimer />

        {exporting && (
          <ExportModeDialog
            onClose={() => setExporting(false)}
            onChoose={(mode: PortfolioMode) => {
              const payloadItems =
                mode === 'absolute'
                  ? items.map((it) => ({ asset_class: it.asset_class, label: it.label, value: it.value }))
                  : (() => {
                      const total = items.reduce((a, it) => a + it.value, 0)
                      return items.map((it) => ({
                        asset_class: it.asset_class,
                        label: it.label,
                        value: total > 0 ? it.value / total : 0,
                      }))
                    })()
              const payload = buildExportPayload(selected.name, payloadItems, mode)
              downloadPortfolioJson(`${selected.name.replace(/\s+/g, '_').toLowerCase()}.json`, payload)
              setExporting(false)
            }}
          />
        )}
      </div>
    )
  }

  // ── Lista ─────────────────────────────────────────────────────────
  const createAndSave = async (name: string, items: MockPortfolioItemInput[]) => {
    const mode = createMode ?? 'scratch'
    await createMockPortfolioBulk(name, mode, 'absolute', items)
    await invalidateAll()
    setCreateMode(null)
  }

  const onFileSelected = async (file: File) => {
    setImportError('')
    const text = await file.text()
    const result = validateImportPayload(text)
    if (!result.ok) {
      setImportError(result.error)
      return
    }
    setImportParsed(result.data)
  }

  const confirmImport = async (name: string, items: MockPortfolioItemInput[]) => {
    const valueMode = importParsed?.mode === 'percentage' ? 'percentage' : 'absolute'
    await createMockPortfolioBulk(name, 'import', valueMode, items)
    await invalidateAll()
    setImportParsed(null)
  }

  return (
    <div className="p-4 pb-8">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Carteiras Fictícias</h2>
        <div className="flex shrink-0 gap-1.5">
          <label
            className="cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold"
            style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
          >
            ↑ Importar
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) onFileSelected(file)
              }}
            />
          </label>
          <button
            onClick={() => setShowMenu(true)}
            className="rounded-lg px-3 py-2 text-xs font-bold text-white"
            style={{ background: 'var(--violet)' }}
          >
            + Nova carteira
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
        Simule uma carteira sem afetar nada do app de verdade — nenhum saldo, lançamento ou total real é alterado.
      </p>
      {importError && (
        <p className="mb-4 text-sm" style={{ color: 'var(--red)' }}>
          {importError}
        </p>
      )}

      {portfolios.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Nenhuma carteira fictícia ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {portfolios.map((p) => (
            <div key={p.id} className="rounded-xl border p-3" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-bold">{p.name}</span>
              </div>
              <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
                {SOURCE_LABEL[p.source] ?? p.source}
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setSelectedId(p.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                  style={{ background: 'var(--violet)' }}
                >
                  Comparar
                </button>
                <button
                  onClick={() => setRenaming(p)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                  style={{ borderColor: 'var(--border-l)', color: 'var(--muted)' }}
                >
                  ✎
                </button>
                <button
                  onClick={() => setDeleting(p)}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                  style={{ borderColor: 'var(--border-l)', color: 'var(--red)' }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showMenu && (
        <CreateMenuDialog
          hasInvestments={investments.length > 0}
          hasProfile={profile != null}
          onClose={() => setShowMenu(false)}
          onScratch={() => {
            setShowMenu(false)
            setCreateMode('scratch')
          }}
          onCopyReal={() => {
            setShowMenu(false)
            setCreateMode('copy_real')
          }}
          onCopyTarget={() => {
            setShowMenu(false)
            setCreateMode('copy_target')
          }}
        />
      )}

      {createMode && (
        <CreatePortfolioDialog
          mode={createMode}
          prefillItems={Object.entries(realByClass).map(([asset_class, value]) => ({ asset_class, label: null, value }))}
          targets={targetByClass}
          onClose={() => setCreateMode(null)}
          onConfirm={createAndSave}
        />
      )}

      {renaming && (
        <RenamePortfolioDialog
          name={renaming.name}
          onClose={() => setRenaming(null)}
          onConfirm={async (name) => {
            await renameMockPortfolio(renaming.id, name)
            await invalidateAll()
            setRenaming(null)
          }}
        />
      )}

      {deleting && (
        <ConfirmDeletePortfolioDialog
          name={deleting.name}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteMockPortfolio(deleting.id)
            await invalidateAll()
            setDeleting(null)
          }}
        />
      )}

      {importParsed && (
        <ImportPreviewDialog parsed={importParsed} onClose={() => setImportParsed(null)} onConfirm={confirmImport} />
      )}
    </div>
  )
}
