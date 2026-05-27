import { useState, useMemo, useRef, useEffect } from "react"

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
      if (items.length === 0) return []
      const startDate = new Date(items[0].date)
      startDate.setDate(startDate.getDate() - 1)
      let cum = 0
      return [
        { date: startDate, value: 0 },
        ...items.map((item) => { cum += item.profit; return { date: item.date, value: cum } }),
      ]
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

    const realCoords = realPoints.length > 0 ? toCoords(realPoints) : []
    const revCoords = revPoints.length > 0 ? toCoords(revPoints) : []

    const allDates = [...realPoints, ...revPoints].map((p) => p.date).sort((a, b) => a - b)
    const fmtDate = (d) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })

    return {
      realPath: smoothBezier(realCoords),
      revPath: smoothBezier(revCoords),
      realLast: realCoords.length > 0 ? realCoords[realCoords.length - 1] : null,
      revLast: revCoords.length > 0 ? revCoords[revCoords.length - 1] : null,
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
            {data.realLast && (
              <>
                <path d={`${data.realPath} L${data.realLast.x.toFixed(2)},80 L1,80 Z`} fill="url(#dualRed)" />
                <path d={data.realPath} fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <circle cx={data.realLast.x} cy={data.realLast.y} r="1.5" fill="#f87171" stroke="var(--card-bg)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </>
            )}
            {data.revLast && (
              <>
                <path d={`${data.revPath} L${data.revLast.x.toFixed(2)},80 L1,80 Z`} fill="url(#dualPurple)" />
                <path d={data.revPath} fill="none" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3 2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <circle cx={data.revLast.x} cy={data.revLast.y} r="1.5" fill="#a855f7" stroke="var(--card-bg)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </>
            )}
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

// ── helpers para semanas ──────────────────────────────────────────────────────

const getWeekMonday = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return new Date(y, m - 1, d + diff)
}

const fmtWeekRange = (monday) => {
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const mes = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]
  const sd = monday.getDate(), ed = sunday.getDate()
  return monday.getMonth() === sunday.getMonth()
    ? `${sd} – ${ed} ${mes[monday.getMonth()]}`
    : `${sd} ${mes[monday.getMonth()]} – ${ed} ${mes[sunday.getMonth()]}`
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
        if (!map[t.date]) map[t.date] = { real: 0, review: 0, realCount: 0, reviewCount: 0, realWins: 0, reviewWins: 0 }
        const p = Number(t.profit || 0)
        map[t.date][key] += p
        map[t.date][key + "Count"]++
        if (p > 0) map[t.date][key + "Wins"]++
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

  // Resumen semanal
  const weekMap = useMemo(() => {
    const map = {}
    const addToWeek = (trades, key) => {
      for (const t of trades) {
        if (!t.date) continue
        const [y, m] = t.date.split("-").map(Number)
        if (y !== year || m - 1 !== month) continue
        const monday = getWeekMonday(t.date)
        const wk = monday.toISOString().slice(0, 10)
        if (!map[wk]) map[wk] = { monday, real: 0, review: 0, realCount: 0, reviewCount: 0, realWins: 0, reviewWins: 0 }
        const p = Number(t.profit || 0)
        map[wk][key] += p
        map[wk][key + "Count"]++
        if (p > 0) map[wk][key + "Wins"]++
      }
    }
    addToWeek(realTrades, "real")
    addToWeek(reviewTrades, "review")
    return map
  }, [realTrades, reviewTrades, year, month])

  const weekKeys = Object.keys(weekMap).sort()

  const totalReal = weekKeys.reduce((s, k) => s + weekMap[k].real, 0)
  const totalReview = weekKeys.reduce((s, k) => s + weekMap[k].review, 0)
  const totalRealCount = weekKeys.reduce((s, k) => s + weekMap[k].realCount, 0)
  const totalReviewCount = weekKeys.reduce((s, k) => s + weekMap[k].reviewCount, 0)
  const totalRealWins = weekKeys.reduce((s, k) => s + weekMap[k].realWins, 0)
  const totalReviewWins = weekKeys.reduce((s, k) => s + weekMap[k].reviewWins, 0)

  const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

  const pnlColor = (v) => v > 0 ? "#10b981" : v < 0 ? "#f87171" : "var(--text-muted)"
  const deltaColor = (v) => v > 0 ? "#a855f7" : v < 0 ? "#10b981" : "var(--text-muted)"

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "10px" }}>Calendario Comparativo</p>
          <h3 style={{ margin: "4px 0 0", fontSize: "20px", fontWeight: "700", color: "var(--text-1)", textTransform: "capitalize" }}>{monthName}</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", gap: "14px" }}>
            {[
              { color: "#f87171", label: "Real" },
              { color: "#a855f7", label: "Revisión" },
              { borderColor: "rgba(168,85,247,0.55)", label: "Dejaste dinero" },
              { borderColor: "rgba(16,185,129,0.55)", label: "Superaste el plan" },
            ].map(({ color, borderColor, label }) => (
              <span key={label} style={{ fontSize: "11px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "3px", flexShrink: 0, display: "inline-block",
                  background: color || "transparent",
                  border: borderColor ? `1.5px solid ${borderColor}` : "none",
                }} />
                {label}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={() => setCalMonth(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 })}
              style={{ width: "30px", height: "30px", border: "1px solid var(--border-nav)", background: "var(--card-bg)", color: "var(--text-1)", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>←</button>
            <button onClick={() => setCalMonth(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 })}
              style={{ width: "30px", height: "30px", border: "1px solid var(--border-nav)", background: "var(--card-bg)", color: "var(--text-1)", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>→</button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px" }}>
        {DOW.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "10px", color: "var(--text-muted)", padding: "4px 0 8px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "600" }}>{d}</div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />
          const real = cell.real || 0
          const review = cell.review || 0
          const hasReal = real !== 0
          const hasReview = review !== 0
          const hasAny = hasReal || hasReview
          const delta = review - real

          let borderColor = "var(--border-nav)"
          let bgAccent = "transparent"
          if (hasAny) {
            if (delta > 20) { borderColor = "rgba(168,85,247,0.45)"; bgAccent = "rgba(168,85,247,0.04)" }
            else if (delta < -20) { borderColor = "rgba(16,185,129,0.45)"; bgAccent = "rgba(16,185,129,0.04)" }
          }

          return (
            <div key={i} style={{
              border: `1px solid ${borderColor}`,
              borderRadius: "10px",
              background: hasAny ? bgAccent : "var(--card-bg)",
              minHeight: "88px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}>
              {/* Día */}
              <div style={{ padding: "8px 10px 6px", borderBottom: hasAny ? "1px solid var(--border-nav)" : "none" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: hasAny ? "var(--text-1)" : "var(--text-muted)" }}>{cell.dayNum}</span>
              </div>

              {/* Valores */}
              {hasAny && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px", padding: "6px 0" }}>
                  {/* Real */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0", paddingLeft: "0" }}>
                    <div style={{ width: "3px", alignSelf: "stretch", background: "#f87171", borderRadius: "0 2px 2px 0", flexShrink: 0 }} />
                    <span style={{
                      paddingLeft: "7px",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: hasReal ? pnlColor(real) : "var(--text-muted)",
                      opacity: hasReal ? 1 : 0.35,
                    }}>
                      {hasReal ? fmtPnl(real) : "–"}
                    </span>
                  </div>
                  {/* Revisión */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
                    <div style={{ width: "3px", alignSelf: "stretch", background: "#a855f7", borderRadius: "0 2px 2px 0", flexShrink: 0 }} />
                    <span style={{
                      paddingLeft: "7px",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: hasReview ? (review > 0 ? "#a855f7" : "#f87171") : "var(--text-muted)",
                      opacity: hasReview ? 1 : 0.35,
                    }}>
                      {hasReview ? fmtPnl(review) : "–"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Resumen semanal */}
      {weekKeys.length > 0 && (
        <div style={{ marginTop: "32px" }}>
          <p style={{ margin: "0 0 4px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "10px", fontWeight: "600" }}>Desglose Mensual</p>
          <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: "700", color: "var(--text-1)", textTransform: "capitalize" }}>{monthName}</h3>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-nav)" }}>
                  {["Semana", "Real", "Revisión", "Delta"].map((h, i) => (
                    <th key={h} style={{
                      padding: "8px 12px",
                      textAlign: i === 0 ? "left" : "right",
                      fontSize: "10px",
                      fontWeight: "600",
                      color: i === 1 ? "#f87171" : i === 2 ? "#a855f7" : "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekKeys.map((wk) => {
                  const w = weekMap[wk]
                  const wDelta = w.review - w.real
                  const realWR = w.realCount > 0 ? Math.round((w.realWins / w.realCount) * 100) : null
                  const revWR = w.reviewCount > 0 ? Math.round((w.reviewWins / w.reviewCount) * 100) : null
                  return (
                    <tr key={wk} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                      <td style={{ padding: "12px 12px", color: "var(--text-muted)", fontSize: "13px" }}>
                        {fmtWeekRange(w.monday)}
                      </td>
                      <td style={{ padding: "12px 12px", textAlign: "right" }}>
                        <div style={{ color: pnlColor(w.real), fontWeight: "700" }}>{w.real !== 0 ? fmtPnl(w.real) : "–"}</div>
                        {realWR !== null && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{w.realCount} trades · {realWR}% WR</div>}
                      </td>
                      <td style={{ padding: "12px 12px", textAlign: "right" }}>
                        <div style={{ color: w.review > 0 ? "#a855f7" : w.review < 0 ? "#f87171" : "var(--text-muted)", fontWeight: "700" }}>{w.review !== 0 ? fmtPnl(w.review) : "–"}</div>
                        {revWR !== null && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{w.reviewCount} trades · {revWR}% WR</div>}
                      </td>
                      <td style={{ padding: "12px 12px", textAlign: "right" }}>
                        <div style={{ color: deltaColor(wDelta), fontWeight: "700" }}>{wDelta !== 0 ? fmtPnl(wDelta) : "–"}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border-nav)" }}>
                  <td style={{ padding: "14px 12px", fontWeight: "700", color: "var(--text-1)", fontSize: "13px" }}>Total Mes</td>
                  <td style={{ padding: "14px 12px", textAlign: "right" }}>
                    <div style={{ color: pnlColor(totalReal), fontWeight: "800", fontSize: "15px" }}>{totalReal !== 0 ? fmtPnl(totalReal) : "–"}</div>
                    {totalRealCount > 0 && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{totalRealCount} trades · {Math.round((totalRealWins / totalRealCount) * 100)}% WR</div>}
                  </td>
                  <td style={{ padding: "14px 12px", textAlign: "right" }}>
                    <div style={{ color: totalReview > 0 ? "#a855f7" : totalReview < 0 ? "#f87171" : "var(--text-muted)", fontWeight: "800", fontSize: "15px" }}>{totalReview !== 0 ? fmtPnl(totalReview) : "–"}</div>
                    {totalReviewCount > 0 && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{totalReviewCount} trades · {Math.round((totalReviewWins / totalReviewCount) * 100)}% WR</div>}
                  </td>
                  <td style={{ padding: "14px 12px", textAlign: "right" }}>
                    <div style={{ color: deltaColor(totalReview - totalReal), fontWeight: "800", fontSize: "15px" }}>{(totalReview - totalReal) !== 0 ? fmtPnl(totalReview - totalReal) : "–"}</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DatePicker ────────────────────────────────────────────────────────────────

function DatePicker({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const [view, setView] = useState(() => ({
    year: value ? parseInt(value.slice(0, 4)) : today.getFullYear(),
    month: value ? parseInt(value.slice(5, 7)) - 1 : today.getMonth(),
  }))
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const prevMonth = () => setView(({ year: y, month: m }) => m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 })
  const nextMonth = () => setView(({ year: y, month: m }) => m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 })

  const firstDow = (new Date(view.year, view.month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const monthLabel = new Date(view.year, view.month, 1)
    .toLocaleString("es-ES", { month: "long", year: "numeric" })

  const handleDay = (day) => {
    const dk = `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    onChange(dk)
    setOpen(false)
  }

  const displayValue = value
    ? new Date(value + "T00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    : null

  const DOW = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"]
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: open ? "rgba(168,85,247,0.1)" : "var(--card-bg)",
          border: `1px solid ${open ? "rgba(168,85,247,0.5)" : "var(--border-nav)"}`,
          borderRadius: "10px", padding: "8px 14px",
          color: displayValue ? "var(--text-1)" : "var(--text-muted)",
          fontSize: "13px", cursor: "pointer", transition: "all 0.15s",
          minWidth: "148px", textAlign: "left",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontWeight: displayValue ? "500" : "400" }}>
          {displayValue || placeholder}
        </span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
          background: "var(--sidebar-bg)", border: "1px solid var(--border-nav)",
          borderRadius: "14px", padding: "16px", width: "264px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {/* Nav mes */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <button onClick={prevMonth} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px 8px", borderRadius: "6px", fontSize: "14px" }}>←</button>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-1)", textTransform: "capitalize" }}>{monthLabel}</span>
            <button onClick={nextMonth} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px 8px", borderRadius: "6px", fontSize: "14px" }}>→</button>
          </div>

          {/* Días de la semana */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "6px" }}>
            {DOW.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", padding: "2px 0", textTransform: "uppercase" }}>{d}</div>
            ))}
          </div>

          {/* Celdas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dk = `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              const isSelected = dk === value
              const isToday = dk === todayStr
              return (
                <button
                  key={day}
                  onClick={() => handleDay(day)}
                  style={{
                    border: "none", borderRadius: "7px",
                    padding: "6px 0", fontSize: "12px", fontWeight: isSelected ? "700" : "400",
                    cursor: "pointer", textAlign: "center",
                    background: isSelected ? "#a855f7" : isToday ? "rgba(168,85,247,0.12)" : "transparent",
                    color: isSelected ? "#fff" : isToday ? "#a855f7" : "var(--text-1)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(168,85,247,0.15)" }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isToday ? "rgba(168,85,247,0.12)" : "transparent" }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Limpiar */}
          {value && (
            <button
              onClick={() => { onChange(""); setOpen(false) }}
              style={{ marginTop: "10px", width: "100%", background: "none", border: "1px solid var(--border-nav)", borderRadius: "8px", padding: "6px", color: "var(--text-muted)", fontSize: "12px", cursor: "pointer" }}
            >
              Limpiar selección
            </button>
          )}
        </div>
      )}
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
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const filteredTrades = useMemo(() => trades.filter((t) => {
    if (!t.date) return false
    if (dateFrom && t.date < dateFrom) return false
    if (dateTo && t.date > dateTo) return false
    return true
  }), [trades, dateFrom, dateTo])

  const filteredReview = useMemo(() => reviewTrades.filter((t) => {
    if (!t.date) return false
    if (dateFrom && t.date < dateFrom) return false
    if (dateTo && t.date > dateTo) return false
    return true
  }), [reviewTrades, dateFrom, dateTo])

  const realStats = useMemo(() => calcStats(filteredTrades), [filteredTrades])
  const revStats = useMemo(() => calcStats(filteredReview), [filteredReview])
  const delta = revStats.total - realStats.total

  const hasFilter = dateFrom || dateTo
  const clearFilter = () => { setDateFrom(""); setDateTo("") }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header con filtro */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>Revisión · Análisis</p>
          <h1 style={{ margin: "8px 0 4px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>Comparativa</h1>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>Journal real vs operaciones de revisión</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Desde</span>
            <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Seleccionar" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Hasta</span>
            <DatePicker value={dateTo} onChange={setDateTo} placeholder="Seleccionar" />
          </div>
        </div>
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
          <DualEquityCurve realTrades={filteredTrades} reviewTrades={filteredReview} />
        </div>
      </div>

      {/* Comparative calendar */}
      <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-nav)", borderRadius: "16px", padding: "24px" }}>
        <ComparativeCalendar realTrades={filteredTrades} reviewTrades={filteredReview} />
      </div>
    </div>
  )
}
