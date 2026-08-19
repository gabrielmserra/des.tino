// Exportação de lançamentos em .xlsx formatado — mesmo padrão visual do
// desktop (database.py:export_month_xlsx): cabeçalho destacado, valores
// como número (não texto), entradas em verde e saídas em vermelho, data
// real de pagamento e uma linha de totais no fim.
import ExcelJS from 'exceljs'
import type { Transaction } from './types'
import { PAYMENT_METHODS } from './constants'

const TYPE_LABELS: Record<string, string> = {
  entrada_fixa: 'Entrada Fixa',
  entrada_variavel: 'Entrada Variável',
  saida_fixa: 'Saída Fixa',
  saida_variavel: 'Saída Variável',
}

const GREEN = 'FF1F8A5B'
const RED = 'FFC0392B'
const DARK = 'FF1F2937'
const THIN_BORDER = { style: 'thin' as const, color: { argb: 'FFDDDDDD' } }

export async function exportMonthXlsx(monthName: string, transactions: Transaction[]): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet((monthName || 'Lançamentos').slice(0, 31))

  ws.columns = [
    { header: 'Tipo', key: 'tipo', width: 16 },
    { header: 'Descrição', key: 'descricao', width: 38 },
    { header: 'Categoria', key: 'categoria', width: 18 },
    { header: 'Forma de Pagamento', key: 'forma', width: 18 },
    { header: 'Valor', key: 'valor', width: 14 },
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Previsto', key: 'previsto', width: 10 },
  ]

  const headerRow = ws.getRow(1)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: 'A1', to: 'G1' }

  let totalEntradas = 0
  let totalSaidas = 0

  for (const t of transactions) {
    const isIncome = t.type === 'entrada_fixa' || t.type === 'entrada_variavel'
    const rawDate = t.payment_date || t.created_at
    const dateVal = rawDate ? new Date(rawDate.slice(0, 10) + 'T00:00:00') : null

    const row = ws.addRow({
      tipo: TYPE_LABELS[t.type] ?? t.type,
      descricao: t.description,
      categoria: t.category || 'Outros',
      forma: t.payment_method ? (PAYMENT_METHODS[t.payment_method] ?? '') : '',
      valor: t.amount,
      data: dateVal,
      previsto: t.is_expectation ? 'Sim' : 'Não',
    })
    row.eachCell((cell) => {
      cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }
    })
    const valorCell = row.getCell('valor')
    valorCell.numFmt = '"R$" #,##0.00'
    valorCell.font = { bold: true, color: { argb: isIncome ? GREEN : RED } }
    if (dateVal) row.getCell('data').numFmt = 'DD/MM/YYYY'

    if (!t.is_expectation) {
      if (isIncome) totalEntradas += t.amount
      else totalSaidas += t.amount
    }
  }

  ws.addRow({})
  const addTotalRow = (label: string, value: number, color: string) => {
    const r = ws.addRow({ tipo: label, valor: value })
    r.getCell('tipo').font = { bold: true }
    const c = r.getCell('valor')
    c.numFmt = '"R$" #,##0.00'
    c.font = { bold: true, color: { argb: color } }
  }
  addTotalRow('Total Entradas', totalEntradas, GREEN)
  addTotalRow('Total Saídas', totalSaidas, RED)
  addTotalRow('Saldo', totalEntradas - totalSaidas, DARK)

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(monthName || 'lancamentos').replace(/\s+/g, '_')}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
