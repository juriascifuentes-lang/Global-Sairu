import { useState, useMemo } from "react"

// ── helpers ───────────────────────────────────────────────────────────────────

const parseLocalDate = (v) => {
  if (!v) return null
  const [y, m, d] = v.split("-").map(Number)
  return new Date(y, m - 1, d)
}

const fmtPnl = (v) =>
  v >= 0
    ? `+$${Math.round(v).toLocaleString()}`
    : `-$${Math.round(Math.abs(v)).toLocaleString()}`

const calcStats = (trades) => {
  const profits = trades.map((t) => Number(t.profit || 0))
  const total = profits.reduce((s, p) => s + p, 0)
  const wins = profits.filter((p) => p > 0)
  const losses = profits.filter((p) => p < 0)
  const winRate = profits.length > 0 ? (wins.length / profits.length) * 100 : 0
  const grossWin = wins.reduce((s, p) => s + p, 0)
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0))
  const pf = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0
  return { total, winRate, pf, count: trades.length }
}

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

// ── DualEquityCurve ───────────────────────────────────────────────────────────

function DualEquityCurve({ realTrades, reviewTrades }) {
  const data = useMemo(() => {
    const build = (trades) =>
      [...trades]
        .map((t) => ({ date: t.date ? parseLocalDate(t.date) : null, profit: Number(t.profit || 0) }))
        .filter((x) => x.date && !isNaN(x.date.getTime()))
        .sort((a, b) => a.date - b.date)

    const realItems = build(realTrades)
    const revItems = build(reviewTrades)
    if (realItems.length === 0 && revItems.length === 0) return null

    const accumulate = (items) => {
      let cum = 0
      return items.map((item) => { cum += item.profit; return { date: item.date, value: cum } })
    }

    const realPoints = accumulate(realItems)
    const revPoints = accumulate(revItems)

    const allValues = [...realPoints.map((p) => p.value), ...revPoints.map((p) => p.value), 0]
    const minVal = Math.min(...allValues)
    const maxVal = Math.max(...allValues)
    const range = maxVal - minVal || 1
    const toY = (v) => 4 + ((maxVal - v) / range) * 72

    const toCoords = (points) =>
      points.map((p, i) => ({
        x: points.length === 1 ? 50 : 1 + (i / (points.length - 1)) * 98,
        y: toY(p.value),
        date: p.date,
      }))

    const realCoords = toCoords(realPoints)
    const revCoords = toCoords(revPoints)

    const allDates = [...realPoints, ...revPoints].map((p) => p.date).sort((a, b) => a - b)
    const fmtDate = (d) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })

    return {
      realPath: smoothBezier(realCoords),
      revPath: smoothBezier(revCoords),
      realLast: realCoords[realCoords.length - 1],
      revLast: revCoords[revCoords.length - 1],
      xLabels: [fmtDate(allDates[0]), fmtDate(allDates[allDates.length - 1])],
      yLabels: [0, 1, 2, 3, 4].map((i) => {
        const v = maxVal - (i / 4) * range
        return v >= 0 ? `$${Math.round(v)}` : `-$${Math.round(Math.abs(v))}`
      }),
    }
  }, [realTrades, reviewTrades])

  if (!data)
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
        Sin datos para mostrar
      </div>
    )

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", gap: "20px", marginBottom: "14px" }}>
        <span style={{ fontSize: "12px", color: "#f87171", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "20px", height: "2px", background: "#f87171", display: "inline-block", borderRadius: "1px" }} />
          Real
        </span>
        <span style={{ fontSize: "12px", color: "#a855f7", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "20px", height: "2px", background: "#a855f7", display: "inline-block", borderRadius: "1px", opacity: 0.85 }} />
          Revisión
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", gap: 0, minHeight: 0 }}>
        <div style={{ width: "52px", display: "flex", flexDirection: "column", justifyContent: "space-between", paddingRight: "8px", paddingBottom: "20px", flexShrink: 0 }}>
          {data.yLabels.map((label, i) => (
            <span key={i} style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "right", lineHeight: 1 }}>{label}</span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <svg viewBox="0 0 100 80" preserveAspectRatio="none" overflow="visible" style={{ width: "100%", height: "100%", display: "block" }}>
            <defs>
              <linearGradient id="dualRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="dualPurple" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[4, 22, 40, 58, 76].map((y) => (
              <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#334155" strokeWidth="0.5" vectorEffect="non-scaling-stroke" opacity="0.5" />
            ))}
            <path d={`${data.realPath} L${data.realLast.x.toFixed(2)},80 L1,80 Z`} fill="url(#dualRed)" />
            <path d={data.realPath} fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <circle cx={data.realLast.x} cy={data.realLast.y} r="1.5" fill="#f87171" stroke="var(--card-bg)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <path d={`${data.revPath} L${data.revLast.x.toFixed(2)},80 L1,80 Z`} fill="url(#dualPurple)" />
            <path d={data.revPath} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3 2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <circle cx={data.revLast.x} cy={data.revLast.y} r="1.5" fill="#a855f7" stroke="var(--card-bg)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
      <div style={{ marginLeft: "52px", display: "flex", justifyContent: "space-between", paddingTop: "4px" }}>
        {data.xLabels.map((label, i) => (
          <span key={i} style={{ fontSize: "10px", color: "var(--text-muted)" }}>{label}</span>
        ))}
      </div>
    </div>
  )
}

// ── ComparativeCalendar ───────────────────────────────────────────────────────

function ComparativeCalendar({ realTrades, reviewTrades }) {
  const today = new Date()
  const [calMonth, setCalMonth] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const { year, month } = calMonth

  const monthName = new Date(year, month, 1).toLocaleString("es-ES", { month: "long", year: "numeric" })

  const dayMap = useMemo(() => {
    const map = {}
    const add = (trades, key) => {
      for (const t of trades) {
        if (!t.date) continue
        const [y, m] = t.date.split("-").map(Number)
        if (y !== year || m - 1 !== month) continue
        if (!map[t.date]) map[t.date] = { real: 0, review: 0 }
        map[t.date][key] += Number(t.profit || 0)
      }
    }
    add(realTrades, "real")
    add(reviewTrades, "review")
    return map
  }, [realTrades, reviewTrades, year, month])

  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const lastDate = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((firstDow + lastDate) / 7) * 7

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - firstDow + 1
    if (dayNum < 1 || dayNum > lastDate) return null
    const dk = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
    return { dayNum, dk, ...(dayMap[dk] || {}) }
  })

  const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "10px" }}>Calendario Comparativo</p>
          <h3 style={{ margin: "4px 0 0", fontSize: "18px", fontWeight: "700", color: "var(--text-1)", textTransform: "capitalize" }}>{monthName}</h3>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setCalMonth(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 })}
            style={{ width: "32px", height: "32px", border: "1px solid var(--border-nav)", background: "var(--card-bg)", color: "var(--text-1)", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}
          >←</button>
          <button
            onClick={() => setCalMonth(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 })}
            style={{ width: "32px", height: "32px", border: "1px solid var(--border-nav)", background: "var(--card-bg)", color: "var(--text-1)", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}
          >→</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
        <span style={{ fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#f87171", display: "inline-block" }} /> Real
        </span>
        <span style={{ fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "#a855f7", display: "inline-block" }} /> Revisión
        </span>
        <span style={{ fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "2px", border: "1px solid rgba(168,85,247,0.6)", display: "inline-block" }} /> Dejaste dinero
        </span>
        <span style={{ fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "2px", border: "1px solid rgba(16,185,129,0.6)", display: "inline-block" }} /> Superaste el plan
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
        {DOW.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "10px", color: "var(--text-muted)", padding: "4px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d}</div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />
          const hasData = cell.real !== undefined || cell.review !== undefined
          const real = cell.real || 0
          const review = cell.review || 0
          const delta = review - real

          let borderColor = "var(--border-nav)"
          if (hasData && (real !== 0 || review !== 0)) {
            if (delta > 20) borderColor = "rgba(168,85,247,0.5)"
            else if (delta < -20) borderColor = "rgba(16,185,129,0.5)"
          }

          return (
            <div key={i} style={{
              border: `1px solid ${borderColor}`,
              borderRadius: "8px",
              background: "var(--card-bg)",
              padding: "5px 4px",
              minHeight: "62px",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
            }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "center" }}>{cell.dayNum}</span>
              {hasData && (real !== 0 || review !== 0) && (
                <>
                  <div style={{
                    background: real > 0 ? "rgba(16,185,129,0.15)" : real < 0 ? "rgba(248,113,113,0.12)" : "transparent",
                    borderRadius: "4px",
                    padding: "2px 3px",
                    fontSize: "9px",
                    fontWeight: "700",
                    color: real > 0 ? "#10b981" : real < 0 ? "#f87171" : "var(--text-muted)",
                    textAlign: "center",
                  }}>
                    {real !== 0 ? fmtPnl(real) : "–"}
                  </div>
                  <div style={{
                    background: review > 0 ? "rgba(168,85,247,0.12)" : review < 0 ? "rgba(248,113,113,0.1)" : "transparent",
                    borderRadius: "4px",
                    padding: "2px 3px",
                    fontSize: "9px",
                    fontWeight: "700",
                    color: review > 0 ? "#a855f7" : review < 0 ? "#f87171" : "var(--text-muted)",
                    textAlign: "center",
                  }}>
                    {review !== 0 ? fmtPnl(review) : "–"}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ label, real, review, format }) {
  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1px solid var(--border-nav)",
      borderRadius: "16px",
      padding: "20px 24px",
    }}>
      <p style={{ margin: "0 0 14px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "10px", fontWeight: "600" }}>{label}</p>
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-end" }}>
        <div>
          <p style={{ margin: "0 0 3px", fontSize: "10px", color: "var(--text-muted)" }}>Real</p>
          <p style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#f87171" }}>{format(real)}</p>
        </div>
        <div style={{ width: "1px", height: "34px", background: "var(--border-nav)", flexShrink: 0, alignSelf: "flex-end", marginBottom: "2px" }} />
        <div>
          <p style={{ margin: "0 0 3px", fontSize: "10px", color: "var(--text-muted)" }}>Revisión</p>
          <p style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#a855f7" }}>{format(review)}</p>
        </div>
      </div>
    </div>
  )
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function ReviewComparative({ trades, reviewTrades }) {
  const realStats = useMemo(() => calcStats(trades), [trades])
  const revStats = useMemo(() => calcStats(reviewTrades), [reviewTrades])
  const delta = revStats.total - realStats.total

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>Revisión · Análisis</p>
        <h1 style={{ margin: "8px 0 4px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>Comparativa</h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>Journal real vs operaciones de revisión</p>
      </div>

      {/* Costo de errores */}
      <div style={{
        background: delta >= 0 ? "rgba(168,85,247,0.07)" : "rgba(16,185,129,0.07)",
        border: `1px solid ${delta >= 0 ? "rgba(168,85,247,0.28)" : "rgba(16,185,129,0.28)"}`,
        borderRadius: "16px",
        padding: "22px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
      }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: "600" }}>
            {delta >= 0 ? "Costo de errores" : "Superaste tu plan"}
          </p>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
            {delta >= 0
              ? "Lo que dejaste en la mesa vs tu plan de revisión"
              : "Tu ejecución real superó el plan de revisión"}
          </p>
        </div>
        <p style={{ margin: 0, fontSize: "38px", fontWeight: "900", letterSpacing: "-0.03em", color: delta >= 0 ? "#a855f7" : "#10b981" }}>
          {delta >= 0
            ? `-$${Math.round(Math.abs(delta)).toLocaleString()}`
            : `+$${Math.round(Math.abs(delta)).toLocaleString()}`}
        </p>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
        <StatCard
          label="P&L Total"
          real={realStats.total}
          review={revStats.total}
          format={(v) => v >= 0 ? `+$${Math.round(v).toLocaleString()}` : `-$${Math.round(Math.abs(v)).toLocaleString()}`}
        />
        <StatCard
          label="Win Rate"
          real={realStats.winRate}
          review={revStats.winRate}
          format={(v) => `${v.toFixed(1)}%`}
        />
        <StatCard
          label="Profit Factor"
          real={realStats.pf}
          review={revStats.pf}
          format={(v) => isFinite(v) ? v.toFixed(2) : "∞"}
        />
        <StatCard
          label="Total Trades"
          real={realStats.count}
          review={revStats.count}
          format={(v) => String(v)}
        />
      </div>

      {/* Dual equity curve */}
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-nav)", borderRadius: "16px", padding: "24px" }}>
        <p style={{ margin: "0 0 2px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "10px", fontWeight: "600" }}>Rendimiento Acumulado</p>
        <h3 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>Curva de Equity — Real vs Revisión</h3>
        <div style={{ height: "220px", display: "flex" }}>
          <DualEquityCurve realTrades={trades} reviewTrades={reviewTrades} />
        </div>
      </div>

      {/* Comparative calendar */}
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-nav)", borderRadius: "16px", padding: "24px" }}>
        <ComparativeCalendar realTrades={trades} reviewTrades={reviewTrades} />
      </div>
    </div>
  )
}
