import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { fetchImportCutoffDay, saveImportCutoffDay } from '../lib/api'

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

  useEffect(() => {
    fetchImportCutoffDay()
      .then(setDay)
      .finally(() => setLoading(false))
  }, [])

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
