export const DISCLAIMER_TEXT =
  'Conteúdo educativo e informativo, não é recomendação de investimento e não substitui a orientação de um profissional certificado.'

/** Aviso legal reutilizável nas telas de perfil de investidor, alocação
 * e carteiras fictícias. */
export function Disclaimer() {
  return (
    <div
      className="rounded-xl border px-3.5 py-2.5 text-xs"
      style={{ background: 'var(--card2)', borderColor: 'var(--border)', color: 'var(--muted)' }}
    >
      ℹ️ {DISCLAIMER_TEXT}
    </div>
  )
}
