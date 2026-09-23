// Extração de texto de PDF no navegador (pdfjs-dist), compartilhada entre
// todos os parsers de PDF (Inter, Bradesco, ...) — agrupa os itens de texto
// do pdf.js em linhas usando a coordenada Y (pdf.js já entrega os itens em
// ordem de leitura na maioria dos casos).
import * as pdfjsLib from 'pdfjs-dist'
// eslint-disable-next-line import/no-unresolved
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export async function extractPdfText(bytes: ArrayBuffer): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let lastY: number | null = null
    let line = ''
    const lines: string[] = []
    for (const item of content.items as { str: string; transform: number[] }[]) {
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line)
        line = ''
      }
      line += item.str
      lastY = y
    }
    if (line) lines.push(line)
    parts.push(lines.join('\n'))
  }
  return parts.join('\n')
}
