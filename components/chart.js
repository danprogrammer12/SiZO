// ─────────────────────────────────────────────────────────────
// SIZO — Chart engine (Canvas 2D vanilla)
// Sin dependencias externas — implementa línea, barra y donut
// ─────────────────────────────────────────────────────────────

const FONT = "'Inter', sans-serif"
const PALETTE = {
  brand:    '#2563EB',
  teal:     '#06B6D4',
  success:  '#22C55E',
  warning:  '#F59E0B',
  danger:   '#EF4444',
  muted:    '#94A3B8',
  grid:     '#E2E8F0',
  gridDark: '#334155',
}

function isDark() {
  return document.documentElement.classList.contains('dark')
}

// ─────────── GRÁFICO DE LÍNEAS ───────────
function lineChart(canvas, { series = [], labels = [], yMin, yMax } = {}) {
  const ctx   = canvas.getContext('2d')
  const dpr   = window.devicePixelRatio || 1
  const W     = canvas.offsetWidth
  const H     = canvas.offsetHeight
  canvas.width  = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  const dark    = isDark()
  const pad     = { top: 20, right: 20, bottom: 40, left: 48 }
  const cw      = W - pad.left - pad.right
  const ch      = H - pad.top  - pad.bottom

  // Rango Y automático
  const allValues = series.flatMap(s => s.data)
  const dataMin   = yMin ?? Math.min(...allValues)
  const dataMax   = yMax ?? Math.max(...allValues)
  const range     = dataMax - dataMin || 1

  const toX = i  => pad.left + (i / (labels.length - 1)) * cw
  const toY = v  => pad.top  + ch - ((v - dataMin) / range) * ch

  // Fondo
  ctx.clearRect(0, 0, W, H)

  // Grid horizontal
  const gridLines = 5
  ctx.strokeStyle = dark ? PALETTE.gridDark : PALETTE.grid
  ctx.lineWidth   = 1
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.top + (ch / gridLines) * i
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(pad.left + cw, y)
    ctx.stroke()

    // Etiqueta Y
    const val = dataMax - ((dataMax - dataMin) / gridLines) * i
    ctx.fillStyle = dark ? '#64748B' : PALETTE.muted
    ctx.font      = `11px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(val.toFixed(0), pad.left - 6, y + 4)
  }

  // Etiquetas X
  ctx.textAlign = 'center'
  ctx.fillStyle = dark ? '#64748B' : PALETTE.muted
  ctx.font      = `11px ${FONT}`
  labels.forEach((label, i) => {
    ctx.fillText(label, toX(i), H - 8)
  })

  // Series
  series.forEach(s => {
    const color = PALETTE[s.color] || s.color || PALETTE.brand

    // Fill bajo la línea
    if (s.fill) {
      ctx.beginPath()
      ctx.moveTo(toX(0), toY(s.data[0]))
      s.data.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)) })
      ctx.lineTo(toX(s.data.length - 1), pad.top + ch)
      ctx.lineTo(toX(0), pad.top + ch)
      ctx.closePath()
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch)
      grad.addColorStop(0, color + '33')
      grad.addColorStop(1, color + '00')
      ctx.fillStyle = grad
      ctx.fill()
    }

    // Línea
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth   = s.dashed ? 2 : 2.5
    ctx.setLineDash(s.dashed ? [6, 3] : [])
    ctx.moveTo(toX(0), toY(s.data[0]))
    s.data.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)) })
    ctx.stroke()
    ctx.setLineDash([])

    // Puntos
    if (s.dots !== false) {
      s.data.forEach((v, i) => {
        ctx.beginPath()
        ctx.arc(toX(i), toY(v), 4, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.strokeStyle = dark ? '#1E293B' : '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      })
    }
  })

  // Tooltip en hover
  let hoverIndex = null
  canvas.onmousemove = e => {
    const rect = canvas.getBoundingClientRect()
    const mx   = e.clientX - rect.left
    let closest = null
    let minDist = Infinity
    labels.forEach((_, i) => {
      const d = Math.abs(toX(i) - mx)
      if (d < minDist) { minDist = d; closest = i }
    })
    if (minDist < 30 && closest !== hoverIndex) {
      hoverIndex = closest
      drawTooltip(ctx, closest, toX(closest), series, labels, W, H, pad, dark)
    }
  }
  canvas.onmouseleave = () => {
    hoverIndex = null
    // Redibuja sin tooltip
    lineChart(canvas, { series, labels, yMin, yMax })
  }
}

function drawTooltip(ctx, i, x, series, labels, W, H, pad, dark) {
  const lines = series.map(s => ({ label: s.label, value: s.data[i], color: PALETTE[s.color] || s.color || PALETTE.brand }))
  const tw    = 160
  const th    = 16 + lines.length * 20
  let tx      = x + 12
  if (tx + tw > W - pad.right) tx = x - tw - 12

  ctx.fillStyle   = dark ? '#1E293B' : '#0F172A'
  ctx.strokeStyle = dark ? '#334155' : '#E2E8F0'
  ctx.lineWidth   = 1
  roundRect(ctx, tx, pad.top + 10, tw, th, 8)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = dark ? '#CBD5E1' : '#F8FAFC'
  ctx.font      = `11px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText(labels[i], tx + 10, pad.top + 10 + 14)
  lines.forEach((l, j) => {
    ctx.fillStyle = l.color
    ctx.fillRect(tx + 10, pad.top + 10 + 20 + j * 20 + 4, 8, 8)
    ctx.fillStyle = dark ? '#CBD5E1' : '#F8FAFC'
    ctx.fillText(`${l.label}: ${l.value}`, tx + 24, pad.top + 10 + 20 + j * 20 + 12)
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ─────────── GRÁFICO DE BARRAS ───────────
function barChart(canvas, { labels = [], data = [], color = 'brand' } = {}) {
  const ctx  = canvas.getContext('2d')
  const dpr  = window.devicePixelRatio || 1
  const W    = canvas.offsetWidth
  const H    = canvas.offsetHeight
  canvas.width  = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  const dark   = isDark()
  const pad    = { top: 16, right: 16, bottom: 40, left: 48 }
  const cw     = W - pad.left - pad.right
  const ch     = H - pad.top  - pad.bottom
  const maxVal = Math.max(...data, 1)
  const barW   = cw / labels.length * 0.6
  const gap    = cw / labels.length

  ctx.clearRect(0, 0, W, H)

  // Grid
  ctx.strokeStyle = dark ? PALETTE.gridDark : PALETTE.grid
  ctx.lineWidth   = 1
  for (let i = 0; i <= 5; i++) {
    const y   = pad.top + (ch / 5) * i
    const val = maxVal - (maxVal / 5) * i
    ctx.beginPath()
    ctx.moveTo(pad.left, y)
    ctx.lineTo(pad.left + cw, y)
    ctx.stroke()
    ctx.fillStyle = dark ? '#64748B' : PALETTE.muted
    ctx.font      = `11px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(val.toFixed(0), pad.left - 6, y + 4)
  }

  const c = PALETTE[color] || color
  data.forEach((v, i) => {
    const x = pad.left + gap * i + (gap - barW) / 2
    const h = (v / maxVal) * ch
    const y = pad.top + ch - h

    ctx.fillStyle = c + '33'
    roundRect(ctx, x, y, barW, h, 4)
    ctx.fill()
    ctx.fillStyle = c
    roundRect(ctx, x, y, barW, Math.min(h, 4), 4)
    ctx.fill()
    roundRect(ctx, x, y, barW, h, 4)
    ctx.fillStyle = c
    ctx.fill()

    ctx.fillStyle = dark ? '#64748B' : PALETTE.muted
    ctx.font      = `11px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(labels[i], x + barW / 2, H - 8)
  })
}

// ─────────── DONUT ───────────
function donutChart(canvas, { segments = [], total } = {}) {
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const W   = canvas.offsetWidth
  const H   = canvas.offsetHeight
  canvas.width  = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  const cx   = W / 2
  const cy   = H / 2
  const r    = Math.min(W, H) / 2 - 16
  const hole = r * 0.6
  const sum  = total ?? segments.reduce((a, s) => a + s.value, 0)

  ctx.clearRect(0, 0, W, H)

  let angle = -Math.PI / 2
  segments.forEach(s => {
    const slice = (s.value / sum) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, angle, angle + slice)
    ctx.closePath()
    ctx.fillStyle = PALETTE[s.color] || s.color
    ctx.fill()
    angle += slice
  })

  // Hueco
  ctx.beginPath()
  ctx.arc(cx, cy, hole, 0, Math.PI * 2)
  ctx.fillStyle = isDark() ? '#1E293B' : '#fff'
  ctx.fill()
}

export { lineChart, barChart, donutChart }
