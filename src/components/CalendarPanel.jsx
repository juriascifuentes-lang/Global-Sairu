import { useMemo, useState } from "react"

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

const navButtonStyle = {
  border: "1px solid var(--border-input)",
  background: "var(--card-bg)",
  color: "var(--text-muted)",
  borderRadius: "10px",
  width: "34px",
  height: "34px",
  cursor: "pointer",
  fontSize: "15px",
  display: "grid",
  placeItems: "center",
}

const setupQualityLabels = {
  malo: { label: "Setup Malo", color: "#f87171" },
  bueno: { label: "Setup Bueno", color: "#94a3b8" },
  perfecto: { label: "Setup Perfecto", color: "#10b981" },
}

function TradeDetail({ trade, onBack }) {
  const [lightbox, setLightbox] = useState(null)
  const profit = Number(trade.profit)
  const fmt = (v) => (v >= 0 ? "+" : "") + "$" + Math.abs(v).toFixed(2)
  const sq = trade.setupQuality ? setupQualityLabels[trade.setupQuality] : null

  const row = (label, value) =>
    value ? (
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          {label}
        </div>
        <div style={{ fontSize: "14px", color: "var(--text-1)", fontWeight: "500" }}>{value}</div>
      </div>
    ) : null

  return (
    <>
      {/* Back button in header — rendered by parent */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* P&L destacado */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            background: profit >= 0 ? "rgba(16,185,129,0.08)" : "rgba(248,113,113,0.08)",
            borderRadius: "12px",
            border: `1px solid ${profit >= 0 ? "rgba(16,185,129,0.25)" : "rgba(248,113,113,0.25)"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-1)" }}>
              {trade.symbol}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "700",
                padding: "3px 9px",
                borderRadius: "999px",
                background: trade.type === "BUY" ? "#10b981" : "#ef4444",
                color: "#fff",
              }}
            >
              {trade.type === "BUY" ? "LONG" : "SHORT"}
            </span>
          </div>
          <span style={{ fontSize: "20px", fontWeight: "800", color: profit >= 0 ? "#10b981" : "#f87171" }}>
            {fmt(profit)}
          </span>
        </div>

        {/* Datos del trade */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {row("Fecha", trade.date)}
          {row("Hora apertura", trade.openTime)}
          {row("Cuenta", trade.account)}
          {row("Estrategia", trade.strategy)}
        </div>

        {/* Setup quality */}
        {sq && (
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Calidad del setup
            </div>
            <span
              style={{
                display: "inline-block",
                fontSize: "12px",
                fontWeight: "700",
                padding: "4px 12px",
                borderRadius: "999px",
                background: `${sq.color}15`,
                color: sq.color,
                border: `1px solid ${sq.color}40`,
                alignSelf: "flex-start",
              }}
            >
              {sq.label}
            </span>
          </div>
        )}

        {/* Nota de entrada */}
        {trade.entryNote && (
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Análisis de entrada
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "var(--text-1)",
                lineHeight: "1.55",
                background: "var(--inner-bg)",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid var(--border-input)",
              }}
            >
              {trade.entryNote}
            </div>
          </div>
        )}

        {/* Imágenes de entrada */}
        {trade.entryImages && trade.entryImages.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {trade.entryImages.map((src, i) => (
              <div
                key={i}
                onClick={() => setLightbox(src)}
                style={{
                  borderRadius: "10px",
                  overflow: "hidden",
                  border: "1px solid var(--border-input)",
                  aspectRatio: "16/10",
                  cursor: "zoom-in",
                }}
              >
                <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            ))}
          </div>
        )}

        {/* Nota general */}
        {trade.note && trade.note !== "Importado desde MT5" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Notas
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.55" }}>
              {trade.note}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            cursor: "zoom-out",
            padding: "24px",
          }}
        >
          <img src={lightbox} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "10px", objectFit: "contain" }} />
        </div>
      )}
    </>
  )
}

function DayModal({ dateLabel, dayTrades, onClose }) {
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [selectedTrade, setSelectedTrade] = useState(null)

  const accountGroups = useMemo(() => {
    const map = {}
    dayTrades.forEach((t) => {
      const acc = t.account || "Sin cuenta"
      if (!map[acc]) map[acc] = { name: acc, total: 0, trades: [] }
      map[acc].total += Number(t.profit || 0)
      map[acc].trades.push(t)
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [dayTrades])

  const fmt = (v) => (v >= 0 ? "+" : "") + "$" + Math.abs(v).toFixed(2)
  const dayTotal = dayTrades.reduce((s, t) => s + Number(t.profit || 0), 0)

  const accountTrades = selectedAccount
    ? accountGroups.find((g) => g.name === selectedAccount)?.trades || []
    : []

  const handleBack = () => {
    if (selectedTrade) { setSelectedTrade(null); return }
    if (selectedAccount) { setSelectedAccount(null); return }
  }

  const showBack = selectedAccount || selectedTrade

  const headerSub = selectedTrade
    ? `${selectedTrade.symbol} · ${selectedTrade.type}`
    : selectedAccount
    ? selectedAccount
    : dateLabel

  const headerMain = selectedTrade
    ? (() => { const p = Number(selectedTrade.profit); return <span style={{ color: p >= 0 ? "#10b981" : "#f87171" }}>{fmt(p)}</span> })()
    : selectedAccount
    ? "Trades del día"
    : <span style={{ color: dayTotal >= 0 ? "#10b981" : "#f87171" }}>{fmt(dayTotal)}</span>

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card-bg)",
          borderRadius: "20px",
          border: "1px solid rgba(148,163,184,0.12)",
          width: "100%",
          maxWidth: "540px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 22px 16px",
            borderBottom: "1px solid var(--border-sub)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {showBack && (
              <button
                onClick={handleBack}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "16px",
                  padding: "0 4px 0 0",
                  lineHeight: 1,
                }}
              >
                ←
              </button>
            )}
            <div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                {headerSub}
              </div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-1)", marginTop: "2px" }}>
                {headerMain}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "20px",
              lineHeight: 1,
              padding: "0",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "14px 22px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {selectedTrade ? (
            <TradeDetail trade={selectedTrade} />
          ) : !selectedAccount ? (
            // Nivel 1: cuentas
            accountGroups.map((group) => (
              <button
                key={group.name}
                onClick={() => setSelectedAccount(group.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "var(--inner-bg)",
                  border: "1px solid var(--border-input)",
                  borderRadius: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "border-color 0.12s",
                  fontFamily: "Inter, Arial, sans-serif",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#10b981")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-input)")}
              >
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-1)" }}>{group.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {group.trades.length} trade{group.trades.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "15px", fontWeight: "700", color: group.total >= 0 ? "#10b981" : "#f87171" }}>
                    {fmt(group.total)}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>›</span>
                </div>
              </button>
            ))
          ) : (
            // Nivel 2: trades de la cuenta
            accountTrades.map((t, i) => (
              <button
                key={i}
                onClick={() => setSelectedTrade(t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "var(--inner-bg)",
                  border: "1px solid var(--border-input)",
                  borderRadius: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "border-color 0.12s",
                  fontFamily: "Inter, Arial, sans-serif",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#10b981")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-input)")}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-1)" }}>{t.symbol}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: "700",
                        padding: "2px 7px",
                        borderRadius: "999px",
                        background: t.type === "BUY" ? "rgba(16,185,129,0.12)" : "rgba(248,113,113,0.12)",
                        color: t.type === "BUY" ? "#10b981" : "#f87171",
                      }}
                    >
                      {t.type}
                    </span>
                  </div>
                  {t.openTime && (
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{t.openTime}</div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "15px", fontWeight: "700", color: Number(t.profit) >= 0 ? "#10b981" : "#f87171" }}>
                    {fmt(Number(t.profit))}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>›</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function CalendarPanel({ trades, showPct = false, accountSizeMap = {} }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const startDate = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const parseDateString = (value) => {
    if (!value) return null
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d)
  }

  // Compute per-day profit, pct (sum of per-trade %s), and trade list
  const { profitsByDay, pctsByDay, tradesByDay } = useMemo(() => {
    const profits = {}
    const pcts = {}
    const tradeMap = {}

    for (const trade of trades) {
      const tradeDate = trade.date ? parseDateString(trade.date) : new Date(Number(trade.id))
      if (!tradeDate || tradeDate.getFullYear() !== year || tradeDate.getMonth() !== month) continue
      const day = tradeDate.getDate()
      const profit = Number(trade.profit || 0)
      const size = accountSizeMap[trade.account] || 0
      profits[day] = (profits[day] || 0) + profit
      pcts[day] = (pcts[day] || 0) + (size > 0 ? (profit / size) * 100 : 0)
      if (!tradeMap[day]) tradeMap[day] = []
      tradeMap[day].push(trade)
    }

    return { profitsByDay: profits, pctsByDay: pcts, tradesByDay: tradeMap }
  }, [trades, month, year, accountSizeMap])

  // Build flat cells
  const firstDayIndex = (startDate.getDay() + 6) % 7
  const flatCells = []
  for (let i = 0; i < firstDayIndex; i++) flatCells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    flatCells.push({
      day,
      profit: profitsByDay[day] ?? null,
      pct: pctsByDay[day] ?? null,
    })
  }
  while (flatCells.length % 7 !== 0) flatCells.push(null)

  // Group into weeks — totals are sums of per-day values
  const weeks = []
  for (let i = 0; i < flatCells.length; i += 7) {
    const weekCells = flatCells.slice(i, i + 7)
    const activeCells = weekCells.filter((c) => c && c.profit !== null)
    if (activeCells.length === 0) {
      weeks.push({ cells: weekCells, weekTotal: null, weekPct: null })
      continue
    }
    const weekTotal = activeCells.reduce((sum, c) => sum + c.profit, 0)
    const weekPct = activeCells.reduce((sum, c) => sum + (c.pct ?? 0), 0)
    weeks.push({ cells: weekCells, weekTotal, weekPct })
  }

  const monthTotal = Object.values(profitsByDay).reduce((sum, v) => sum + v, 0)
  const monthPct = Object.values(pctsByDay).reduce((sum, v) => sum + v, 0)
  const monthHasTrades = Object.keys(profitsByDay).length > 0

  const handleChangeMonth = (offset) => setCurrentMonth(new Date(year, month + offset, 1))

  // fmtAmt: en modo % usa la suma de %s por-trade ya calculada; en $ usa profit directo
  const fmtAmt = (profit, pct) => {
    if (showPct) {
      if (pct === null || pct === undefined) return "—"
      return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
    }
    if (profit === null) return "—"
    return (profit >= 0 ? "+" : "") + "$" + Math.round(Math.abs(profit))
  }

  const dayCellStyle = (profit, clickable) => ({
    minHeight: "62px",
    borderRadius: "12px",
    border: "1px solid var(--border-sub)",
    background:
      profit === null
        ? "rgba(148, 163, 184, 0.03)"
        : profit > 0
        ? "rgba(16, 185, 129, 0.07)"
        : profit < 0
        ? "rgba(248, 113, 113, 0.07)"
        : "rgba(148, 163, 184, 0.03)",
    padding: "7px 8px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    cursor: clickable ? "pointer" : "default",
    transition: "border-color 0.12s",
  })

  const selectedDayTrades = selectedDay ? (tradesByDay[selectedDay] || []) : []
  const selectedDateLabel = selectedDay
    ? new Date(year, month, selectedDay).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
    : ""

  return (
    <div
      style={{
        background: "var(--card-bg)",
        borderRadius: "20px",
        padding: "22px",
        border: "1px solid var(--border-card)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
            Calendario operativo
          </div>
          <h2 style={{ margin: "4px 0 0", color: "var(--text-1)", fontSize: "18px", fontWeight: "700" }}>
            {currentMonth.toLocaleString("es-ES", { month: "long", year: "numeric" })}
          </h2>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => handleChangeMonth(-1)} style={navButtonStyle}>←</button>
          <button onClick={() => handleChangeMonth(1)} style={navButtonStyle}>→</button>
        </div>
      </div>

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr)) 76px", gap: "6px", marginBottom: "6px" }}>
        {weekdays.map((d) => (
          <div key={d} style={{ color: "var(--text-muted)", fontSize: "10px", fontWeight: "700", textAlign: "center", letterSpacing: "0.06em" }}>
            {d}
          </div>
        ))}
        <div style={{ color: "var(--text-muted)", fontSize: "10px", fontWeight: "700", textAlign: "center", letterSpacing: "0.06em" }}>
          Semana
        </div>
      </div>

      {/* Week rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr)) 76px", gap: "6px", alignItems: "stretch" }}>
            {week.cells.map((cell, ci) =>
              cell ? (
                <div
                  key={ci}
                  style={dayCellStyle(cell.profit, cell.profit !== null)}
                  onClick={() => cell.profit !== null && setSelectedDay(cell.day)}
                  onMouseEnter={(e) => {
                    if (cell.profit !== null) e.currentTarget.style.borderColor = "rgba(148,163,184,0.4)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-sub)"
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)" }}>{cell.day}</div>
                  {cell.profit !== null && (
                    <div style={{ fontSize: "13px", fontWeight: "700", color: cell.profit >= 0 ? "#10b981" : "#f87171", lineHeight: 1 }}>
                      {fmtAmt(cell.profit, cell.pct)}
                    </div>
                  )}
                </div>
              ) : (
                <div key={ci} />
              )
            )}

            {/* Weekly total */}
            <div
              style={{
                borderRadius: "12px",
                border: week.weekTotal === null
                  ? "1px dashed var(--border-sub)"
                  : week.weekTotal > 0
                  ? "1px solid rgba(16,185,129,0.30)"
                  : week.weekTotal < 0
                  ? "1px solid rgba(248,113,113,0.30)"
                  : "1px solid var(--border-sub)",
                background: week.weekTotal === null
                  ? "transparent"
                  : week.weekTotal > 0
                  ? "rgba(16,185,129,0.06)"
                  : week.weekTotal < 0
                  ? "rgba(248,113,113,0.06)"
                  : "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                padding: "6px 4px",
                minHeight: "62px",
              }}
            >
              {week.weekTotal !== null ? (
                <>
                  <div style={{ fontSize: "8px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", lineHeight: 1 }}>
                    Total
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "800",
                      color: week.weekTotal >= 0 ? "#10b981" : "#f87171",
                      textAlign: "center",
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtAmt(week.weekTotal, week.weekPct)}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: "9px", color: "var(--text-muted)", opacity: 0.4 }}>—</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Monthly summary footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-sub)" }}>
        {monthHasTrades ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 16px",
              borderRadius: "12px",
              background: monthTotal >= 0 ? "rgba(16,185,129,0.08)" : "rgba(248,113,113,0.08)",
              border: `1px solid ${monthTotal >= 0 ? "rgba(16,185,129,0.25)" : "rgba(248,113,113,0.25)"}`,
            }}
          >
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.10em" }}>
              Mes total
            </span>
            <span style={{ fontSize: "16px", fontWeight: "800", color: monthTotal >= 0 ? "#10b981" : "#f87171", letterSpacing: "-0.01em" }}>
              {fmtAmt(monthTotal, monthPct)}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Sin operaciones este mes</span>
        )}
      </div>

      {/* Modal */}
      {selectedDay && (
        <DayModal
          dateLabel={selectedDateLabel}
          dayTrades={selectedDayTrades}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}
