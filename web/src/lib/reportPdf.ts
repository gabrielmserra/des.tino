// Relatório Financeiro Completo em PDF — resumo do período, evolução de
// saldo, gastos por categoria/forma de pagamento, gastos ao longo do tempo,
// maiores gastos e a lista completa de lançamentos. Mesmo conteúdo/lógica
// do relatório do desktop (report.py), só que montado no navegador.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Month, Transaction } from './types'
import {
  fetchMonthSummary, fetchExpensesByCategory, fetchExpensesByPaymentMethod, fetchTransactions,
} from './api'
import { formatCurrency, MONTHS_PT } from './format'
import { PAYMENT_METHODS, TYPE_LABELS } from './constants'
import { drawLineChart, drawPieChart, drawBarChart } from './reportCharts'

const HEADER_BG: [number, number, number] = [31, 41, 55]
const GREEN: [number, number, number] = [31, 138, 91]
const RED: [number, number, number] = [192, 57, 43]
const MUTED: [number, number, number] = [107, 114, 128]

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 15
const CONTENT_W = PAGE_W - MARGIN * 2

function monthShortLabel(m: Month): string {
  return `${MONTHS_PT[m.month - 1].slice(0, 3)}/${String(m.year).slice(2)}`
}

function isRealExpense(t: Transaction): boolean {
  if (t.type !== 'saida_fixa' && t.type !== 'saida_variavel') return false
  if (t.is_expectation) return false
  if (t.card_id && t.type === 'saida_variavel') return false
  if (t.benefit_id) return false
  return true
}

function rowDate(t: Transaction): Date | null {
  const raw = t.payment_date || t.created_at
  if (!raw) return null
  const d = new Date(String(raw).slice(0, 19))
  return Number.isNaN(d.getTime()) ? null : d
}

function fmtDateShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtDateFull(d: Date | null): string {
  if (!d) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export async function generateAccountReportPdf(monthsSelected: Month[]): Promise<void> {
  const ordered = [...monthsSelected].sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month))
  if (ordered.length === 0) throw new Error('Nenhum mês selecionado.')

  const [summaries, catTotalsPerMonth, methodTotalsPerMonth, txPerMonth] = await Promise.all([
    Promise.all(ordered.map((m) => fetchMonthSummary(m.id))),
    Promise.all(ordered.map((m) => fetchExpensesByCategory(m.id))),
    Promise.all(ordered.map((m) => fetchExpensesByPaymentMethod(m.id))),
    Promise.all(ordered.map((m) => fetchTransactions(m.id))),
  ])

  const totalEntradas = summaries.reduce((s, x) => s + x.total_entradas, 0)
  const totalSaidas = summaries.reduce((s, x) => s + x.total_saidas, 0)
  const saldoPeriodo = totalEntradas - totalSaidas
  const taxaPoupanca = totalEntradas > 0 ? (saldoPeriodo / totalEntradas) * 100 : 0

  const catTotals = new Map<string, number>()
  for (const list of catTotalsPerMonth) for (const c of list) catTotals.set(c.category, (catTotals.get(c.category) ?? 0) + c.total)

  const methodTotals = new Map<string, number>()
  for (const list of methodTotalsPerMonth) {
    for (const c of list) {
      const label = PAYMENT_METHODS[c.category] ?? c.category
      methodTotals.set(label, (methodTotals.get(label) ?? 0) + c.total)
    }
  }

  const allRows = txPerMonth.flat()
  const realExpenses = allRows.filter(isRealExpense)

  const dailyTotals = new Map<string, number>()
  for (const t of realExpenses) {
    const d = rowDate(t)
    if (!d) continue
    const key = fmtDateShort(d)
    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + t.amount)
  }

  const topGastos = [...realExpenses].sort((a, b) => b.amount - a.amount).slice(0, 10)
  const allRowsSorted = [...allRows].sort((a, b) => {
    const da = rowDate(a)?.getTime() ?? 0
    const db = rowDate(b)?.getTime() ?? 0
    return da - db
  })

  const periodLabel = ordered.length === 1
    ? ordered[0].name
    : `${ordered[0].name} – ${ordered[ordered.length - 1].name}`

  // ── Documento ──────────────────────────────────────────────────────
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...HEADER_BG)
  doc.text('des.tino — Relatório Financeiro', MARGIN, y + 6)
  y += 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(`Período: ${periodLabel}`, MARGIN, y)
  y += 5
  const now = new Date()
  doc.text(
    `Gerado em ${fmtDateFull(now)} às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    MARGIN, y,
  )
  y += 8

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Entradas', 'Saídas', 'Saldo do período', 'Taxa de poupança']],
    body: [[
      formatCurrency(totalEntradas), formatCurrency(totalSaidas),
      formatCurrency(saldoPeriodo), `${taxaPoupanca.toFixed(1)}%`,
    ]],
    theme: 'grid',
    headStyles: { fillColor: HEADER_BG, textColor: 255, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontStyle: 'bold', fontSize: 12, halign: 'center', minCellHeight: 10 },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 0) data.cell.styles.textColor = GREEN
        if (data.column.index === 1) data.cell.styles.textColor = RED
        if (data.column.index === 2) data.cell.styles.textColor = saldoPeriodo >= 0 ? GREEN : RED
      }
    },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
  }

  const addSectionTitle = (text: string) => {
    ensureSpace(14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...HEADER_BG)
    doc.text(text, MARGIN, y + 5)
    y += 10
  }

  const addImageDataUrl = (dataUrl: string, aspect: number) => {
    const w = CONTENT_W
    const h = w / aspect
    ensureSpace(h + 4)
    doc.addImage(dataUrl, 'PNG', MARGIN, y, w, h)
    y += h + 6
  }

  if (summaries.length > 1) {
    addSectionTitle('Evolução do saldo')
    const labels = ordered.map(monthShortLabel)
    const values = summaries.map((s) => s.saldo)
    addImageDataUrl(drawLineChart(labels, values, '#2E7D5B'), 1000 / 340)
  }

  if (catTotals.size > 0) {
    addSectionTitle('Gastos por categoria')
    const items = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
    addImageDataUrl(drawPieChart(items), 1000 / 460)
  }

  if (methodTotals.size > 0) {
    addSectionTitle('Gastos por forma de pagamento')
    const items = [...methodTotals.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
    addImageDataUrl(drawBarChart(items), 1000 / 380)
  }

  if (dailyTotals.size > 1) {
    addSectionTitle('Gastos ao longo do período')
    const labels = [...dailyTotals.keys()]
    const values = [...dailyTotals.values()]
    addImageDataUrl(drawLineChart(labels, values, '#C0392B', { showMarkers: values.length <= 40 }), 1000 / 340)
  }

  if (topGastos.length > 0) {
    addSectionTitle('Maiores gastos do período')
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Descrição', 'Categoria', 'Data', 'Valor']],
      body: topGastos.map((t) => [
        t.description.slice(0, 45),
        t.category || 'Outros',
        fmtDateFull(rowDate(t)),
        formatCurrency(t.amount),
      ]),
      theme: 'grid',
      headStyles: { fillColor: HEADER_BG, textColor: 255, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [243, 244, 246] },
      columnStyles: { 3: { halign: 'right', textColor: RED, fontStyle: 'bold' } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8
  }

  addSectionTitle('Lançamentos completos')
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Tipo', 'Descrição', 'Categoria', 'Forma', 'Valor', 'Data']],
    body: allRowsSorted.map((t) => [
      TYPE_LABELS[t.type] ?? t.type,
      t.description.slice(0, 38),
      t.category || 'Outros',
      t.payment_method ? (PAYMENT_METHODS[t.payment_method] ?? '') : '',
      formatCurrency(t.amount),
      fmtDateFull(rowDate(t)),
    ]),
    theme: 'grid',
    headStyles: { fillColor: HEADER_BG, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [243, 244, 246] },
    columnStyles: { 4: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const t = allRowsSorted[data.row.index]
        const isIncome = t.type === 'entrada_fixa' || t.type === 'entrada_variavel'
        data.cell.styles.textColor = isIncome ? GREEN : RED
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  const filename = `relatorio_destino_${ordered[0].name}_a_${ordered[ordered.length - 1].name}.pdf`.replace(/\s+/g, '_')
  doc.save(filename)
}
