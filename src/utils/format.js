export const fmt$ = (val) =>
  `${val >= 0 ? "+" : "-"}$${Math.abs(val).toFixed(2)}`

export const fmtUSD = (val) =>
  `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const fmtPct = (pct) =>
  `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`

export const fmtVal = (dollars, getPct, showPct) =>
  !showPct ? fmt$(dollars) : fmtPct(getPct())

export const tradePct = (trade, accountSizeMap, baseCapital) => {
  const size = accountSizeMap[trade.account] || baseCapital
  return size > 0 ? (Number(trade.profit || 0) / size) * 100 : 0
}
