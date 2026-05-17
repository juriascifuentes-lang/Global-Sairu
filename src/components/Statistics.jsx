import { useMemo } from "react"
import { fmt$, fmtPct } from "../utils/format"

export function Statistics({ trades, showPct = false, baseCapital = 0, accountSizeMap = {} }) {
  const {
    totalTrades, winTradesList, lossTradesList, winTrades, lossTrades,
    profitTotal, positiveTotal, negativeTotal, avgGain, avgLoss,
    profitFactor, winRate, buyCount, sellCount, isPositive, winRateNum, pfNum,
  } = useMemo(() => {
    const winList = trades.filter((t) => Number(t.profit) > 0)
    const lossList = trades.filter((t) => Number(t.profit) < 0)
    const pos = winList.reduce((s, t) => s + Number(t.profit || 0), 0)
    const neg = lossList.reduce((s, t) => s + Number(t.profit || 0), 0)
    const total = trades.reduce((s, t) => s + Number(t.profit || 0), 0)
    const wRate = trades.length > 0 ? ((winList.length / trades.length) * 100).toFixed(1) : "0.0"
    return {
      totalTrades: trades.length,
      winTradesList: winList,
      lossTradesList: lossList,
      winTrades: winList.length,
      lossTrades: lossList.length,
      profitTotal: total,
      positiveTotal: pos,
      negativeTotal: neg,
      avgGain: winList.length ? pos / winList.length : 0,
      avgLoss: lossList.length ? neg / lossList.length : 0,
      profitFactor: neg ? (pos / Math.abs(neg)).toFixed(2) : "—",
      winRate: wRate,
      buyCount: trades.filter((t) => t.type === "BUY").length,
      sellCount: trades.filter((t) => t.type === "SELL").length,
      isPositive: total >= 0,
      winRateNum: Number(wRate),
      pfNum: neg ? pos / Math.abs(neg) : null,
    }
  }, [trades])

  const getTradePct = (t) => {
    const size = accountSizeMap[t.account] || baseCapital
    return size > 0 ? (Number(t.profit || 0) / size) * 100 : 0
  }
  const fmtVal = (dollars, getPct) => (!showPct ? fmt$(dollars) : fmtPct(getPct()))

  const primary = [
    {
      label: "P&L Total",
      value: fmtVal(profitTotal, () => trades.reduce((s, t) => s + getTradePct(t), 0)),
      sub: "Resultado acumulado",
      color: isPositive ? "#10b981" : "#f87171",
      accent: isPositive ? "#10b981" : "#f87171",
      tint: isPositive ? "rgba(16,185,129,0.07)" : "rgba(248,113,113,0.07)",
    },
    {
      label: "Win Rate",
      value: `${winRate}%`,
      sub: `${winTrades} ganados · ${lossTrades} perdidos`,
      color: winRateNum >= 50 ? "#10b981" : "#f87171",
      accent: winRateNum >= 50 ? "#10b981" : "#f87171",
      tint: winRateNum >= 50 ? "rgba(16,185,129,0.07)" : "rgba(248,113,113,0.07)",
    },
    {
      label: "Profit Factor",
      value: profitFactor,
      sub: "Ganancias / Pérdidas",
      color: pfNum === null ? "var(--text-muted)" : pfNum >= 1 ? "#10b981" : "#f87171",
      accent: "#3b82f6",
      tint: "rgba(59,130,246,0.05)",
    },
    {
      label: "Total Trades",
      value: String(totalTrades),
      sub: `${buyCount} BUY · ${sellCount} SELL`,
      color: "var(--text-1)",
      accent: "#8b5cf6",
      tint: "rgba(139,92,246,0.05)",
    },
  ]

  const secondary = [
    {
      label: "Avg. Ganancia",
      value: fmtVal(avgGain, () => winTrades ? winTradesList.reduce((s, t) => s + getTradePct(t), 0) / winTrades : 0),
      sub: "Por trade ganador",
      color: "#10b981",
      accent: "#10b981",
    },
    {
      label: "Avg. Pérdida",
      value: fmtVal(avgLoss, () => lossTrades ? lossTradesList.reduce((s, t) => s + getTradePct(t), 0) / lossTrades : 0),
      sub: "Por trade perdedor",
      color: "#f87171",
      accent: "#f87171",
    },
    {
      label: "Mayor Ganancia",
      value: fmtVal(
        trades.length ? Math.max(...trades.map((t) => Number(t.profit || 0))) : 0,
        () => trades.length ? Math.max(...trades.map(tradePct)) : 0
      ),
      sub: "Mejor trade individual",
      color: "#10b981",
      accent: "#10b981",
    },
    {
      label: "Mayor Pérdida",
      value: fmtVal(
        trades.length ? Math.min(...trades.map((t) => Number(t.profit || 0))) : 0,
        () => trades.length ? Math.min(...trades.map(tradePct)) : 0
      ),
      sub: "Peor trade individual",
      color: "#f87171",
      accent: "#f87171",
    },
  ]

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px", marginTop: "28px" }}>
      {[...primary, ...secondary].map((m) => (
        <div key={m.label} style={{
          background: "var(--card-bg)",
          borderRadius: "16px",
          padding: "18px 20px",
          border: "1px solid var(--border-card)",
          borderLeft: `3px solid ${m.accent}`,
        }}>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "12px" }}>
            {m.label}
          </div>
          <div style={{ fontSize: "22px", fontWeight: "600", color: m.color, lineHeight: 1, letterSpacing: "-0.01em", marginBottom: "6px" }}>
            {m.value}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{m.sub}</div>
        </div>
      ))}
    </div>
  )
}
