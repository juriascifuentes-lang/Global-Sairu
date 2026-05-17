export function ROIAccountsPanel({ accounts, withdrawals }) {
  const rows = accounts.map((acc) => {
    const invested = parseFloat(acc.cost) || 0
    const withdrawn = withdrawals
      .filter((w) => w.account === acc.name)
      .reduce((sum, w) => sum + Number(w.amount || 0), 0)
    const roi = invested > 0 ? ((withdrawn - invested) / invested) * 100 : null
    return {
      name: acc.name,
      broker: acc.broker === "Otro" ? acc.brokerCustom || "—" : acc.broker || "—",
      type: acc.capitalType || "—",
      size: acc.size ? `$${Number(acc.size).toLocaleString()}` : "—",
      invested,
      withdrawn,
      roi,
    }
  })

  const totalInvested = rows.reduce((s, r) => s + r.invested, 0)
  const totalWithdrawn = rows.reduce((s, r) => s + r.withdrawn, 0)
  const globalROI = totalInvested > 0 ? ((totalWithdrawn - totalInvested) / totalInvested) * 100 : null

  const fmtMoney = (n) => `$${n.toFixed(2)}`
  const fmtROI = (n) => (n === null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`)

  const roiColor = (n) => (n === null ? "var(--text-muted)" : n >= 0 ? "#10b981" : "#f87171")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
          Rendimiento por cuenta
        </p>
        <h1 style={{ margin: "8px 0 6px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
          ROI de Cuentas
        </h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
          Retorno sobre inversión por cuenta y totales globales
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
        {[
          { label: "TOTAL INVERTIDO", value: fmtMoney(totalInvested) },
          { label: "TOTAL RETIRADO", value: fmtMoney(totalWithdrawn), green: true },
          { label: "ROI GLOBAL", value: fmtROI(globalROI), roi: globalROI },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "var(--card-bg)",
              border: "1px solid rgba(148,163,184,0.08)",
              borderRadius: "16px",
              padding: "20px 24px",
            }}
          >
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "10px" }}>
              {card.label}
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", color: card.roi !== undefined ? roiColor(card.roi) : card.green ? "#10b981" : "var(--text-1)", letterSpacing: "-0.02em" }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div style={{ background: "var(--card-bg)", border: "1px solid rgba(148,163,184,0.08)", borderRadius: "16px", padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
          Sin cuentas registradas
        </div>
      ) : (
        <div style={{ background: "var(--card-bg)", border: "1px solid rgba(148,163,184,0.08)", borderRadius: "16px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
                {["CUENTA", "EMPRESA", "TIPO", "TAMAÑO", "INVERTIDO", "RETIRADO", "ROI"].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "14px 20px",
                      textAlign: "left",
                      fontSize: "10px",
                      color: "var(--text-muted)",
                      fontWeight: "600",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.name} style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(148,163,184,0.06)" : "none" }}>
                  <td style={{ padding: "16px 20px", fontWeight: "700", color: "var(--text-1)", fontSize: "14px" }}>{row.name}</td>
                  <td style={{ padding: "16px 20px", color: "var(--text-muted)", fontSize: "13px" }}>{row.broker}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      background: "rgba(16,185,129,0.1)",
                      color: "#10b981",
                    }}>
                      {row.type}
                    </span>
                  </td>
                  <td style={{ padding: "16px 20px", color: "var(--text-muted)", fontSize: "13px" }}>{row.size}</td>
                  <td style={{ padding: "16px 20px", color: "var(--text-1)", fontWeight: "600", fontSize: "14px" }}>{fmtMoney(row.invested)}</td>
                  <td style={{ padding: "16px 20px", color: "#10b981", fontWeight: "600", fontSize: "14px" }}>{fmtMoney(row.withdrawn)}</td>
                  <td style={{ padding: "16px 20px" }}>
                    <span style={{
                      fontSize: "14px",
                      fontWeight: "700",
                      color: roiColor(row.roi),
                      borderBottom: row.roi !== null ? `2px solid ${roiColor(row.roi)}` : "none",
                      paddingBottom: "2px",
                    }}>
                      {fmtROI(row.roi)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
