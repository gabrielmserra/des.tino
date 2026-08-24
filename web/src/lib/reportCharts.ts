// Gráficos desenhados em <canvas> (sem lib externa) para embutir como imagem
// no relatório PDF — mesmo espírito visual dos gráficos matplotlib do
// desktop (report.py), mas renderizados no navegador.

const PIE_COLORS = ['#66C2A5', '#FC8D62', '#8DA0CB', '#E78AC3', '#A6D854', '#FFD92F', '#E5C494', '#B3B3B3']
const SCALE = 2

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; W: number; H: number } {
  const canvas = document.createElement('canvas')
  canvas.width = w * SCALE
  canvas.height = h * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  return { canvas, ctx, W: w, H: h }
}

function niceMax(v: number): number {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const norm = v / mag
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * mag
}

export function drawLineChart(
  labels: string[],
  values: number[],
  color: string,
  opts: { showMarkers?: boolean } = {},
): string {
  const W = 1000, H = 340
  const { canvas, ctx } = makeCanvas(W, H)
  const padL = 60, padR = 20, padT = 20, padB = 60
  const plotW = W - padL - padR, plotH = H - padT - padB

  const minV = Math.min(0, ...values)
  const maxV = niceMax(Math.max(...values, 1))
  const range = maxV - minV || 1

  const x = (i: number) => padL + (values.length <= 1 ? plotW / 2 : (i / (values.length - 1)) * plotW)
  const y = (v: number) => padT + plotH - ((v - minV) / range) * plotH

  // Gridlines + eixo Y
  ctx.strokeStyle = '#E5E7EB'
  ctx.lineWidth = 1
  ctx.fillStyle = '#6B7280'
  ctx.font = '11px Arial'
  ctx.textAlign = 'right'
  const steps = 5
  for (let s = 0; s <= steps; s++) {
    const v = minV + (range * s) / steps
    const yy = y(v)
    ctx.beginPath()
    ctx.moveTo(padL, yy)
    ctx.lineTo(padL + plotW, yy)
    ctx.stroke()
    ctx.fillText(v.toFixed(0), padL - 8, yy + 4)
  }

  // Linha de zero em destaque
  if (minV < 0 && maxV > 0) {
    ctx.strokeStyle = '#9CA3AF'
    ctx.beginPath()
    ctx.moveTo(padL, y(0))
    ctx.lineTo(padL + plotW, y(0))
    ctx.stroke()
  }

  // Linha de dados
  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  ctx.beginPath()
  values.forEach((v, i) => {
    const px = x(i), py = y(v)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.stroke()

  if (opts.showMarkers !== false) {
    ctx.fillStyle = color
    values.forEach((v, i) => {
      ctx.beginPath()
      ctx.arc(x(i), y(v), 3.5, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Labels do eixo X (afinados se houver muitos pontos)
  const maxTicks = 16
  const step = Math.max(1, Math.ceil(labels.length / maxTicks))
  ctx.fillStyle = '#374151'
  ctx.font = '10px Arial'
  ctx.save()
  for (let i = 0; i < labels.length; i += step) {
    ctx.save()
    ctx.translate(x(i), padT + plotH + 14)
    ctx.rotate((-35 * Math.PI) / 180)
    ctx.textAlign = 'right'
    ctx.fillText(labels[i], 0, 0)
    ctx.restore()
  }
  ctx.restore()

  return canvas.toDataURL('image/png')
}

export function drawPieChart(items: { label: string; value: number }[]): string {
  const W = 1000, H = 460
  const { canvas, ctx } = makeCanvas(W, H)
  const total = items.reduce((s, i) => s + i.value, 0) || 1
  const cx = 260, cy = H / 2, r = 170

  let angle = -Math.PI / 2
  items.forEach((it, i) => {
    const slice = (it.value / total) * Math.PI * 2
    ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length]
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, angle, angle + slice)
    ctx.closePath()
    ctx.fill()

    const pct = it.value / total
    if (pct >= 0.04) {
      const mid = angle + slice / 2
      const lx = cx + Math.cos(mid) * r * 0.62
      const ly = cy + Math.sin(mid) * r * 0.62
      ctx.fillStyle = '#1F2937'
      ctx.font = 'bold 13px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(`${(pct * 100).toFixed(0)}%`, lx, ly)
    }
    angle += slice
  })

  // Legenda
  const legendX = 470
  let ly = 60
  ctx.textAlign = 'left'
  items.forEach((it, i) => {
    ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length]
    ctx.fillRect(legendX, ly - 10, 14, 14)
    ctx.fillStyle = '#1F2937'
    ctx.font = '13px Arial'
    const pct = (it.value / total) * 100
    ctx.fillText(`${it.label}  ·  ${pct.toFixed(1)}%`, legendX + 20, ly + 1)
    ly += 26
  })

  return canvas.toDataURL('image/png')
}

export function drawBarChart(items: { label: string; value: number }[]): string {
  const W = 1000, H = 380
  const { canvas, ctx } = makeCanvas(W, H)
  const padL = 60, padR = 20, padT = 20, padB = 70
  const plotW = W - padL - padR, plotH = H - padT - padB
  const maxV = niceMax(Math.max(...items.map((i) => i.value), 1))

  ctx.strokeStyle = '#E5E7EB'
  ctx.fillStyle = '#6B7280'
  ctx.font = '11px Arial'
  ctx.textAlign = 'right'
  const steps = 5
  for (let s = 0; s <= steps; s++) {
    const v = (maxV * s) / steps
    const yy = padT + plotH - (v / maxV) * plotH
    ctx.beginPath()
    ctx.moveTo(padL, yy)
    ctx.lineTo(padL + plotW, yy)
    ctx.stroke()
    ctx.fillText(v.toFixed(0), padL - 8, yy + 4)
  }

  const bw = (plotW / items.length) * 0.6
  const gap = (plotW / items.length) * 0.4
  ctx.fillStyle = '#2E7D5B'
  items.forEach((it, i) => {
    const bx = padL + i * (bw + gap) + gap / 2
    const bh = (it.value / maxV) * plotH
    ctx.fillRect(bx, padT + plotH - bh, bw, bh)
  })

  ctx.fillStyle = '#374151'
  ctx.font = '11px Arial'
  items.forEach((it, i) => {
    const bx = padL + i * (bw + gap) + gap / 2 + bw / 2
    ctx.save()
    ctx.translate(bx, padT + plotH + 16)
    ctx.rotate((-25 * Math.PI) / 180)
    ctx.textAlign = 'right'
    ctx.fillText(it.label, 0, 0)
    ctx.restore()
  })

  return canvas.toDataURL('image/png')
}
