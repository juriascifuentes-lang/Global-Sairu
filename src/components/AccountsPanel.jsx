import { useState, useRef } from "react"
import { showConfirm } from "../lib/confirm"
import {
  parseNumber, normalizeCell, parseDateString, detectDelimiter, parseCSVRow,
  normalizeHeader, findHeaderRow, sliceUntilSectionEnd,
  parseXlsxFile, parseHtmlTable,
  isTradovateFormat, parseTradovateCSV,
  isTradovateOrdersFormat, parseTradovateOrdersCSV,
  isDeepChartsFormat, parseDeepChartsCSV,
} from "../utils/parseImport"

const NT8_POINT_VALUES = {
  MNQ: 2, NQ: 20, ES: 50, MES: 5,
  MYM: 0.5, YM: 5, RTY: 10, M2K: 5,
  GC: 100, MGC: 10, SI: 5000, CL: 1000,
  NG: 10000, ZB: 1000, ZN: 1000, ZF: 1000,
}

const isNinjaTraderFormat = (headers) =>
  headers.some((h) => h === "instrumento") &&
  headers.some((h) => h === "accion") &&
  headers.some((h) => h === "e x" || h === "e/x")

const parseNinjaTraderExecutions = (headers, rows, accountName) => {
  const idx = (candidates) =>
    candidates.reduce((found, c) => (found !== -1 ? found : headers.findIndex((h) => h === c || h.includes(c))), -1)

  const iIdx   = idx(["instrumento"])
  const aIdx   = idx(["accion"])
  const qIdx   = idx(["cantidad"])
  const pIdx   = idx(["precio"])
  const tIdx   = idx(["tiempo"])
  const exIdx  = idx(["e x", "e/x"])
  const posIdx = idx(["posicion"])

  const executions = rows
    .map((cells) => ({
      symbol:   normalizeCell(cells[iIdx]),
      isBuy:    normalizeCell(cells[aIdx]).toLowerCase().includes("comprar"),
      quantity: Math.abs(parseInt(normalizeCell(cells[qIdx])) || 1),
      price:    parseNumber(normalizeCell(cells[pIdx])),
      rawTime:  normalizeCell(cells[tIdx]),
      isEntry:  normalizeCell(cells[exIdx]).toLowerCase().includes("entrada"),
      posicion: posIdx !== -1 ? normalizeCell(cells[posIdx]) : "",
    }))
    .filter((e) => e.symbol && e.price > 0)
    .sort((a, b) => {
      const { date: da, time: ta } = parseDateString(a.rawTime)
      const { date: db, time: tb } = parseDateString(b.rawTime)
      const cmp = `${da} ${ta}`.localeCompare(`${db} ${tb}`)
      if (cmp !== 0) return cmp
      if (a.isEntry && !b.isEntry) return -1
      if (!a.isEntry && b.isEntry) return 1
      return 0
    })

  const open = {}
  const result = []

  for (const exec of executions) {
    const sym  = exec.symbol
    const base = sym.split(" ")[0].replace(/[0-9]/g, "")
    const pv   = NT8_POINT_VALUES[base] ?? 1

    if (exec.isEntry) {
      if (!open[sym]) {
        open[sym] = { type: exec.isBuy ? "BUY" : "SELL", fifo: [], firstTime: exec.rawTime, totalPnl: 0, exitQty: 0 }
      }
      open[sym].fifo.push({ price: exec.price, qty: exec.quantity })
    } else if (open[sym]) {
      const pos     = open[sym]
      let remaining = exec.quantity

      while (remaining > 0 && pos.fifo.length > 0) {
        const entry    = pos.fifo[0]
        const matchQty = Math.min(remaining, entry.qty)
        const pnl      = pos.type === "BUY"
          ? (exec.price - entry.price) * pv * matchQty
          : (entry.price - exec.price) * pv * matchQty
        pos.totalPnl += pnl
        pos.exitQty  += matchQty
        entry.qty    -= matchQty
        remaining    -= matchQty
        if (entry.qty <= 0) pos.fifo.shift()
      }

      if (pos.fifo.length === 0) {
        const { date, time } = parseDateString(pos.firstTime)
        result.push({
          symbol: sym, type: pos.type,
          profit: pos.totalPnl.toFixed(2), date, openTime: time,
          account: accountName,
          note: `NinjaTrader | Contratos: ${pos.exitQty}`,
          strategy: "", stopLoss: null, takeProfit: null,
        })
        delete open[sym]
      }
    }
  }
  return result
}

const inputStyle = {
  background: "var(--inner-bg)",
  border: "1px solid var(--border-input)",
  color: "var(--text-1)",
  padding: "13px 15px",
  borderRadius: "12px",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "Inter, Arial, sans-serif",
  fontSize: "14px",
  outline: "none",
}

const labelStyle = {
  color: "var(--text-muted)",
  fontSize: "10px",
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  marginBottom: "7px",
  display: "block",
}

// Empresas de fondeo CFDS (Forex/CFDs)
const PROP_FIRMS_CFDS = [
  "FTMO", "FundedNext", "Wall Street Funded", "The5%ers",
  "Orion Fund", "Funding Pips", "Alpha Capital",
  "Otro...",
]

// Empresas de fondeo Futuros
const PROP_FIRMS_FUTUROS = [
  "Lucid Trading", "Topstep", "Alpha Futures", "Apex",
  "Take Profit", "Tradeify",
  "Otro...",
]

const BROKERS = [
  "NinjaTrader", "Tradovate", "Exness", "Pepperstone", "Darwinex", "Axi",
  "Otro...",
]

const getBrokerList = (capitalType) => {
  if (capitalType === "Empresa de Fondeo CFDS")    return PROP_FIRMS_CFDS
  if (capitalType === "Empresa de Fondeo Futuros") return PROP_FIRMS_FUTUROS
  return BROKERS
}

const SIZE_LOOKUP = {
  "5K": 5000, "10K": 10000, "25K": 25000, "50K": 50000,
  "100K": 100000, "150K": 150000, "200K": 200000,
}

const parseSize = (size) => {
  if (!size) return 0
  const s = String(size).trim()
  // 1. Lookup exacto (caso normal: "25K")
  if (SIZE_LOOKUP[s] !== undefined) return SIZE_LOOKUP[s]
  // 2. Lookup case-insensitive ("25k", "25K ")
  const upper = s.toUpperCase()
  if (SIZE_LOOKUP[upper] !== undefined) return SIZE_LOOKUP[upper]

  // 3. Extraer el número ignorando $, comas y espacios
  const numMatch = s.replace(/[$,\s]/g, "").match(/^(\d+(?:\.\d+)?)/)
  if (!numMatch) return 0
  const num = parseFloat(numMatch[1])
  if (isNaN(num) || num === 0) return 0

  const hasK = /K/i.test(upper) || upper.includes("MIL")
  const hasM = upper.includes("M") && !upper.includes("MIL")

  // 4. Si el número ya está en escala completa (≥ 1000), úsalo directo
  if (num >= 1000) return num
  // 5. Número pequeño con sufijo → escalar
  if (hasK) return num * 1000
  if (hasM) return num * 1000000
  // 6. Número pequeño sin sufijo (ej: "25" guardado por Chrome translate) → asumir miles
  return num * 1000
}

// Usa comas como separador de miles, sin sufijos (evita que Chrome traduzca "K"/"M")
const fmtUSD = (v) => {
  const abs = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (abs >= 1000) return `${sign}$${Math.round(abs).toLocaleString("en-US")}`
  return `${sign}$${abs.toFixed(2)}`
}

const defaultForm = {
  name: "", capitalType: "Empresa de Fondeo CFDS", size: "", cost: "",
  idNumber: "", broker: "", brokerCustom: "", notes: "", status: "Activa", phase: "",
}

const phaseOptions = {
  "Empresa de Fondeo CFDS":    ["Fase 1", "Fase 2", "Fondeada"],
  "Empresa de Fondeo Futuros": ["Fase 1", "Fase 2", "Fondeada"],
  "Broker":                    ["Demo", "Real"],
}

// Color por tipo de capital (incluye valores legados del localStorage)
const typeColor = {
  "Empresa de Fondeo CFDS":    { bg: "rgba(99,102,241,0.10)",  color: "#818cf8", border: "rgba(99,102,241,0.25)" },
  "Empresa de Fondeo Futuros": { bg: "rgba(168,85,247,0.10)", color: "#c084fc", border: "rgba(168,85,247,0.25)" },
  "Broker":                    { bg: "rgba(245,158,11,0.10)",  color: "#fbbf24", border: "rgba(245,158,11,0.25)" },
  // Valores anteriores guardados en localStorage
  "Prop firm CFDS":            { bg: "rgba(99,102,241,0.10)",  color: "#818cf8", border: "rgba(99,102,241,0.25)" },
  "Prop firm Futuros":         { bg: "rgba(168,85,247,0.10)", color: "#c084fc", border: "rgba(168,85,247,0.25)" },
  "Empresa de fondeo / Prop Firm": { bg: "rgba(99,102,241,0.10)", color: "#818cf8", border: "rgba(99,102,241,0.25)" },
}

function AccountForm({ value, onChange, onSubmit, onCancel, submitLabel }) {
  const brokerList = getBrokerList(value.capitalType)
  const showCustom  = value.broker === "Otro..."

  const handleTypeChange = (e) =>
    onChange({ ...value, capitalType: e.target.value, broker: "", brokerCustom: "" })

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <div>
        <label style={labelStyle}>Nombre de la cuenta</label>
        <input placeholder="Mi cuenta principal, Funded 50K..." value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })} style={inputStyle} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={labelStyle}>Tipo de capital</label>
          <select value={value.capitalType} onChange={handleTypeChange} style={inputStyle}>
            <option>Empresa de Fondeo CFDS</option>
            <option>Empresa de Fondeo Futuros</option>
            <option>Broker</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Costo de la cuenta (USD)</label>
          <input placeholder="Ej: 549" value={value.cost}
            onChange={(e) => onChange({ ...value, cost: e.target.value })} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={labelStyle}>Tamaño de cuenta</label>
          <select value={value.size} onChange={(e) => onChange({ ...value, size: e.target.value })} style={inputStyle}>
            <option value="">Seleccionar tamaño (opcional)</option>
            {["5K","10K","25K","50K","100K","150K","200K"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>ID / Número de cuenta</label>
          <input placeholder="123456789" value={value.idNumber}
            onChange={(e) => onChange({ ...value, idNumber: e.target.value })} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={labelStyle}>Propfirm / Broker</label>
          <select value={value.broker}
            onChange={(e) => onChange({ ...value, broker: e.target.value, brokerCustom: "" })} style={inputStyle}>
            <option value="">Seleccionar...</option>
            {brokerList.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          {showCustom && (
            <input placeholder="Escribe el nombre..." value={value.brokerCustom}
              onChange={(e) => onChange({ ...value, brokerCustom: e.target.value })}
              style={{ ...inputStyle, marginTop: "8px" }} />
          )}
        </div>
        <div>
          <label style={labelStyle}>Estado de la cuenta</label>
          <select value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value })} style={inputStyle}>
            <option>Activa</option>
            <option>Completada</option>
            <option>Suspendida</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <div>
          <label style={labelStyle}>
            {value.capitalType === "Broker" ? "Tipo de cuenta" : "Fase"}
          </label>
          <select
            value={value.phase}
            onChange={(e) => onChange({ ...value, phase: e.target.value })}
            style={inputStyle}
          >
            <option value="">Sin especificar</option>
            {(phaseOptions[value.capitalType] || []).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Notas (opcional)</label>
        <textarea placeholder="Fase 1, challenge, cuenta real..." value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          rows={2} style={{ ...inputStyle, resize: "none", minHeight: "70px" }} />
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={onSubmit} disabled={!value.name} style={{
          borderRadius: "12px", padding: "11px 22px", fontWeight: "700", fontSize: "14px",
          cursor: value.name ? "pointer" : "not-allowed", border: "none",
          background: value.name ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "rgba(148,163,184,0.08)",
          color: value.name ? "#fff" : "var(--text-muted)",
        }}>
          {submitLabel}
        </button>
        <button onClick={onCancel} style={{
          borderRadius: "12px", padding: "11px 20px", fontWeight: "600", fontSize: "14px",
          cursor: "pointer", border: "1px solid var(--border-input)", background: "transparent",
          color: "var(--text-muted)",
        }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

export function AccountsPanel({ accounts, trades = [], onCreateAccount, onDeleteAccount, onUpdateAccount, onReplaceAccountTrades, onAppendAccountTrades, showPct = false }) {
  const [form, setForm]         = useState(defaultForm)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId]   = useState(null)
  const [editForm, setEditForm]     = useState(null)
  const [reimportMsg, setReimportMsg] = useState("")
  const [reimportErr, setReimportErr] = useState("")
  const [reimportDragging, setReimportDragging] = useState(false)
  const fileInputRef = useRef(null)

  const startEdit = (account) => {
    setEditingId(account.id)
    setEditForm({
      name:            account.name            || "",
      capitalType:     account.capitalType     || "Empresa de Fondeo CFDS",
      size:            account.size            || "",
      cost:            account.cost            || "",
      idNumber:        account.idNumber        || "",
      broker:          account.broker          || "",
      brokerCustom:    "",
      notes:           account.notes           || "",
      status:          account.status          || "Activa",
      phase:           account.phase           || "",
      masterAccountId: account.masterAccountId ?? null,
      copyRatio:       account.copyRatio       ?? 1.0,
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditForm(null) }

  const saveEdit = () => {
    if (!editForm.name) return
    const finalBroker = editForm.broker === "Otro..." ? editForm.brokerCustom : editForm.broker
    onUpdateAccount({ ...accounts.find((a) => a.id === editingId), ...editForm, broker: finalBroker })
    cancelEdit()
  }

  // Compute per-account stats from trades
  const accountStats = accounts.map((account) => {
    const accountTrades = trades.filter((t) => t.account === account.name)
    const pnl = accountTrades.reduce((sum, t) => sum + Number(t.profit || 0), 0)
    const initialBalance = parseSize(account.size)
    const currentBalance = initialBalance + pnl
    return { ...account, pnl, initialBalance, currentBalance, tradeCount: accountTrades.length }
  })

  const totalPnl        = accountStats.reduce((sum, a) => sum + a.pnl, 0)
  const totalInvestment = accountStats.reduce((sum, a) => sum + a.initialBalance, 0)
  const totalValue      = totalInvestment + totalPnl
  const profitableCount = accountStats.filter((a) => a.pnl > 0).length

  const handleReimportFile = (accountName, capitalType, file) => {
    setReimportMsg(""); setReimportErr("")
    if (!file) return
    const isFutures = capitalType === "Empresa de Fondeo Futuros"
    const isXlsx = /\.(xlsx|xls)$/i.test(file.name)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const isHtml = /\.(html|htm)$/i.test(file.name) ||
          (typeof reader.result === "string" && reader.result.trim().startsWith("<"))
        let headers = [], rows = []
        if (isXlsx) {
          const p = parseXlsxFile(reader.result); headers = p.headers; rows = p.dataRows
        } else {
          const text = reader.result
          if (isHtml) {
            const p = parseHtmlTable(text); headers = p.headers; rows = p.dataRows
          } else {
            const delim = detectDelimiter(text)
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
            if (lines.length < 2) throw new Error("El archivo no tiene suficientes filas.")
            const parsed = lines.map(l => parseCSVRow(l, delim))
            const hi = findHeaderRow(parsed.slice(0, 8))
            headers = parsed[hi].map(normalizeHeader)
            rows = sliceUntilSectionEnd(parsed.slice(hi + 1))
          }
        }

        const doImport = async (imported, platform) => {
          if (imported.length === 0) throw new Error(`No se encontraron trades en el archivo de ${platform}.`)
          const existing = trades.filter(t => t.account === accountName).length
          let msg, result
          if (isFutures) {
            msg = existing > 0
              ? `¿Agregar ${imported.length} trades de ${platform} a "${accountName}"? (ya tiene ${existing}; los duplicados se omitirán)`
              : `¿Importar ${imported.length} trades de ${platform} a la cuenta "${accountName}"?`
            if (!await showConfirm(msg, { title: "Importar trades", confirmLabel: "Agregar", danger: false })) { if (fileInputRef.current) fileInputRef.current.value = ""; return }
            result = await onAppendAccountTrades(accountName, imported)
            if (result && result.ok === false) {
              setReimportErr(`Error al guardar: ${result.error?.message || "inténtalo de nuevo."}`)
            } else {
              const skipMsg = result.duplicates > 0 ? ` (${result.duplicates} duplicados omitidos)` : ""
              setReimportMsg(`✓ ${result.inserted} trades nuevos de ${platform} agregados para "${accountName}".${skipMsg}`)
            }
          } else {
            msg = existing > 0
              ? `¿Reemplazar ${existing} trades de "${accountName}" con ${imported.length} del archivo? Esta acción no se puede deshacer.`
              : `¿Importar ${imported.length} trades a la cuenta "${accountName}"?`
            if (!await showConfirm(msg, { title: "Importar trades", confirmLabel: "Importar", danger: false })) { if (fileInputRef.current) fileInputRef.current.value = ""; return }
            result = await onReplaceAccountTrades(accountName, imported)
            if (result && result.ok === false) {
              setReimportErr(`Error al guardar: ${result.error?.message || "inténtalo de nuevo."}`)
            } else {
              setReimportMsg(`✓ ${imported.length} trades de ${platform} importados para "${accountName}".`)
            }
          }
        }

        // ── Detectar formato Tradovate P&L ──
        if (isTradovateFormat(headers)) {
          await doImport(parseTradovateCSV(headers, rows, accountName), "Tradovate")
          return
        }

        // ── Detectar formato Tradovate Orders ──
        if (isTradovateOrdersFormat(headers)) {
          await doImport(parseTradovateOrdersCSV(headers, rows, accountName), "Tradovate")
          return
        }

        // ── Detectar formato DeepCharts ──
        if (isDeepChartsFormat(headers)) {
          await doImport(parseDeepChartsCSV(headers, rows, accountName), "DeepCharts")
          return
        }

        // ── Detectar formato NinjaTrader ──
        if (isNinjaTraderFormat(headers)) {
          await doImport(parseNinjaTraderExecutions(headers, rows, accountName), "NinjaTrader")
          return
        }

        // ── Formato MT5 / genérico ──
        const fi = (cands) => cands.reduce((idx, c) => idx !== -1 ? idx : headers.findIndex(h => h.includes(c)), -1)
        const dtIdx = fi(["fecha hora","fecha/hora","date time","date/time","open time","close time"])
        const dIdx  = fi(["date","fecha","open date","open time"])
        const tIdx  = fi(["time","hora","close time","closing time"])
        const tyIdx = fi(["type","order type","buy/sell","side","action","tipo"])
        const prIdx = fi(["profit","p/l","pnl","profit/loss","net profit","ganancia","resultado","importe","beneficio"])
        const syIdx = fi(["item","symbol","simbolo","pair","instrument","activo"])
        if (tyIdx === -1 || prIdx === -1 || syIdx === -1) throw new Error("El archivo no tiene las columnas esperadas de MT5.")
        const resolve = (cells) => {
          if (dtIdx !== -1) return normalizeCell(cells[dtIdx])
          return [dIdx !== -1 ? normalizeCell(cells[dIdx]) : "", tIdx !== -1 ? normalizeCell(cells[tIdx]) : ""].filter(Boolean).join(" ")
        }
        const imported = rows.map(cells => {
          const { date, time } = parseDateString(resolve(cells))
          const rawType = normalizeCell(cells[tyIdx])
          return {
            symbol: normalizeCell(cells[syIdx]) || "",
            type: rawType.toUpperCase().includes("BUY") ? "BUY" : rawType.toUpperCase().includes("SELL") ? "SELL" : rawType.toUpperCase(),
            profit: parseNumber(normalizeCell(cells[prIdx]) || "0").toFixed(2),
            note: "Importado desde MT5", date, openTime: time,
            strategy: "", account: accountName,
            stopLoss: null, takeProfit: null,
          }
        }).filter(t => t.symbol && t.date && (t.type === "BUY" || t.type === "SELL"))
        await doImport(imported, "MT5")
      } catch (err) {
        setReimportErr(err.message || "Error al leer el archivo.")
      }
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
    if (isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file)
  }

  const handleSubmit = () => {
    if (!form.name) return
    const finalBroker = form.broker === "Otro..." ? form.brokerCustom : form.broker
    onCreateAccount({ id: Date.now(), ...form, broker: finalBroker })
    setForm(defaultForm)
    setShowForm(false)
  }

  // ── Metric cards ──────────────────────────────────────────────
  const metricCards = [
    {
      label: "Valor Total",
      value: fmtUSD(totalValue),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
      ),
      color: "#818cf8",
      bg: "rgba(99,102,241,0.07)",
      border: "rgba(99,102,241,0.18)",
    },
    {
      label: "P&L Total",
      value: `${totalPnl >= 0 ? "+" : ""}${fmtUSD(totalPnl)}`,
      sub: totalInvestment > 0 ? `${((totalPnl / totalInvestment) * 100).toFixed(2)}%` : "",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={totalPnl >= 0 ? "#10b981" : "#f87171"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
        </svg>
      ),
      color: totalPnl >= 0 ? "#10b981" : "#f87171",
      bg:    totalPnl >= 0 ? "rgba(16,185,129,0.07)" : "rgba(248,113,113,0.07)",
      border: totalPnl >= 0 ? "rgba(16,185,129,0.18)" : "rgba(248,113,113,0.18)",
    },
    {
      label: "Rendimiento",
      value: `${profitableCount}/${accounts.length}`,
      sub: "Cuentas rentables",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
      color: "#c084fc",
      bg: "rgba(168,85,247,0.07)",
      border: "rgba(168,85,247,0.18)",
    },
    {
      label: "Inversión",
      value: fmtUSD(totalInvestment),
      sub: "Capital inicial",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
      color: "#fbbf24",
      bg: "rgba(245,158,11,0.07)",
      border: "rgba(245,158,11,0.18)",
    },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.18em" }}>
            Portfolio
          </p>
          <h1 style={{ margin: "6px 0 4px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            Cartera de trading
          </h1>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px" }}>
            {accounts.length === 0
              ? "Sin cuentas registradas"
              : `${accounts.length} ${accounts.length === 1 ? "cuenta conectada" : "cuentas conectadas"}`}
          </p>
        </div>

        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: "11px 20px",
            borderRadius: "12px",
            border: "none",
            background: showForm ? "rgba(148,163,184,0.12)" : "linear-gradient(135deg, #6366f1, #4f46e5)",
            color: showForm ? "var(--text-muted)" : "#fff",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {showForm ? "Cancelar" : "+ Agregar cuenta"}
        </button>
      </div>

      {/* ── Metric cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
        {metricCards.map(({ label, value, sub, icon, color, bg, border }) => (
          <div
            key={label}
            style={{
              background: bg,
              borderRadius: "18px",
              padding: "20px 22px",
              border: `1px solid ${border}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.10em" }}>
                {label}
              </span>
              {icon}
            </div>
            <div style={{ color, fontSize: "26px", fontWeight: "800", letterSpacing: "-0.02em", lineHeight: 1 }}>
              {value}
            </div>
            {sub && (
              <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "6px" }}>{sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Create form (toggle) ── */}
      {showForm && (
        <div style={{ background: "var(--card-bg)", borderRadius: "20px", padding: "26px", border: "1px solid var(--border-card)" }}>
          <h2 style={{ margin: "0 0 20px", color: "var(--text-1)", fontSize: "18px", fontWeight: "700" }}>
            Nueva cuenta
          </h2>
          <AccountForm
            value={form}
            onChange={setForm}
            onSubmit={handleSubmit}
            onCancel={() => { setForm(defaultForm); setShowForm(false) }}
            submitLabel="Crear cuenta"
          />
        </div>
      )}

      {/* ── Account cards ── */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ margin: 0, color: "var(--text-1)", fontSize: "20px", fontWeight: "700" }}>Tus cuentas</h2>
          {accounts.length > 0 && (
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              {accounts.length} {accounts.length === 1 ? "cuenta" : "cuentas"}
            </span>
          )}
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          {accountStats.map((account) => {
            const isEditing = editingId === account.id
            const pctChange = account.initialBalance > 0
              ? ((account.pnl / account.initialBalance) * 100).toFixed(2)
              : null
            const tc = typeColor[account.capitalType] || typeColor["Broker"]
            return (
              <div
                key={account.id}
                style={{
                  background: "var(--card-bg)",
                  borderRadius: "16px",
                  border: `1px solid ${isEditing ? "rgba(99,102,241,0.35)" : "var(--border-card)"}`,
                  borderLeft: `3px solid ${isEditing ? "#6366f1" : account.pnl >= 0 ? "#10b981" : "#f87171"}`,
                  padding: "18px 22px",
                  transition: "border-color 0.15s",
                }}
              >
                {/* ── Fila principal ── */}
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                  {/* Avatar */}
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
                    background: account.pnl >= 0 ? "rgba(16,185,129,0.12)" : "rgba(248,113,113,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px", fontWeight: "800",
                    color: account.pnl >= 0 ? "#10b981" : "#f87171",
                  }}>
                    {account.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Nombre + tipo */}
                  <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                    <div style={{ color: "var(--text-1)", fontWeight: "700", fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {account.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                      <span style={{
                        fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "6px",
                        background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
                        textTransform: "uppercase", letterSpacing: "0.08em",
                      }}>
                        {account.capitalType}
                      </span>
                      {account.broker && (
                        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{account.broker}</span>
                      )}
                      {account.phase && (
                        <span style={{
                          fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "6px",
                          background: "rgba(16,185,129,0.10)", color: "#10b981",
                          border: "1px solid rgba(16,185,129,0.25)",
                          textTransform: "uppercase", letterSpacing: "0.08em",
                        }}>
                          {account.phase}
                        </span>
                      )}
                      {/* Badge copy trading */}
                      {(() => {
                        const isMaster = accounts.some((a) => a.masterAccountId === account.id)
                        const masterAcc = account.masterAccountId
                          ? accounts.find((a) => a.id === account.masterAccountId)
                          : null
                        if (isMaster) return (
                          <span style={{
                            fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "6px",
                            background: "rgba(16,185,129,0.12)", color: "#10b981",
                            border: "1px solid rgba(16,185,129,0.30)",
                            textTransform: "uppercase", letterSpacing: "0.08em",
                          }}>
                            Maestra
                          </span>
                        )
                        if (masterAcc) return (
                          <span style={{
                            fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "6px",
                            background: "rgba(59,130,246,0.10)", color: "#60a5fa",
                            border: "1px solid rgba(59,130,246,0.25)",
                            textTransform: "uppercase", letterSpacing: "0.08em",
                          }}>
                            Esclava ×{account.copyRatio ?? 1}
                          </span>
                        )
                        return null
                      })()}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: "28px", alignItems: "center", flexShrink: 0 }}>
                    {[
                      { label: "Balance inicial", value: account.initialBalance > 0 ? fmtUSD(account.initialBalance) : "—" },
                      { label: "Saldo actual",    value: account.currentBalance > 0 || account.pnl !== 0 ? fmtUSD(account.currentBalance) : "—" },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ textAlign: "right" }}>
                        <div style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: "4px" }}>{label}</div>
                        <div style={{ color: "var(--text-1)", fontSize: "14px", fontWeight: "700" }}>{value}</div>
                      </div>
                    ))}

                    {/* Ganancia */}
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: "4px" }}>Ganancia</div>
                      <div style={{ color: account.pnl >= 0 ? "#10b981" : "#f87171", fontSize: "14px", fontWeight: "700" }}>
                        {showPct && pctChange !== null
                          ? `${account.pnl >= 0 ? "+" : ""}${pctChange}%`
                          : `${account.pnl >= 0 ? "+" : ""}${fmtUSD(account.pnl)}`}
                        {!showPct && pctChange !== null && (
                          <span style={{ fontSize: "11px", marginLeft: "4px", opacity: 0.8 }}>({pctChange}%)</span>
                        )}
                      </div>
                    </div>

                    {/* Estado / Editar / Eliminar — mismo tamaño */}
                    {[
                      {
                        label: account.status,
                        onClick: null,
                        bg: account.status === "Suspendida" ? "rgba(239,68,68,0.10)" : ["Activa","Completada"].includes(account.status) ? "rgba(16,185,129,0.10)" : "rgba(148,163,184,0.08)",
                        color: account.status === "Suspendida" ? "#ef4444" : ["Activa","Completada"].includes(account.status) ? "#10b981" : "var(--text-muted)",
                        border: account.status === "Suspendida" ? "rgba(239,68,68,0.22)" : ["Activa","Completada"].includes(account.status) ? "rgba(16,185,129,0.22)" : "rgba(148,163,184,0.15)",
                      },
                      {
                        label: isEditing ? "Cerrar" : "Editar",
                        onClick: () => isEditing ? cancelEdit() : startEdit(account),
                        bg: isEditing ? "rgba(99,102,241,0.12)" : "rgba(148,163,184,0.08)",
                        color: isEditing ? "#818cf8" : "var(--text-muted)",
                        border: isEditing ? "rgba(99,102,241,0.30)" : "rgba(148,163,184,0.18)",
                        noTranslate: true,
                      },
                      {
                        label: "Eliminar",
                        onClick: () => onDeleteAccount(account.id),
                        bg: "rgba(248,113,113,0.08)",
                        color: "#f87171",
                        border: "rgba(248,113,113,0.18)",
                      },
                    ].map(({ label, onClick, bg, color, border, noTranslate }) => (
                      <div
                        key={label}
                        translate={noTranslate ? "no" : undefined}
                        onClick={onClick || undefined}
                        style={{
                          width: "68px",
                          textAlign: "center",
                          padding: "5px 0",
                          borderRadius: "8px",
                          fontSize: "11px",
                          fontWeight: "600",
                          background: bg,
                          color,
                          border: `1px solid ${border}`,
                          cursor: onClick ? "pointer" : "default",
                          userSelect: "none",
                          flexShrink: 0,
                        }}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Formulario de edición (expandible) ── */}
                {isEditing && editForm && (
                  <div style={{
                    marginTop: "20px", paddingTop: "20px",
                    borderTop: "1px solid rgba(99,102,241,0.18)",
                  }}>
                    <p style={{ margin: "0 0 16px", color: "#818cf8", fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.10em" }}>
                      Editando cuenta
                    </p>
                    <AccountForm
                      value={editForm}
                      onChange={setEditForm}
                      onSubmit={saveEdit}
                      onCancel={cancelEdit}
                      submitLabel="Guardar cambios"
                    />

                    {/* ── Reimport desde archivo ── */}
                    {(() => {
                      const stats = accountStats.find((a) => a.id === editingId)
                      const editingAccount = accounts.find((a) => a.id === editingId)
                      const accountName = editingAccount?.name
                      const capitalType = editingAccount?.capitalType
                      const isFutures = capitalType === "Empresa de Fondeo Futuros"
                      return (
                        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(148,163,184,0.08)" }}>
                          <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-1)", marginBottom: "8px" }}>
                            {isFutures ? "Agregar historial desde archivo" : "Actualizar historial desde archivo"}
                          </div>

                          {stats?.tradeCount > 0 && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: "6px",
                              marginBottom: "12px", padding: "7px 12px",
                              background: "rgba(16,185,129,0.08)", borderRadius: "8px",
                              border: "1px solid rgba(16,185,129,0.18)",
                            }}>
                              <span style={{ color: "#10b981", fontWeight: "700", fontSize: "12px" }}>
                                {stats.tradeCount} trades actuales
                              </span>
                              <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                                · {isFutures ? "sube un archivo para acumular al historial" : "sube un archivo para reemplazarlos"}
                              </span>
                            </div>
                          )}

                          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px", lineHeight: "1.5" }}>
                            {isFutures
                              ? "Futuros: cada importación agrega los trades nuevos sin eliminar los anteriores. Los duplicados se omiten automáticamente."
                              : "Sube tu historial desde MT4, MT5, TradingView o cualquier exportación CSV/Excel."}
                          </div>

                          <div
                            onDragOver={(e) => { e.preventDefault(); setReimportDragging(true) }}
                            onDragLeave={() => setReimportDragging(false)}
                            onDrop={(e) => {
                              e.preventDefault(); setReimportDragging(false)
                              handleReimportFile(accountName, capitalType, e.dataTransfer.files?.[0])
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                              border: `2px dashed ${reimportDragging ? "#10b981" : "rgba(16,185,129,0.3)"}`,
                              borderRadius: "14px",
                              padding: "28px 20px",
                              display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
                              cursor: "pointer",
                              background: reimportDragging ? "rgba(16,185,129,0.06)" : "transparent",
                              transition: "all 0.15s",
                            }}
                          >
                            <div style={{
                              width: "52px", height: "52px", borderRadius: "14px",
                              background: "rgba(16,185,129,0.12)",
                              display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981",
                            }}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="17 8 12 3 7 8"/>
                                <line x1="12" y1="3" x2="12" y2="15"/>
                              </svg>
                            </div>
                            <div style={{ color: "var(--text-1)", fontWeight: "600", fontSize: "14px" }}>
                              Arrastra tu archivo aquí
                            </div>
                            <div style={{ color: "#10b981", fontSize: "13px", fontWeight: "500" }}>
                              o haz clic para seleccionar
                            </div>
                            <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
                              CSV, XLSX o XLS · máx. 10 MB
                            </div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".csv,.html,.htm,.xlsx,.xls"
                              style={{ display: "none" }}
                              onChange={(e) => handleReimportFile(accountName, capitalType, e.target.files?.[0])}
                            />
                          </div>

                          {reimportMsg && (
                            <div style={{ marginTop: "10px", fontSize: "12px", color: "#10b981", fontWeight: "600", padding: "8px 12px", background: "rgba(16,185,129,0.08)", borderRadius: "8px" }}>
                              {reimportMsg}
                            </div>
                          )}
                          {reimportErr && (
                            <div style={{ marginTop: "10px", fontSize: "12px", color: "#f87171", padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: "8px" }}>
                              {reimportErr}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Botón agregar nueva cuenta ── */}
          <div
            onClick={() => { setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }) }}
            style={{
              borderRadius: "16px",
              border: "1.5px dashed rgba(99,102,241,0.35)",
              padding: "18px 22px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              cursor: "pointer",
              background: "rgba(99,102,241,0.04)",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(99,102,241,0.09)"
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.55)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(99,102,241,0.04)"
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"
            }}
          >
            <div style={{
              width: "38px", height: "38px", borderRadius: "10px",
              background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "22px", color: "#818cf8", fontWeight: "300",
            }}>
              +
            </div>
            <div>
              <div style={{ color: "var(--text-1)", fontWeight: "700", fontSize: "14px" }}>
                Agregar nueva cuenta
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>
                Conecta otra cuenta de trading
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
