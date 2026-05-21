import { useState, useRef, useEffect, useMemo } from "react"
import { List } from "react-window"

const searchIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const pillBtn = (active, color, bg) => ({
  padding: "7px 18px",
  borderRadius: "999px",
  border: `1px solid ${active ? color : "rgba(148, 163, 184, 0.13)"}`,
  background: active ? bg : "transparent",
  color: active ? color : "var(--text-muted)",
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "12px",
  transition: "all 0.12s",
})

const fmtDate = (dateStr, id) => {
  try {
    if (dateStr) {
      const [y, m, d] = dateStr.split("-").map(Number)
      return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
        day: "numeric", month: "short", year: "numeric",
      })
    }
    return new Date(Number(id)).toLocaleDateString("es-ES", {
      day: "numeric", month: "short", year: "numeric",
    })
  } catch {
    return dateStr || "—"
  }
}

const setupLabels = { malo: "Setup Malo", bueno: "Setup Bueno", perfecto: "Setup Perfecto" }
const setupColors = { malo: "#f87171", bueno: "#94a3b8", perfecto: "#10b981" }

function TradeViewModal({ trade, onClose, showPct, accountSizeMap }) {
  const profit = Number(trade.profit || 0)
  const isWin = profit >= 0
  const isBuy = trade.type === "BUY"
  const size = accountSizeMap[trade.account] || 0
  const pct = size > 0 ? (profit / size) * 100 : null
  const profitLabel = showPct && pct !== null
    ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
    : `${isWin ? "+" : ""}$${Math.abs(profit).toFixed(2)}`
  const setupColor = trade.setupQuality ? setupColors[trade.setupQuality] : null
  const setupLabel = trade.setupQuality ? setupLabels[trade.setupQuality] : null

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card-bg)", borderRadius: "20px",
          border: "1px solid var(--border-card)", width: "100%", maxWidth: "520px",
          maxHeight: "85vh", overflowY: "auto", padding: "28px",
          display: "flex", flexDirection: "column", gap: "20px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-1)" }}>
              {trade.symbol}
            </span>
            <span style={{
              fontSize: "11px", fontWeight: "700", padding: "4px 12px",
              borderRadius: "999px", background: isBuy ? "#10b981" : "#ef4444", color: "#fff",
            }}>
              {isBuy ? "LONG" : "SHORT"}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {/* P&L destacado */}
        <div style={{
          padding: "16px 20px", borderRadius: "14px",
          background: isWin ? "rgba(16,185,129,0.08)" : "rgba(248,113,113,0.08)",
          border: `1px solid ${isWin ? "rgba(16,185,129,0.25)" : "rgba(248,113,113,0.25)"}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Resultado
          </span>
          <span style={{ fontSize: "24px", fontWeight: "800", color: isWin ? "#10b981" : "#f87171" }}>
            {profitLabel}
          </span>
        </div>

        {/* Info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          {[
            { label: "Fecha", value: trade.date || "—" },
            { label: "Hora apertura", value: trade.openTime || "—" },
            { label: "Cuenta", value: trade.account || "—" },
            { label: "Estrategia", value: trade.strategy || "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                {label}
              </span>
              <span style={{ fontSize: "14px", color: "var(--text-1)", fontWeight: "500" }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Setup quality */}
        {setupLabel && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Calidad del setup
            </span>
            <span style={{
              display: "inline-block", fontSize: "12px", fontWeight: "700",
              padding: "5px 14px", borderRadius: "999px",
              background: `${setupColor}18`, color: setupColor,
              border: `1px solid ${setupColor}40`, width: "fit-content",
            }}>
              {setupLabel}
            </span>
          </div>
        )}

        {/* Entry note */}
        {trade.entryNote && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Análisis de entrada
            </span>
            <p style={{
              margin: 0, fontSize: "13px", color: "var(--text-2)", lineHeight: "1.6",
              background: "var(--inner-bg)", borderRadius: "10px", padding: "12px 14px",
            }}>
              {trade.entryNote}
            </p>
          </div>
        )}

        {/* Note */}
        {trade.note && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Notas
            </span>
            <p style={{
              margin: 0, fontSize: "13px", color: "var(--text-2)", lineHeight: "1.6",
              background: "var(--inner-bg)", borderRadius: "10px", padding: "12px 14px",
            }}>
              {trade.note}
            </p>
          </div>
        )}

        {/* Images */}
        {trade.entryImages?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Capturas
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {trade.entryImages.map((img, i) => (
                <img key={i} src={img} alt={`captura-${i}`}
                  style={{ width: "100%", borderRadius: "10px", objectFit: "cover", maxHeight: "220px" }} />
              ))}
            </div>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            marginTop: "4px", padding: "11px", borderRadius: "12px",
            border: "1px solid var(--border-input)", background: "transparent",
            color: "var(--text-muted)", cursor: "pointer", fontSize: "13px", fontWeight: "600",
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}

const ROW_HEIGHT = 58

const gridCols = (showAccountCol, showMaxRR) => {
  if (showAccountCol && showMaxRR) return "28px 140px 1fr 90px 110px 110px 1fr 70px 150px"
  if (showAccountCol)              return "28px 140px 1fr 90px 110px 110px 1fr 150px"
  if (showMaxRR)                   return "28px 140px 1fr 90px 110px 1fr 70px 150px"
  return "28px 140px 1fr 90px 110px 1fr 150px"
}

function RowCheckbox({ checked, onChange }) {
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onChange() }}
      style={{
        width: "16px", height: "16px", borderRadius: "4px", flexShrink: 0,
        border: `1.5px solid ${checked ? "#ef4444" : "rgba(148,163,184,0.3)"}`,
        background: checked ? "#ef4444" : "transparent",
        display: "grid", placeItems: "center", cursor: "pointer",
        transition: "all 0.12s",
      }}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
    </span>
  )
}

function TradeRow({ ariaAttributes, index, style, trades, showAccountCol, showMaxRR, showPct, accountSizeMap, onEditTrade, onDeleteTrade, setViewingTrade, selectedIds, onToggleSelect }) {
  const trade = trades[index]
  const profit = Number(trade.profit)
  const isWin = profit >= 0
  const isBuy = trade.type === "BUY"
  const [hovered, setHovered] = useState(false)
  const selected = selectedIds.has(trade.id)
  const bulkMode = selectedIds.size >= 2

  return (
    <div
      {...ariaAttributes}
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns: gridCols(showAccountCol, showMaxRR),
        gap: "12px",
        alignItems: "center",
        padding: "0 22px",
        borderBottom: "1px solid rgba(148, 163, 184, 0.05)",
        background: selected ? "rgba(239,68,68,0.04)" : hovered ? "rgba(148,163,184,0.025)" : "transparent",
        transition: "background 0.1s",
        boxSizing: "border-box",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Checkbox */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <RowCheckbox checked={selected} onChange={() => onToggleSelect(trade.id)} />
      </div>

      {/* Date */}
      <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
        {fmtDate(trade.date, trade.id)}
      </div>

      {/* Symbol */}
      <div style={{ color: "var(--text-1)", fontWeight: "700", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
        {trade.symbol}
        {trade.copiedFromId && (
          <span style={{
            fontSize: "9px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px",
            background: "rgba(59,130,246,0.12)", color: "#60a5fa",
            border: "1px solid rgba(59,130,246,0.22)",
            textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0,
          }}>
            Copia
          </span>
        )}
      </div>

      {/* Type badge */}
      <div>
        <span style={{
          fontSize: "11px", fontWeight: "700", padding: "4px 12px",
          borderRadius: "999px", background: isBuy ? "#10b981" : "#ef4444",
          color: "#fff", display: "inline-block",
        }}>
          {isBuy ? "LONG" : "SHORT"}
        </span>
      </div>

      {/* Profit */}
      <div style={{ color: isWin ? "#10b981" : "#f87171", fontWeight: "700", fontSize: "14px" }}>
        {(() => {
          const size = accountSizeMap[trade.account] || 0
          if (showPct && size > 0) {
            const pct = (profit / size) * 100
            return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
          }
          return `${isWin ? "+" : ""}$${Math.abs(profit).toFixed(2)}`
        })()}
      </div>

      {/* Account (solo en vista "todas las cuentas") */}
      {showAccountCol && (
        <div>
          <span style={{
            fontSize: "10px", fontWeight: "700",
            padding: "3px 8px", borderRadius: "999px",
            background: "rgba(16,185,129,0.09)",
            border: "1px solid rgba(16,185,129,0.2)",
            color: "#10b981",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            display: "inline-block", maxWidth: "100px",
          }}>
            {trade.account || "—"}
          </span>
        </div>
      )}

      {/* Notes */}
      <div style={{ color: "var(--text-muted)", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {trade.note || trade.strategy || "—"}
      </div>

      {/* RR Máx */}
      {showMaxRR && (
        <div>
          {trade.maxRR != null && Number(trade.maxRR) > 0 ? (
            <span style={{
              fontSize: "11px", fontWeight: "700",
              padding: "3px 9px", borderRadius: "999px",
              background: "rgba(168,85,247,0.12)",
              color: "#a855f7",
              border: "1px solid rgba(168,85,247,0.25)",
              display: "inline-block",
            }}>
              {Number(trade.maxRR).toFixed(1)}R
            </span>
          ) : (
            <span style={{ color: "rgba(148,163,184,0.35)", fontSize: "12px" }}>—</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
        {!bulkMode && (
          <button
            onClick={() => setViewingTrade(trade)}
            style={{
              background: "transparent", color: "var(--text-muted)",
              border: "1px solid rgba(148, 163, 184, 0.18)", borderRadius: "8px",
              padding: "6px 12px", cursor: "pointer", fontWeight: "600", fontSize: "11px",
            }}
          >
            Ver
          </button>
        )}
        {!bulkMode && (
          trade.copiedFromId ? (
            <span
              title="Editá el trade desde la cuenta maestra"
              style={{
                border: "1px solid rgba(148,163,184,0.10)", borderRadius: "8px",
                padding: "6px 12px", fontWeight: "600", fontSize: "11px",
                color: "rgba(148,163,184,0.35)", cursor: "default", userSelect: "none",
              }}
            >
              Editar
            </span>
          ) : (
            <button
              onClick={() => onEditTrade(trade)}
              style={{
                background: "transparent", color: "var(--text-muted)",
                border: "1px solid rgba(148, 163, 184, 0.18)", borderRadius: "8px",
                padding: "6px 12px", cursor: "pointer", fontWeight: "600", fontSize: "11px",
              }}
            >
              Editar
            </button>
          )
        )}
        <button
          onClick={() => onDeleteTrade(trade.id)}
          style={{
            background: "transparent", color: "#f87171",
            border: "1px solid rgba(248, 113, 113, 0.22)", borderRadius: "8px",
            padding: "6px 12px", cursor: "pointer", fontWeight: "600", fontSize: "11px",
          }}
        >
          Eliminar
        </button>
      </div>
    </div>
  )
}

export function TradeList({
  trades,
  onEditTrade,
  onDeleteTrade,
  onDeleteManyTrades,
  activeAccountName = null,
  showPct = false,
  accountSizeMap = {},
  isReview = false,
}) {
  const showAccountCol = activeAccountName === null
  const showMaxRR = isReview
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("ALL")
  const [viewingTrade, setViewingTrade] = useState(null)
  const [selectedSymbols, setSelectedSymbols] = useState(new Set())
  const [symbolDropdownOpen, setSymbolDropdownOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const symbolDropdownRef = useRef(null)

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    await onDeleteManyTrades([...selectedIds])
    setSelectedIds(new Set())
  }

  const uniqueSymbols = useMemo(() =>
    [...new Set(trades.map((t) => t.symbol).filter(Boolean))].sort(),
    [trades]
  )

  useEffect(() => {
    if (!symbolDropdownOpen) return
    const handler = (e) => {
      if (symbolDropdownRef.current && !symbolDropdownRef.current.contains(e.target))
        setSymbolDropdownOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [symbolDropdownOpen])

  const toggleSymbol = (symbol) => {
    setSelectedSymbols((prev) => {
      const next = new Set(prev)
      if (next.has(symbol)) next.delete(symbol)
      else next.add(symbol)
      return next
    })
  }

  const filteredTrades = trades
    .filter((t) => filter === "ALL" || t.type === filter)
    .filter((t) => selectedSymbols.size === 0 || selectedSymbols.has(t.symbol))
    .filter((t) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        (t.symbol || "").toLowerCase().includes(q) ||
        (t.note || "").toLowerCase().includes(q) ||
        (t.strategy || "").toLowerCase().includes(q) ||
        (t.account || "").toLowerCase().includes(q)
      )
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const listHeight = Math.min(filteredTrades.length * ROW_HEIGHT, 600)

  const rowProps = {
    trades: filteredTrades,
    showAccountCol,
    showMaxRR,
    showPct,
    accountSizeMap,
    onEditTrade,
    onDeleteTrade,
    setViewingTrade,
    selectedIds,
    onToggleSelect: toggleSelect,
  }

  return (
    <div
      style={{
        background: "var(--card-bg)",
        borderRadius: "20px",
        border: "1px solid rgba(148, 163, 184, 0.08)",
        overflow: "hidden",
      }}
    >
      {/* Search bar */}
      <div style={{ padding: "18px 22px 0" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex" }}>
            {searchIcon}
          </span>
          <input
            placeholder="Buscar por activo o notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "var(--inner-bg)", border: "1px solid rgba(148, 163, 184, 0.10)",
              borderRadius: "12px", color: "var(--text-1)",
              padding: "11px 14px 11px 38px", fontSize: "13px",
              outline: "none", fontFamily: "Inter, Arial, sans-serif",
            }}
          />
        </div>
      </div>

      {/* Filters + count */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            {filteredTrades.length} operaciones
          </span>
          {selectedIds.size >= 2 && (
            <button
              onClick={handleBulkDelete}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 14px", borderRadius: "8px", cursor: "pointer",
                background: "rgba(239,68,68,0.1)", color: "#f87171",
                border: "1px solid rgba(239,68,68,0.25)", fontWeight: "700", fontSize: "12px",
                transition: "all 0.12s",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              Eliminar {selectedIds.size} seleccionados
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setFilter("ALL")} style={pillBtn(filter === "ALL", "#10b981", "rgba(16,185,129,0.12)")}>Todos</button>
          <button onClick={() => setFilter("BUY")} style={pillBtn(filter === "BUY", "#60a5fa", "rgba(59,130,246,0.12)")}>LONG</button>
          <button onClick={() => setFilter("SELL")} style={pillBtn(filter === "SELL", "#f87171", "rgba(239,68,68,0.12)")}>SHORT</button>

          {/* Filtro por par/activo */}
          <div ref={symbolDropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setSymbolDropdownOpen((v) => !v)}
              style={{
                ...pillBtn(selectedSymbols.size > 0, "#f59e0b", "rgba(245,158,11,0.12)"),
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              Activos
              {selectedSymbols.size > 0 && (
                <span style={{
                  background: "#f59e0b", color: "#000", borderRadius: "999px",
                  fontSize: "10px", fontWeight: "800", padding: "1px 6px", lineHeight: 1.4,
                }}>
                  {selectedSymbols.size}
                </span>
              )}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: symbolDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {symbolDropdownOpen && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)",
                background: "var(--card-bg)", border: "1px solid var(--border-input)",
                borderRadius: "14px", zIndex: 50, minWidth: "180px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)", overflow: "hidden",
              }}>
                {selectedSymbols.size > 0 && (
                  <button
                    onClick={() => setSelectedSymbols(new Set())}
                    style={{
                      width: "100%", padding: "10px 14px", background: "rgba(245,158,11,0.08)",
                      border: "none", borderBottom: "1px solid var(--border-input)",
                      color: "#f59e0b", fontWeight: "700", fontSize: "12px",
                      cursor: "pointer", textAlign: "left", fontFamily: "Inter, Arial, sans-serif",
                    }}
                  >
                    Limpiar filtro ({selectedSymbols.size})
                  </button>
                )}
                <div style={{ maxHeight: "260px", overflowY: "auto" }}>
                  {uniqueSymbols.map((sym) => {
                    const active = selectedSymbols.has(sym)
                    return (
                      <button
                        key={sym}
                        onClick={() => toggleSymbol(sym)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: "10px",
                          padding: "9px 14px", border: "none",
                          background: active ? "rgba(245,158,11,0.08)" : "transparent",
                          color: active ? "#f59e0b" : "var(--text-1)",
                          fontWeight: active ? "700" : "500", fontSize: "13px",
                          cursor: "pointer", textAlign: "left", fontFamily: "Inter, Arial, sans-serif",
                          borderBottom: "1px solid rgba(148,163,184,0.05)",
                          transition: "background 0.1s",
                        }}
                      >
                        <span style={{
                          width: "14px", height: "14px", borderRadius: "4px", flexShrink: 0,
                          border: `1.5px solid ${active ? "#f59e0b" : "rgba(148,163,184,0.3)"}`,
                          background: active ? "#f59e0b" : "transparent",
                          display: "grid", placeItems: "center",
                        }}>
                          {active && (
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </span>
                        {sym}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridCols(showAccountCol, showMaxRR),
          gap: "12px",
          padding: "10px 22px",
          borderTop: "1px solid rgba(148, 163, 184, 0.07)",
          borderBottom: "1px solid rgba(148, 163, 184, 0.07)",
          color: "var(--text-muted)",
          fontSize: "10px",
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          alignItems: "center",
        }}
      >
        <div>
          {(() => {
            const allSelected = filteredTrades.length > 0 && filteredTrades.every((t) => selectedIds.has(t.id))
            const someSelected = filteredTrades.some((t) => selectedIds.has(t.id))
            return (
              <span
                onClick={() => {
                  if (allSelected) setSelectedIds(new Set())
                  else setSelectedIds(new Set(filteredTrades.map((t) => t.id)))
                }}
                style={{
                  width: "16px", height: "16px", borderRadius: "4px",
                  border: `1.5px solid ${someSelected ? "#ef4444" : "rgba(148,163,184,0.3)"}`,
                  background: allSelected ? "#ef4444" : someSelected ? "rgba(239,68,68,0.3)" : "transparent",
                  display: "grid", placeItems: "center", cursor: "pointer", transition: "all 0.12s",
                }}
              >
                {(allSelected || someSelected) && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    {allSelected
                      ? <polyline points="20 6 9 17 4 12"/>
                      : <line x1="5" y1="12" x2="19" y2="12"/>
                    }
                  </svg>
                )}
              </span>
            )
          })()}
        </div>
        <div>Fecha</div>
        <div>Activo</div>
        <div>Tipo</div>
        <div>Resultado</div>
        {showAccountCol && <div>Cuenta</div>}
        <div>Notas</div>
        {showMaxRR && <div style={{ color: "#a855f7" }}>RR Máx</div>}
        <div style={{ textAlign: "right" }}>Acciones</div>
      </div>

      {/* Modal Ver trade */}
      {viewingTrade && (
        <TradeViewModal
          trade={viewingTrade}
          onClose={() => setViewingTrade(null)}
          showPct={showPct}
          accountSizeMap={accountSizeMap}
        />
      )}

      {/* Virtualized rows */}
      {filteredTrades.length === 0 ? (
        <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "48px", fontSize: "13px" }}>
          No hay trades para mostrar
        </div>
      ) : (
        <List
          rowComponent={TradeRow}
          rowCount={filteredTrades.length}
          rowHeight={ROW_HEIGHT}
          rowProps={rowProps}
          style={{ height: listHeight, outline: "none" }}
        />
      )}
    </div>
  )
}
