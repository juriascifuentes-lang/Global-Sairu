import { useMemo } from "react"

const parseLocalDate = (value) => {
  if (!value) return null
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

const fmtLabel = (v, showPct) => {
  if (showPct) return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
  return v >= 0 ? `$${Math.round(v)}` : `-$${Math.round(Math.abs(v))}`
}

const fmtDate = (date) =>
  date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })

// Catmull-Rom → Cubic Bezier for smooth curves
const smoothBezier = (coords) => {
  if (coords.length === 0) return ""
  if (coords.length === 1) return `M${coords[0].x},${coords[0].y}`

  const t = 0.3
  let d = `M${coords[0].x.toFixed(2)},${coords[0].y.toFixed(2)}`

  for (let i = 1; i < coords.length; i++) {
    const p0 = coords[Math.max(0, i - 2)]
    const p1 = coords[i - 1]
    const p2 = coords[i]
    const p3 = coords[Math.min(coords.length - 1, i + 1)]

    const cp1x = p1.x + (p2.x - p0.x) * t
    const cp1y = p1.y + (p2.y - p0.y) * t
    const cp2x = p2.x - (p3.x - p1.x) * t
    const cp2y = p2.y - (p3.y - p1.y) * t

    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  return d
}

export function EquityCurve({ trades, showPct = false, baseCapital = 0, accountSizeMap = {}, hideXAxis = false }) {
  const data = useMemo(() => {
    const items = [...trades]
      .map((t) => ({
        date: t.date ? parseLocalDate(t.date) : new Date(Number(t.id)),
        profit: Number(t.profit || 0),
        account: t.account,
      }))
      .filter((item) => item.date && !Number.isNaN(item.date.getTime()))
      .sort((a, b) => a.date - b.date)

    if (items.length === 0) return null

    // Acumula % por-trade (cada trade relativo al tamaño de su cuenta)
    // o $ si showPct es false
    const startDate = new Date(items[0].date)
    startDate.setDate(startDate.getDate() - 1)
    let cum = 0
    const points = [
      { date: startDate, value: 0 },
      ...items.map((item) => {
        if (showPct) {
          const size = accountSizeMap[item.account] || baseCapital
          cum += size > 0 ? (item.profit / size) * 100 : 0
        } else {
          cum += item.profit
        }
        return { date: item.date, value: cum }
      }),
    ]

    const values = points.map((p) => p.value)
    const minVal = Math.min(...values, 0)
    const maxVal = Math.max(...values, showPct ? 0.01 : 1)
    const range = maxVal - minVal || 1
    const isPositive = points[points.length - 1].value >= 0

    // viewBox 0 0 100 80 — data mapped to y: 4..76 (padding 4 each side)
    const toY = (v) => 4 + ((maxVal - v) / range) * 72

    const coords = points.map((p, i) => ({
      x: points.length === 1 ? 50 : 1 + (i / (points.length - 1)) * 98,
      y: toY(p.value),
      date: p.date,
    }))

    const linePath = smoothBezier(coords)
    const last = coords[coords.length - 1]
    // Area: close at bottom
    const areaPath = `${linePath} L${last.x.toFixed(2)},80 L${coords[0].x.toFixed(2)},80 Z`

    // Y-axis: 5 labels top → bottom
    const step = range / 4
    const yLabels = [0, 1, 2, 3, 4].map((i) => fmtLabel(maxVal - i * step, showPct))

    // X-axis: first, middle, last
    const n = coords.length
    const xLabels = [
      { label: fmtDate(coords[0].date), align: "left" },
      n > 2 ? { label: fmtDate(coords[Math.floor(n / 2)].date), align: "center" } : null,
      n > 1 ? { label: fmtDate(coords[n - 1].date), align: "right" } : null,
    ].filter(Boolean)

    const zeroY = toY(0)

    return { linePath, areaPath, last, isPositive, yLabels, xLabels, zeroY }
  }, [trades, showPct, accountSizeMap, baseCapital])

  const color = data?.isPositive !== false ? "#10b981" : "#f87171"
  const gradId = data?.isPositive !== false ? "eqGreen" : "eqRed"

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, display: "flex", gap: 0, minHeight: 0 }}>
        {/* Y-axis labels */}
        <div
          style={{
            width: "48px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingRight: "8px",
            paddingBottom: "20px",
            flexShrink: 0,
          }}
        >
          {(data?.yLabels ?? ["", "", "", "", ""]).map((label, i) => (
            <span
              key={i}
              style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "right", lineHeight: 1 }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* SVG chart */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {!data ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              Sin datos para mostrar
            </div>
          ) : (
            <svg
              viewBox="0 0 100 80"
              preserveAspectRatio="none"
              overflow="visible"
              style={{ width: "100%", height: "100%", display: "block" }}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                  <stop offset="85%" stopColor={color} stopOpacity="0.04" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid lines — non-scaling so they stay 1px on screen */}
              <g>
                {[4, 22, 40, 58, 76].map((y) => (
                  <line
                    key={y}
                    x1="0" y1={y} x2="100" y2={y}
                    stroke="#334155"
                    strokeWidth="0.5"
                    vectorEffect="non-scaling-stroke"
                    opacity="0.5"
                  />
                ))}
              </g>

              {/* Línea de referencia $0 */}
              {data.zeroY > 4 && data.zeroY < 76 && (
                <line
                  x1="0" y1={data.zeroY} x2="100" y2={data.zeroY}
                  stroke="rgba(148,163,184,0.45)"
                  strokeWidth="0.6"
                  strokeDasharray="2 2"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              <path d={data.areaPath} fill={`url(#${gradId})`} />

              {/* Main line — non-scaling-stroke keeps it thin regardless of container size */}
              <path
                d={data.linePath}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* End dot */}
              <circle
                cx={data.last.x}
                cy={data.last.y}
                r="1.5"
                fill={color}
                stroke="var(--card-bg)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
        </div>
      </div>

      {/* X-axis labels */}
      {data && !hideXAxis && (
        <div
          style={{
            marginLeft: "48px",
            display: "flex",
            justifyContent: "space-between",
            paddingTop: "4px",
          }}
        >
          {data.xLabels.map((x, i) => (
            <span
              key={i}
              style={{
                fontSize: "10px",
                color: "var(--text-muted)",
                lineHeight: 1,
                ...(x.align === "center" ? { textAlign: "center", flex: 1 } : {}),
              }}
            >
              {x.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
