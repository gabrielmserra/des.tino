import { useEffect, useMemo, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { fetchImportCutoffDay, saveImportCutoffDay } from '../lib/api'
import { useMonths } from '../lib/month'

const DESKTOP_DOWNLOAD_URL = 'https://github.com/gabrielmserra/des.tino/releases/latest/download/destino.exe'

// O .exe não roda em Android/iOS — esconde o botão nesses casos (o site é
// sempre mobile-first, então não dá pra usar a largura da tela pra decidir).
function isMobileDevice(): boolean {
  const uaData = (navigator as { userAgentData?: { mobile?: boolean } }).userAgentData
  if (uaData?.mobile != null) return uaData.mobile
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function Settings() {
  const [day, setDay] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [isMobile] = useState(isMobileDevice)
  const { months } = useMonths()

  const monthsAsc = useMemo(
    () => [...months].sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month)),
    [months],
  )
  const [fromId, setFromId] = useState<number | null>(null)
  const [toId, setToId] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [reportStatus, setReportStatus] = useState('')

  useEffect(() => {
    if (monthsAsc.length === 0 || fromId != null) return
    const defaultFrom = monthsAsc[Math.max(0, monthsAsc.length - 6)]
    const defaultTo = monthsAsc[monthsAsc.length - 1]
    setFromId(defaultFrom.id)
    setToId(defaultTo.id)
  }, [monthsAsc, fromId])

  useEffect(() => {
    fetchImportCutoffDay()
      .then(setDay)
      .finally(() => setLoading(false))
  }, [])

  const handleDownloadReport = async () => {
    if (fromId == null || toId == null || generating) return
    let i0 = monthsAsc.findIndex((m) => m.id === fromId)
    let i1 = monthsAsc.findIndex((m) => m.id === toId)
    if (i0 > i1) [i0, i1] = [i1, i0]
    const selected = monthsAsc.slice(i0, i1 + 1)

    setGenerating(true)
    setReportStatus('')
    try {
      // Carregado sob demanda: jsPDF + autotable só baixa quem gera relatório.
      const { generateAccountReportPdf } = await import('../lib/reportPdf')
      await generateAccountReportPdf(selected)
    } catch {
      setReportStatus('Erro ao gerar relatório')
    } finally {
      setGenerating(false)
    }
  }

  const save = async (value: number) => {
    setDay(value)
    setSaving(true)
    setStatus('')
    try {
      await saveImportCutoffDay(value)
      setStatus('✓ Salvo')
    } catch {
      setStatus('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Configurações</h1>

      <div className="rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <p className="font-semibold">Dia de corte da importação de extrato</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          Lançamentos a partir desse dia do mês contam pro mês seguinte — use o dia em que você
          recebe o salário. "1" = sem deslocamento (mês calendário normal). Vale pro desktop também.
        </p>

        {loading ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
            Carregando…
          </p>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <select
              value={day}
              disabled={saving}
              onChange={(e) => save(Number(e.target.value))}
              className="rounded-lg border px-3 py-2 text-sm font-semibold outline-none"
              style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Dia {d}
                </option>
              ))}
            </select>
            {status && (
              <span className="text-xs font-semibold" style={{ color: status.startsWith('✓') ? 'var(--primary)' : '#E05252' }}>
                {status}
              </span>
            )}
          </div>
        )}
      </div>

      <div
        className="mt-4 rounded-2xl border p-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <p className="font-semibold">Relatório Financeiro Completo</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          PDF com resumo, evolução de saldo, gastos por categoria e forma de pagamento e todos os
          lançamentos do período escolhido.
        </p>

        {monthsAsc.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
            Nenhum mês cadastrado ainda.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span style={{ color: 'var(--muted)' }}>De</span>
                <select
                  value={fromId ?? ''}
                  onChange={(e) => setFromId(Number(e.target.value))}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold outline-none"
                  style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
                >
                  {monthsAsc.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span style={{ color: 'var(--muted)' }}>Até</span>
                <select
                  value={toId ?? ''}
                  onChange={(e) => setToId(Number(e.target.value))}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold outline-none"
                  style={{ background: 'var(--card2)', borderColor: 'var(--border-l)', color: 'var(--text)' }}
                >
                  {monthsAsc.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <button
              onClick={handleDownloadReport}
              disabled={generating}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              <FileText size={16} strokeWidth={2} />
              {generating ? 'Gerando…' : 'Baixar Relatório (PDF)'}
            </button>
            {reportStatus && (
              <p className="mt-2 text-xs font-semibold" style={{ color: '#E05252' }}>{reportStatus}</p>
            )}
          </>
        )}
      </div>

      {!isMobile && (
        <div
          className="mt-4 rounded-2xl border p-4"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <p className="font-semibold">Baixar app desktop</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            Versão completa pra Windows, com os mesmos dados sincronizados com o site.
          </p>
          <a
            href={DESKTOP_DOWNLOAD_URL}
            className="mt-3 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            <Download size={16} strokeWidth={2} />
            Baixar para Windows
          </a>
        </div>
      )}
    </div>
  )
}
