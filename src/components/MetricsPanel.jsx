import { useMemo, useState, useEffect, useRef } from "react"
import { fmt$, fmtPct } from "../utils/format"

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
const WEEKDAYS_SHORT = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]
const WEEKDAYS_FULL  = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]

const parseDate = (trade) => {
  if (trade.date) {
    const [y, m, d] = trade.date.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(Number(trade.id))
}

const fmtP = fmtPct

// Usa tiempo local (no UTC) para evitar desfase de días
const formatIso = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const parseIso = (value) => {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

const formatDateLabel = (value) => {
  if (!value) return ""
  const date = parseIso(value)
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function DateRangePicker({ fromDate, toDate, onFromChange, onToChange }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [month, setMonth] = useState(() => fromDate ? parseIso(fromDate) : new Date())
  const [hoverDate, setHoverDate] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setHoverDate(null)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const openFor = (s) => {
    setStep(s)
    if (s === 1 && fromDate) setMonth(parseIso(fromDate))
    else if (s === 2 && toDate) setMonth(parseIso(toDate))
    setOpen(true)
  }

  const changeMonth = (offset) => {
    const next = new Date(month)
    next.setMonth(month.getMonth() + offset)
    setMonth(next)
  }

  const handleDayClick = (iso) => {
    if (step === 1) {
      onFromChange(iso)
      onToChange("")
      setStep(2)
    } else {
      if (fromDate && iso < fromDate) {
        onFromChange(iso)
        onToChange("")
        setStep(2)
      } else {
        onToChange(iso)
        setOpen(false)
        setHoverDate(null)
      }
    }
  }

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
  const firstDayIndex = (monthStart.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()

  const renderDay = (day) => {
    const date = new Date(month.getFullYear(), month.getMonth(), day)
    const iso = formatIso(date)
    const isFrom = iso === fromDate
    const endIso = toDate || (step === 2 && hoverDate ? hoverDate : null)
    const isTo = iso === endIso
    const inRange = fromDate && endIso && iso > fromDate && iso < endIso
    const isSelected = isFrom || isTo

    return (
      <button
        key={day}
        type="button"
        onClick={() => handleDayClick(iso)}
        onMouseEnter={() => step === 2 && setHoverDate(iso)}
        onMouseLeave={() => step === 2 && setHoverDate(null)}
        style={{
          width: "100%",
          height: "36px",
          border: isSelected ? "1.5px solid #10b981" : "1px solid transparent",
          background: isSelected
            ? "rgba(16,185,129,0.22)"
            : inRange
            ? "rgba(16,185,129,0.09)"
            : "transparent",
          borderRadius: "9px",
          color: isSelected ? "#10b981" : inRange ? "var(--text-1)" : "var(--text-1)",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: isSelected ? 700 : 500,
          transition: "background 0.15s",
        }}
      >
        {day}
      </button>
    )
  }

  const hint = step === 1 ? "Seleccioná fecha de inicio" : "Seleccioná fecha de fin"

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Chips de fecha */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1 }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Desde</span>
          <button
            type="button"
            onClick={() => openFor(1)}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: open && step === 1 ? "rgba(16,185,129,0.08)" : "var(--card-bg)",
              border: open && step === 1 ? "1.5px solid rgba(16,185,129,0.5)" : "1px solid var(--border-card)",
              borderRadius: "12px", padding: "10px 14px",
              cursor: "pointer", color: "var(--text-1)", textAlign: "left",
              transition: "border 0.15s, background 0.15s",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>📅</span>
            <span style={{ fontSize: "13px", fontWeight: fromDate ? 600 : 400, color: fromDate ? "var(--text-1)" : "var(--text-muted)" }}>
              {fromDate ? formatDateLabel(fromDate) : "Fecha inicio"}
            </span>
          </button>
        </div>

        <div style={{ color: "var(--text-muted)", fontSize: "16px", paddingTop: "18px" }}>→</div>

        <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1 }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Hasta</span>
          <button
            type="button"
            onClick={() => fromDate && openFor(2)}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: open && step === 2 ? "rgba(16,185,129,0.08)" : "var(--card-bg)",
              border: open && step === 2 ? "1.5px solid rgba(16,185,129,0.5)" : "1px solid var(--border-card)",
              borderRadius: "12px", padding: "10px 14px",
              cursor: fromDate ? "pointer" : "default",
              opacity: fromDate ? 1 : 0.5,
              color: "var(--text-1)", textAlign: "left",
              transition: "border 0.15s, background 0.15s",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>📅</span>
            <span style={{ fontSize: "13px", fontWeight: toDate ? 600 : 400, color: toDate ? "var(--text-1)" : "var(--text-muted)" }}>
              {toDate ? formatDateLabel(toDate) : "Fecha fin"}
            </span>
          </button>
        </div>
      </div>

      {/* Calendario dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 10px)",
          left: 0,
          width: "310px",
          background: "var(--card-bg)",
          border: "1px solid var(--border-card)",
          borderRadius: "20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          padding: "20px",
          zIndex: 100,
        }}>
          <div style={{
            fontSize: "10px", fontWeight: 700, color: "#10b981",
            letterSpacing: "0.12em", textTransform: "uppercase",
            textAlign: "center", marginBottom: "14px",
          }}>
            {hint}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <button type="button" onClick={() => changeMonth(-1)}
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "0 6px" }}>
              ‹
            </button>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)" }}>
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </span>
            <button type="button" onClick={() => changeMonth(1)}
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "0 6px" }}>
              ›
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "6px" }}>
            {WEEKDAYS_SHORT.map((d) => (
              <span key={d} style={{ textAlign: "center", fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, padding: "4px 0" }}>{d}</span>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
            {Array.from({ length: firstDayIndex }).map((_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => renderDay(i + 1))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bar chart with Y-axis grid ────────────────────────────────────────────────
function BarChart({ data, labels, color = "#10b981", chartHeight = 100 }) {
  const max = Math.max(...data, 1)
  const steps = 4

  const gridValues = []
  for (let i = steps; i >= 0; i--) {
    gridValues.push(Math.round((max / steps) * i))
  }

  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", paddingBottom: "20px", flexShrink: 0, width: "22px" }}>
        {gridValues.map((v, i) => (
          <span key={i} style={{ fontSize: "9px", color: "var(--text-muted)", textAlign: "right", lineHeight: 1 }}>{v}</span>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ position: "relative", height: `${chartHeight}px` }}>
          {gridValues.map((_, i) => (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: `${(i / steps) * 100}%`, borderTop: "1px dashed var(--border-sub)", opacity: 0.5 }} />
          ))}
          <div style={{ display: "flex", alignItems: "flex-end", height: "100%", gap: "3px", position: "relative", zIndex: 1 }}>
            {data.map((val, i) => (
              <div key={i} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end", height: "100%" }}>
                <div style={{
                  width: "65%",
                  height: val > 0 ? `${(val / max) * 100}%` : "2px",
                  background: val > 0 ? `linear-gradient(180deg, ${color}cc, ${color})` : "rgba(148,163,184,0.08)",
                  borderRadius: "3px 3px 0 0",
                  minHeight: "2px",
                  transition: "height 0.3s ease",
                }} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", marginTop: "6px", gap: "3px" }}>
          {labels.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "9px", color: "var(--text-muted)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, valueColor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-row)" }}>
      <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>{label}</span>
      <span style={{ color: valueColor || "var(--text-1)", fontWeight: "700", fontSize: "13px" }}>{value}</span>
    </div>
  )
}

export function MetricsPanel({ trades, showPct = false, baseCapital = 0, accountSizeMap = {} }) {
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  useEffect(() => {
    if (trades.length === 0) return
    const sorted = [...trades].sort((a, b) => parseDate(a) - parseDate(b))
    const first = formatIso(parseDate(sorted[0]))
    const last = formatIso(parseDate(sorted[sorted.length - 1]))
    setFromDate(first)
    setToDate(last)
  }, [trades])

  const tradePct = (trade) => {
    const size = accountSizeMap[trade.account] || baseCapital
    const profit = Number(trade.profit || 0)
    return size > 0 ? (profit / size) * 100 : 0
  }

  const fmtVal = (v, getPct) => {
    if (showPct) {
      const pct = getPct ? getPct() : (baseCapital > 0 ? (v / baseCapital) * 100 : 0)
      return fmtP(pct)
    }
    return fmt$(v)
  }

  const filteredTrades = useMemo(() => {
    if (!fromDate || !toDate) return trades
    const from = parseIso(fromDate)
    const to = parseIso(toDate)
    to.setHours(23, 59, 59, 999)
    return trades.filter((t) => {
      const date = parseDate(t)
      return date >= from && date <= to
    })
  }, [trades, fromDate, toDate])

  const stats = useMemo(() => {
    const sorted = [...filteredTrades].sort((a, b) => parseDate(a) - parseDate(b))
    const total = sorted.length
    const wins = sorted.filter((t) => Number(t.profit) > 0)
    const losses = sorted.filter((t) => Number(t.profit) < 0)

    const positiveTotal = wins.reduce((s, t) => s + Number(t.profit), 0)
    const negativeTotal = losses.reduce((s, t) => s + Number(t.profit), 0)
    const avgGain = wins.length ? positiveTotal / wins.length : 0
    const avgLoss = losses.length ? negativeTotal / losses.length : 0
    const winRate = total > 0 ? wins.length / total : 0
    const ev = total > 0 ? (winRate * avgGain) + ((1 - winRate) * avgLoss) : 0
    const profitFactor = negativeTotal ? positiveTotal / Math.abs(negativeTotal) : null
    const maxGain = wins.length ? Math.max(...wins.map((t) => Number(t.profit))) : 0
    const maxLoss = losses.length ? Math.min(...losses.map((t) => Number(t.profit))) : 0
    const winPctTotal = wins.reduce((sum, t) => sum + tradePct(t), 0)
    const lossPctTotal = losses.reduce((sum, t) => sum + tradePct(t), 0)
    const avgGainPct = wins.length ? winPctTotal / wins.length : 0
    const avgLossPct = losses.length ? lossPctTotal / losses.length : 0
    const maxGainPct = wins.length ? Math.max(...wins.map(tradePct)) : 0
    const maxLossPct = losses.length ? Math.min(...losses.map(tradePct)) : 0
    const totalPct = sorted.reduce((sum, t) => sum + tradePct(t), 0)

    // Streaks
    let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0
    const winStreaks = [], lossStreaks = []
    for (const t of sorted) {
      const p = Number(t.profit)
      if (p > 0) { if (curLoss > 0) { lossStreaks.push(curLoss); curLoss = 0 } curWin++; maxWinStreak = Math.max(maxWinStreak, curWin) }
      else if (p < 0) { if (curWin > 0) { winStreaks.push(curWin); curWin = 0 } curLoss++; maxLossStreak = Math.max(maxLossStreak, curLoss) }
      else { if (curWin > 0) { winStreaks.push(curWin); curWin = 0 } if (curLoss > 0) { lossStreaks.push(curLoss); curLoss = 0 } }
    }
    if (curWin > 0) winStreaks.push(curWin)
    if (curLoss > 0) lossStreaks.push(curLoss)
    const avgWinStreak = winStreaks.length ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length : 0
    const avgLossStreak = lossStreaks.length ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length : 0

    // Monthly table
    const monthlyMap = {}
    const monthlyPctMap = {}
    for (const t of sorted) {
      const d = parseDate(t)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      monthlyMap[key] = (monthlyMap[key] || 0) + Number(t.profit || 0)
      monthlyPctMap[key] = (monthlyPctMap[key] || 0) + tradePct(t)
    }
    const years = [...new Set(sorted.map((t) => parseDate(t).getFullYear()))].sort()
    const monthlyRows = years.map((year) => {
      const months = MONTHS.map((_, mi) => monthlyMap[`${year}-${mi}`] ?? null)
      const monthsPct = MONTHS.map((_, mi) => monthlyPctMap[`${year}-${mi}`] ?? null)
      const ytd = months.filter((v) => v !== null).reduce((s, v) => s + v, 0)
      const ytdPct = monthsPct.filter((v) => v !== null).reduce((s, v) => s + v, 0)
      return { year, months, monthsPct, ytd, ytdPct }
    })

    // Frequency
    const byDow = [0,0,0,0,0,0,0]
    const byMonth = Array(12).fill(0)
    const byWeekMap = {}
    for (const t of sorted) {
      const d = parseDate(t)
      byDow[(d.getDay() + 6) % 7]++
      byMonth[d.getMonth()]++
      const startOfYear = new Date(d.getFullYear(), 0, 1)
      const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
      const wKey = `${d.getFullYear()}-W${String(weekNum).padStart(2,"0")}`
      byWeekMap[wKey] = (byWeekMap[wKey] || 0) + 1
    }
    const weekEntries = Object.entries(byWeekMap).sort(([a],[b]) => a.localeCompare(b))
    const byWeekPadded = weekEntries.map(([,v]) => v)
    const weekLabels = weekEntries.map(([k]) => k.split("-W")[1])

    // ── RR Analysis ──────────────────────────────────────────────────────────
    const NEAR_WIN_THRESHOLD = 0.5
    const getTargetRR = (t) => {
      const sl = Number(t.stopLoss)
      const tp = Number(t.takeProfit)
      return sl > 0 && tp > 0 ? tp / sl : 1
    }

    // Pérdidas con data de RR favorable
    const lossesWithFavRR = sorted.filter((t) => Number(t.profit) < 0 && t.maxFavorableRR != null && Number(t.maxFavorableRR) >= 0)
    const nearWins = lossesWithFavRR.filter((t) => Number(t.maxFavorableRR) >= NEAR_WIN_THRESHOLD)
    const deadTrades = lossesWithFavRR.filter((t) => Number(t.maxFavorableRR) < NEAR_WIN_THRESHOLD)
    const avgFavorableRR = lossesWithFavRR.length
      ? lossesWithFavRR.reduce((s, t) => s + Number(t.maxFavorableRR), 0) / lossesWithFavRR.length
      : null
    const lossesWouldWin = avgFavorableRR !== null
      ? lossesWithFavRR.filter((t) => Number(t.maxFavorableRR) >= avgFavorableRR).length
      : 0

    // Ganadores con data de maxRR
    const winnersWithRR = sorted.filter((t) => Number(t.profit) > 0 && t.maxRR != null && Number(t.maxRR) > 0)
    const efficiencies = winnersWithRR.map((t) => Math.min(getTargetRR(t) / Number(t.maxRR), 1))
    const avgEfficiency = efficiencies.length ? efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length : null
    const avgMaxRR = winnersWithRR.length
      ? winnersWithRR.reduce((s, t) => s + Number(t.maxRR), 0) / winnersWithRR.length
      : null
    const winnersReachAvg = avgMaxRR !== null
      ? winnersWithRR.filter((t) => Number(t.maxRR) >= avgMaxRR).length
      : 0
    const rLeftOnTable = winnersWithRR.reduce((s, t) => {
      const target = getTargetRR(t)
      const max = Number(t.maxRR)
      return s + (max > target ? max - target : 0)
    }, 0)

    // Day-of-week performance table
    const dowStats = WEEKDAYS_FULL.map((day, idx) => {
      const dayTrades = sorted.filter((t) => (parseDate(t).getDay() + 6) % 7 === idx)
      const dayWins = dayTrades.filter((t) => Number(t.profit) > 0)
      const dayLosses = dayTrades.filter((t) => Number(t.profit) < 0)
      const pnl = dayTrades.reduce((s, t) => s + Number(t.profit || 0), 0)
      const pnlPct = dayTrades.reduce((s, t) => s + tradePct(t), 0)
      return { day, trades: dayTrades.length, wins: dayWins.length, losses: dayLosses.length, pnl, pnlPct }
    })

    return {
      total, wins: wins.length, losses: losses.length,
      positiveTotal, negativeTotal, avgGain, avgLoss,
      winPctTotal, lossPctTotal, avgGainPct, avgLossPct,
      maxGain, maxLoss, maxGainPct, maxLossPct,
      totalPct,
      winRate, ev, profitFactor,
      maxWinStreak, maxLossStreak, avgWinStreak, avgLossStreak,
      monthlyRows, byDow, byMonth, byWeekPadded, weekLabels,
      monthlyPctMap,
      dowStats,
      lossesWithFavRR: lossesWithFavRR.length, nearWins: nearWins.length, deadTrades: deadTrades.length, avgFavorableRR, lossesWouldWin,
      winnersWithRR: winnersWithRR.length, avgEfficiency, avgMaxRR, rLeftOnTable, winnersReachAvg,
    }
  }, [filteredTrades, accountSizeMap, baseCapital])

  if (trades.length === 0) {
    return <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "60px 0", fontSize: "14px" }}>Sin trades registrados para calcular métricas.</div>
  }

  const s = stats
  const pfColor = s.profitFactor === null ? "var(--text-muted)" : s.profitFactor >= 1 ? "#10b981" : "#f87171"
  const evColor = s.ev >= 0 ? "#10b981" : "#f87171"
  const barTotal = Math.abs(s.positiveTotal) + Math.abs(s.negativeTotal) || 1
  const winBarPct = (s.positiveTotal / barTotal) * 100
  const lossBarPct = (Math.abs(s.negativeTotal) / barTotal) * 100

  const card = {
    background: "var(--card-bg)",
    borderRadius: "18px",
    border: "1px solid var(--border-card)",
    padding: "24px",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

      {/* ── Selector de rango único ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end", justifyContent: "space-between" }}>
        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--card-bg)", border: "1px solid var(--border-card)", borderRadius: "14px", padding: "14px 16px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Trades mostrados</span>
          <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-1)" }}>{filteredTrades.length}</span>
        </div>
      </div>

      {/* ── Row 1: Expectativa + Profit Factor ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "18px" }}>
        <div style={card}>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "6px" }}>Expectativa</div>
          <div style={{ fontSize: "36px", fontWeight: "800", color: evColor, letterSpacing: "-0.02em", marginBottom: "4px" }}>
            {fmtVal(s.ev, () => filteredTrades.length ? filteredTrades.reduce((sum, t) => sum + tradePct(t), 0) / filteredTrades.length : 0)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>Ganancia esperada por trade</div>
          <div style={{ display: "flex", height: "10px", borderRadius: "999px", overflow: "hidden", gap: "3px" }}>
            <div style={{ width: `${winBarPct}%`, background: "linear-gradient(90deg,#10b981,#059669)", borderRadius: "999px", minWidth: s.wins > 0 ? "4px" : 0 }} />
            <div style={{ width: `${lossBarPct}%`, background: "linear-gradient(90deg,#f87171,#ef4444)", borderRadius: "999px", minWidth: s.losses > 0 ? "4px" : 0 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#10b981" }}>{fmtVal(s.positiveTotal, () => s.winPctTotal)}</span>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#f87171" }}>{fmtVal(s.negativeTotal, () => s.lossPctTotal)}</span>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "6px" }}>Profit Factor</div>
          <div style={{ fontSize: "36px", fontWeight: "800", color: pfColor, letterSpacing: "-0.02em", marginBottom: "4px" }}>
            {s.profitFactor !== null ? s.profitFactor.toFixed(2) : "—"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {s.profitFactor === null ? "Sin pérdidas registradas" : s.profitFactor >= 1 ? "Por encima de 1 — operando bien" : "Por debajo de 1 — operar con cuidado"}
          </div>
          <div style={{ marginTop: "20px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px" }}>Win Rate</div>
            <div style={{ height: "6px", borderRadius: "999px", background: "var(--inner-bg)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(s.winRate * 100).toFixed(1)}%`, background: "linear-gradient(90deg,#10b981,#059669)", borderRadius: "999px" }} />
            </div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: s.winRate >= 0.5 ? "#10b981" : "#f87171", marginTop: "6px" }}>
              {(s.winRate * 100).toFixed(1)}% · {s.wins}W / {s.losses}L
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Ganadores + Perdedores ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
        <div style={{ ...card, border: "1px solid rgba(16,185,129,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
            <span style={{ color: "var(--text-1)", fontWeight: "700", fontSize: "15px" }}>Ganadores</span>
          </div>
          <StatRow label="Total ganadores" value={s.wins} />
          <StatRow label="Mejor trade" value={fmtVal(s.maxGain, () => s.maxGainPct)} valueColor="#10b981" />
          <StatRow label="Promedio ganancia" value={fmtVal(s.avgGain, () => s.avgGainPct)} valueColor="#10b981" />
          <StatRow label="Max. racha ganadora" value={s.maxWinStreak} />
          <StatRow label="Prom. racha ganadora" value={s.avgWinStreak.toFixed(2)} />
        </div>
        <div style={{ ...card, border: "1px solid rgba(248,113,113,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f87171" }} />
            <span style={{ color: "var(--text-1)", fontWeight: "700", fontSize: "15px" }}>Perdedores</span>
          </div>
          <StatRow label="Total perdedores" value={s.losses} />
          <StatRow label="Peor trade" value={fmtVal(s.maxLoss, () => s.maxLossPct)} valueColor="#f87171" />
          <StatRow label="Promedio pérdida" value={fmtVal(s.avgLoss, () => s.avgLossPct)} valueColor="#f87171" />
          <StatRow label="Max. racha perdedora" value={s.maxLossStreak} />
          <StatRow label="Prom. racha perdedora" value={s.avgLossStreak.toFixed(2)} />
        </div>
      </div>

      {/* ── Row 3: Análisis de RR ── */}
      {(s.lossesWithFavRR > 0 || s.winnersWithRR > 0) && (
        <div>
          <h3 style={{ color: "var(--text-1)", fontSize: "15px", fontWeight: "700", margin: "0 0 14px" }}>Análisis de RR</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px" }}>

            {/* Card 1 — Calidad de pérdidas */}
            <div style={{ ...card, border: "1px solid rgba(248,113,113,0.2)" }}>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.13em", marginBottom: "14px" }}>
                Calidad de pérdidas
              </div>
              {s.lossesWithFavRR > 0 ? (
                <>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    <div style={{ flex: 1, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: "24px", fontWeight: "800", color: "#f59e0b" }}>{s.nearWins}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", fontWeight: "600" }}>Casi ganadoras</div>
                      <div style={{ fontSize: "9px", color: "rgba(245,158,11,0.7)", marginTop: "2px" }}>≥ 0.5R a favor</div>
                    </div>
                    <div style={{ flex: 1, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: "24px", fontWeight: "800", color: "#f87171" }}>{s.deadTrades}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", fontWeight: "600" }}>Sin dirección</div>
                      <div style={{ fontSize: "9px", color: "rgba(248,113,113,0.7)", marginTop: "2px" }}>&lt; 0.5R a favor</div>
                    </div>
                  </div>
                  <div style={{ height: "6px", borderRadius: "999px", background: "var(--inner-bg)", overflow: "hidden", marginBottom: "8px" }}>
                    <div style={{ height: "100%", width: `${s.lossesWithFavRR > 0 ? (s.nearWins / s.lossesWithFavRR) * 100 : 0}%`, background: "linear-gradient(90deg,#f59e0b,#d97706)", borderRadius: "999px" }} />
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {s.avgFavorableRR !== null && (
                      <>
                        <span style={{ display: "block", color: "#f59e0b", fontWeight: "600" }}>
                          Prom. RR favorable: {s.avgFavorableRR.toFixed(2)}R
                        </span>
                        <span style={{ display: "block", marginTop: "4px", color: "#10b981", fontWeight: "600" }}>
                          {s.lossesWouldWin} de {s.losses} pérdidas totales habrían ganado con TP en {s.avgFavorableRR.toFixed(2)}R
                        </span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Sin datos de RR favorable en pérdidas</div>
              )}
            </div>

            {/* Card 2 — Eficiencia de captura */}
            <div style={{ ...card, border: "1px solid rgba(96,165,250,0.2)" }}>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.13em", marginBottom: "14px" }}>
                Eficiencia de captura
              </div>
              {s.winnersWithRR > 0 && s.avgEfficiency !== null ? (
                <>
                  <div style={{ fontSize: "36px", fontWeight: "800", color: s.avgEfficiency >= 0.6 ? "#10b981" : s.avgEfficiency >= 0.4 ? "#f59e0b" : "#f87171", letterSpacing: "-0.02em", marginBottom: "4px" }}>
                    {(s.avgEfficiency * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
                    {s.avgEfficiency >= 0.7 ? "Capturás bien el movimiento" : s.avgEfficiency >= 0.45 ? "Salís antes del máximo" : "Salís muy antes del máximo"}
                  </div>
                  <div style={{ height: "6px", borderRadius: "999px", background: "var(--inner-bg)", overflow: "hidden", marginBottom: "10px" }}>
                    <div style={{ height: "100%", width: `${(s.avgEfficiency * 100).toFixed(0)}%`, background: s.avgEfficiency >= 0.6 ? "linear-gradient(90deg,#10b981,#059669)" : s.avgEfficiency >= 0.4 ? "linear-gradient(90deg,#f59e0b,#d97706)" : "linear-gradient(90deg,#f87171,#ef4444)", borderRadius: "999px" }} />
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.winnersWithRR} ganadores analizados</div>
                </>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Sin datos de RR máximo en ganadores</div>
              )}
            </div>

            {/* Card 3 — TP óptimo + R dejado en la mesa */}
            <div style={{ ...card, border: "1px solid rgba(168,85,247,0.2)" }}>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.13em", marginBottom: "14px" }}>
                TP óptimo histórico
              </div>
              {s.winnersWithRR > 0 && s.avgMaxRR !== null ? (
                <>
                  <div style={{ fontSize: "36px", fontWeight: "800", color: "#a855f7", letterSpacing: "-0.02em", marginBottom: "4px" }}>
                    {s.avgMaxRR.toFixed(2)}R
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "18px" }}>
                    Promedio RR máximo alcanzado en ganadores
                    <span style={{ display: "block", marginTop: "4px", fontWeight: "600", color: "#a855f7" }}>
                      {s.winnersReachAvg} de {s.winnersWithRR} habrían llegado a {s.avgMaxRR !== null ? s.avgMaxRR.toFixed(2) : "—"}R
                    </span>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: "12px", background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.15)" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>R dejado en la mesa</div>
                    <div style={{ fontSize: "20px", fontWeight: "800", color: "#a855f7" }}>
                      {s.rLeftOnTable.toFixed(2)}R
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>acumulado en {s.winnersWithRR} ganadores</div>
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Sin datos de RR máximo en ganadores</div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── Row 4: Monthly table ── */}
      {s.monthlyRows.length > 0 && (
        <div style={card}>
          <h3 style={{ margin: "0 0 18px", color: "var(--text-1)", fontSize: "15px", fontWeight: "700" }}>Rendimiento mensual</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "700px" }}>
              <thead>
                <tr>
                  <th style={{ color: "var(--text-muted)", fontWeight: "600", textAlign: "left", padding: "6px 10px 10px 0", letterSpacing: "0.06em" }}>Año</th>
                  {MONTHS.map((m) => (
                    <th key={m} style={{ color: "var(--text-muted)", fontWeight: "600", textAlign: "center", padding: "6px 6px 10px", letterSpacing: "0.06em" }}>{m}</th>
                  ))}
                  <th style={{ color: "var(--text-muted)", fontWeight: "600", textAlign: "center", padding: "6px 0 10px 6px", letterSpacing: "0.06em" }}>YTD</th>
                </tr>
              </thead>
              <tbody>
                {s.monthlyRows.map(({ year, months, monthsPct, ytd, ytdPct }) => (
                  <tr key={year}>
                    <td style={{ color: "var(--text-1)", fontWeight: "700", padding: "8px 10px 8px 0" }}>{year}</td>
                    {months.map((val, i) => (
                      <td key={i} style={{ textAlign: "center", padding: "8px 6px" }}>
                        {val === null ? (
                          <span style={{ color: "var(--text-muted)", opacity: 0.4 }}>—</span>
                        ) : (
                          <span style={{ color: val >= 0 ? "#10b981" : "#f87171", fontWeight: "600" }}>
                            {fmtVal(val, () => monthsPct[i] ?? 0)}
                          </span>
                        )}
                      </td>
                    ))}
                    <td style={{ textAlign: "center", padding: "8px 0 8px 6px" }}>
                      <span style={{ color: ytd >= 0 ? "#10b981" : "#f87171", fontWeight: "700" }}>
                        {fmtVal(ytd, () => ytdPct)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Row 4: Frequency charts ── */}
      <div>
        <h3 style={{ color: "var(--text-1)", fontSize: "15px", fontWeight: "700", margin: "0 0 14px" }}>Frecuencia de trades</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px" }}>
          <div style={card}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "16px" }}>Por día de semana</div>
            <BarChart data={s.byDow} labels={WEEKDAYS_SHORT} color="#10b981" chartHeight={100} />
          </div>
          <div style={card}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "16px" }}>Por semana</div>
            <BarChart data={s.byWeekPadded} labels={s.weekLabels} color="#10b981" chartHeight={100} />
          </div>
          <div style={card}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "16px" }}>Por mes</div>
            <BarChart data={s.byMonth} labels={MONTHS} color="#10b981" chartHeight={100} />
          </div>
        </div>
      </div>

      {/* ── Row 5: Performance by day of week table ── */}
      <div style={card}>
        <h3 style={{ margin: "0 0 18px", color: "var(--text-1)", fontSize: "15px", fontWeight: "700" }}>
          Rendimiento por día de semana
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-sub)" }}>
                {["Día","Trades","Ganados","Perdidos","Win Rate","P&L Total"].map((col) => (
                  <th
                    key={col}
                    style={{
                      color: "var(--text-muted)",
                      fontWeight: "600",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.10em",
                      padding: "8px 12px 12px",
                      textAlign: col === "Día" ? "left" : "right",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.dowStats.map(({ day, trades, wins, losses, pnl, pnlPct }, i) => {
                const wr = trades > 0 ? ((wins / trades) * 100).toFixed(0) : "—"
                return (
                  <tr key={day} style={{ borderBottom: i < 6 ? "1px solid var(--border-row)" : "none" }}>
                    <td style={{ padding: "12px 12px", color: "var(--text-1)", fontWeight: "700" }}>{day}</td>
                    <td style={{ padding: "12px 12px", textAlign: "right", color: "var(--text-2)", fontWeight: "600" }}>
                      {trades || "—"}
                    </td>
                    <td style={{ padding: "12px 12px", textAlign: "right", color: wins > 0 ? "#10b981" : "var(--text-muted)", fontWeight: "600" }}>
                      {wins || "—"}
                    </td>
                    <td style={{ padding: "12px 12px", textAlign: "right", color: losses > 0 ? "#f87171" : "var(--text-muted)", fontWeight: "600" }}>
                      {losses || "—"}
                    </td>
                    <td style={{ padding: "12px 12px", textAlign: "right" }}>
                      {trades > 0 ? (
                        <span style={{
                          display: "inline-block", padding: "3px 10px", borderRadius: "999px",
                          fontSize: "11px", fontWeight: "700",
                          background: Number(wr) >= 50 ? "rgba(16,185,129,0.12)" : "rgba(248,113,113,0.12)",
                          color: Number(wr) >= 50 ? "#10b981" : "#f87171",
                        }}>
                          {wr}%
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: "700", color: pnl > 0 ? "#10b981" : pnl < 0 ? "#f87171" : "var(--text-muted)" }}>
                      {trades > 0 ? fmtVal(pnl, () => pnlPct) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border-sub)" }}>
                <td style={{ padding: "12px 12px", color: "var(--text-muted)", fontWeight: "700", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total</td>
                <td style={{ padding: "12px 12px", textAlign: "right", color: "var(--text-1)", fontWeight: "700" }}>{s.total}</td>
                <td style={{ padding: "12px 12px", textAlign: "right", color: "#10b981", fontWeight: "700" }}>{s.wins}</td>
                <td style={{ padding: "12px 12px", textAlign: "right", color: "#f87171", fontWeight: "700" }}>{s.losses}</td>
                <td style={{ padding: "12px 12px", textAlign: "right" }}>
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "700", background: s.winRate >= 0.5 ? "rgba(16,185,129,0.12)" : "rgba(248,113,113,0.12)", color: s.winRate >= 0.5 ? "#10b981" : "#f87171" }}>
                    {(s.winRate * 100).toFixed(0)}%
                  </span>
                </td>
                <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: "700", color: s.ev >= 0 ? "#10b981" : "#f87171" }}>
                  {fmtVal(s.positiveTotal + s.negativeTotal, () => s.totalPct)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  )
}
