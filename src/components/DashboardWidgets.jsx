// RecentTradesWidget
export function RecentTradesWidget({ trades, onNavigate, showPct = false, accountSizeMap = {} }) {
  const recent = trades.slice(0, 8)

  return (
    <div style={{ background: "var(--card-bg)", borderRadius: "20px", padding: "20px 22px", border: "1px solid var(--border-card)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em" }}>Historial</div>
          <h3 style={{ margin: "3px 0 0", color: "var(--text-1)", fontSize: "15px", fontWeight: "700" }}>Trades recientes</h3>
        </div>
        <button onClick={() => onNavigate("TRADES")} style={{ background: "none", border: "none", color: "#10b981", cursor: "pointer", fontSize: "12px", fontWeight: "600", padding: "4px 0" }}>
          Ver todos →
        </button>
      </div>

      {recent.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "24px 0" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Sin trades registrados</div>
          <button onClick={() => onNavigate("TRADES")} style={{ background: "rgba(16, 185, 129, 0.10)", border: "1px solid rgba(16, 185, 129, 0.22)", color: "#10b981", borderRadius: "10px", padding: "8px 16px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
            Agregar trade
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {recent.map((trade) => {
            const profit = Number(trade.profit)
            const isWin = profit >= 0
            const isBuy = trade.type === "BUY"
            return (
              <div key={trade.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-row)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: isWin ? "#10b981" : "#f87171", flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "var(--text-1)", fontWeight: "700", fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {trade.symbol}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "10px", marginTop: "1px" }}>{trade.date || "—"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", flexShrink: 0 }}>
                  <span style={{
                    fontSize: "9px", fontWeight: "700", padding: "2px 7px", borderRadius: "999px",
                    background: isBuy ? "rgba(59,130,246,0.12)" : "rgba(249,115,22,0.12)",
                    color: isBuy ? "#3b82f6" : "#f97316",
                  }}>
                    {trade.type}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: isWin ? "#10b981" : "#f87171" }}>
                    {(() => {
                      const size = accountSizeMap[trade.account] || 0
                      if (showPct && size > 0) {
                        const pct = (profit / size) * 100
                        return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
                      }
                      return `${isWin ? "+" : ""}$${Math.abs(profit).toFixed(2)}`
                    })()}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// AccountROIWidget
export function AccountROIWidget({ accounts, withdrawals, onNavigate }) {
  const totalInvested = accounts.reduce((s, a) => s + (parseFloat(a.cost) || 0), 0)
  const totalWithdrawn = withdrawals.reduce((s, w) => s + Number(w.amount || 0), 0)
  const roi = totalInvested > 0 ? ((totalWithdrawn - totalInvested) / totalInvested) * 100 : null
  const roiLabel = roi === null ? "—" : `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`
  const roiColor = roi === null ? "var(--text-muted)" : roi >= 0 ? "#10b981" : "#f87171"

  const barMax = Math.max(totalInvested, totalWithdrawn, 1)
  const investedH = Math.round((totalInvested / barMax) * 120)
  const withdrawnH = Math.round((totalWithdrawn / barMax) * 120)

  return (
    <div style={{ background: "var(--card-bg)", borderRadius: "20px", padding: "22px", border: "1px solid var(--border-card)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "var(--text-1)", fontSize: "15px", fontWeight: "700" }}>ROI de Cuentas</h3>
        <button onClick={() => onNavigate("ROI_ACCOUNTS")} style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.22)", color: "#10b981", borderRadius: "10px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
          Ver detalle →
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "4px" }}>Invertido</div>
          <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>${totalInvested.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "4px" }}>Retirado</div>
          <div style={{ fontSize: "18px", fontWeight: "800", color: "#10b981", letterSpacing: "-0.02em" }}>${totalWithdrawn.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "4px" }}>ROI</div>
          <div style={{ fontSize: "18px", fontWeight: "800", color: roiColor, letterSpacing: "-0.02em" }}>{roiLabel}</div>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "16px" }}>
        {/* Y axis labels */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "140px", paddingBottom: "20px", flexShrink: 0 }}>
          {[barMax, barMax * 0.75, barMax * 0.5, barMax * 0.25, 0].map((v) => (
            <span key={v} style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "right", lineHeight: 1 }}>${Math.round(v)}</span>
          ))}
        </div>
        {/* Bars */}
        <div style={{ display: "flex", gap: "48px", alignItems: "flex-end", height: "140px", flex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "60px", height: `${investedH}px`, background: "linear-gradient(180deg,#f87171,#ef4444)", borderRadius: "6px 6px 0 0", transition: "height 0.4s ease" }} />
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Invertido</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "60px", height: `${withdrawnH}px`, background: "linear-gradient(180deg,#10b981,#059669)", borderRadius: "6px 6px 0 0", transition: "height 0.4s ease" }} />
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Retirado</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// LastWithdrawalsWidget
export function LastWithdrawalsWidget({ withdrawals, onNavigate }) {
  const recent = withdrawals.slice(0, 4)
  const total = withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0)

  return (
    <div style={{ background: "var(--card-bg)", borderRadius: "20px", padding: "22px", border: "1px solid var(--border-card)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em" }}>Retiros</div>
          <h3 style={{ margin: "4px 0 0", color: "var(--text-1)", fontSize: "15px", fontWeight: "700" }}>Últimos retiros</h3>
        </div>
        {withdrawals.length > 0 && (
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#10b981" }}>+${total.toFixed(2)}</span>
        )}
      </div>
      {recent.length === 0 ? (
        <div style={{ textAlign: "center", padding: "14px 0" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "12px" }}>Sin retiros registrados</div>
          <button onClick={() => onNavigate("WITHDRAWALS")} style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.22)", color: "#10b981", borderRadius: "10px", padding: "8px 16px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
            Registrar retiro
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {recent.map((w) => (
            <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--border-row)" }}>
              <div>
                <div style={{ color: "var(--text-2)", fontSize: "13px", fontWeight: "600" }}>{w.account || "Sin cuenta"}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "1px" }}>{w.date}</div>
              </div>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#10b981" }}>+${Number(w.amount || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
