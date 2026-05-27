import { useState, useRef } from "react"
import {
  parseNumber,
  normalizeCell,
  parseDateString,
  detectDelimiter,
  parseCSVRow,
  normalizeHeader,
  findHeaderRow,
  sliceUntilSectionEnd,
  parseXlsxFile,
  parseHtmlTable,
  isTradovateFormat,
  parseTradovateCSV,
  isTradovateOrdersFormat,
  parseTradovateOrdersCSV,
  isDeepChartsFormat,
  parseDeepChartsCSV,
} from "../utils/parseImport"

const inputStyle = {
  background: "var(--inner-bg)",
  border: "1px solid var(--border-input)",
  color: "var(--text-1)",
  padding: "12px 14px",
  borderRadius: "10px",
  width: "100%",
  boxSizing: "border-box",
  fontSize: "14px",
  fontFamily: "Inter, Arial, sans-serif",
  outline: "none",
}

const cardStyle = {
  background: "var(--card-bg)",
  borderRadius: "24px",
  padding: "24px",
  border: "1px solid rgba(148, 163, 184, 0.08)",
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

export function ImportPanel({ accounts, onImportTrades, onNavigate }) {
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  // If no accounts exist, show a redirect prompt
  if (accounts.length === 0) {
    return (
      <div style={{ display: "grid", gap: "24px" }}>
        <div style={cardStyle}>
          <div style={{ marginBottom: "18px" }}>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.18em" }}>
              Importar datos MT5
            </p>
            <h1 style={{ margin: "10px 0 0", color: "var(--text-1)" }}>Importar trades</h1>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
              padding: "32px 0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "40px" }}>🏦</div>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "15px", maxWidth: "360px", lineHeight: "1.6" }}>
              Necesitas tener al menos una cuenta creada antes de importar trades.
            </p>
            <button
              onClick={() => onNavigate("ACCOUNTS")}
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                padding: "12px 24px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Crear mi primera cuenta →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Punto value por instrumento de futuros (dólares por punto)
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

    const iIdx  = idx(["instrumento"])
    const aIdx  = idx(["accion"])
    const qIdx  = idx(["cantidad"])
    const pIdx  = idx(["precio"])
    const tIdx  = idx(["tiempo"])
    const exIdx = idx(["e x", "e/x"])
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
        // Mismo timestamp: entradas antes que salidas
        if (a.isEntry && !b.isEntry) return -1
        if (!a.isEntry && b.isEntry) return 1
        return 0
      })

    // FIFO queue por símbolo: { type, fifo: [{price, qty}], firstTime, totalPnl, exitQty }
    const open = {}
    const trades = []

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

        // Flat cuando la cola FIFO está vacía (todos los contratos emparejados)
        const isFlat = pos.fifo.length === 0
        if (isFlat) {
          const { date, time } = parseDateString(pos.firstTime)
          trades.push({
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
    return trades
  }

  const handleFile = (file) => {
    setError("")
    setMessage("")
    if (fileInputRef.current) fileInputRef.current.value = ""

    if (!selectedAccountId) {
      setError("Debes seleccionar una cuenta antes de importar.")
      return
    }

    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      setLoading(true)
      try {
        const isHtml =
          file.name.toLowerCase().endsWith(".html") ||
          file.name.toLowerCase().endsWith(".htm") ||
          (typeof reader.result === "string" && reader.result.trim().startsWith("<"))
        const isXlsx =
          file.name.toLowerCase().endsWith(".xlsx") ||
          file.name.toLowerCase().endsWith(".xls")

        const accountName =
          accounts.find((account) => String(account.id) === selectedAccountId)?.name || "MT5"
        let headers = []
        let rows = []

        if (isXlsx) {
          const parsed = parseXlsxFile(reader.result)
          headers = parsed.headers
          rows = parsed.dataRows
        } else {
          const text = reader.result
          if (typeof text !== "string") {
            throw new Error("No se pudo leer el archivo.")
          }

          if (isHtml) {
            const parsed = parseHtmlTable(text)
            headers = parsed.headers
            rows = parsed.dataRows
          } else {
            const delimiter = detectDelimiter(text)
            const lines = text
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line.length > 0)

            if (lines.length < 2) {
              throw new Error("El archivo no contiene suficientes filas de datos.")
            }

            const parsedLines = lines.map((line) => parseCSVRow(line, delimiter))
            const headerRowIndex = findHeaderRow(
              parsedLines.slice(0, Math.min(parsedLines.length, 8))
            )
            headers = parsedLines[headerRowIndex].map(normalizeHeader)
            rows = sliceUntilSectionEnd(parsedLines.slice(headerRowIndex + 1))
          }
        }

        // ── Detectar formato Tradovate P&L ──
        if (isTradovateFormat(headers)) {
          const validTrades = parseTradovateCSV(headers, rows, accountName)
          if (validTrades.length === 0)
            throw new Error("No se encontraron trades en el archivo de Tradovate.")
          await onImportTrades(validTrades)
          setMessage(`Importados ${validTrades.length} trades desde Tradovate.`)
          return
        }

        // ── Detectar formato Tradovate Orders ──
        if (isTradovateOrdersFormat(headers)) {
          const validTrades = parseTradovateOrdersCSV(headers, rows, accountName)
          if (validTrades.length === 0)
            throw new Error("No se encontraron trades en el archivo de Tradovate Orders.")
          await onImportTrades(validTrades)
          setMessage(`Importados ${validTrades.length} trades desde Tradovate.`)
          return
        }

        // ── Detectar formato DeepCharts ──
        if (isDeepChartsFormat(headers)) {
          const validTrades = parseDeepChartsCSV(headers, rows, accountName)
          if (validTrades.length === 0)
            throw new Error("No se encontraron trades en el archivo de DeepCharts.")
          await onImportTrades(validTrades)
          setMessage(`Importados ${validTrades.length} trades desde DeepCharts.`)
          return
        }

        // ── Detectar formato NinjaTrader ──
        if (isNinjaTraderFormat(headers)) {
          const validTrades = parseNinjaTraderExecutions(headers, rows, accountName)
          if (validTrades.length === 0)
            throw new Error("No se encontraron trades completos en el archivo de NinjaTrader.")
          await onImportTrades(validTrades)
          setMessage(`Importados ${validTrades.length} trades desde NinjaTrader 8.`)
          return
        }

        // ── Formato MT5 / genérico ──
        const findIndex = (candidates) =>
          candidates.reduce((index, candidate) => {
            if (index !== -1) return index
            return headers.findIndex((header) => header.includes(candidate))
          }, -1)

        const datetimeIndex = findIndex([
          "fecha hora", "fecha/hora", "date time", "date/time",
          "open time", "opening time", "close time",
        ])
        const dateIndex = findIndex([
          "date", "fecha", "open date", "fecha apertura",
          "open time", "fecha/hora", "fecha hora",
        ])
        const timeIndex = findIndex([
          "time", "hora", "open time", "closing time",
          "close time", "hora apertura", "hora cierre",
        ])
        const typeIndex = findIndex([
          "type", "order type", "buy/sell", "side", "action",
          "tipo", "orden", "operacion",
        ])
        const profitIndex = findIndex([
          "profit", "p/l", "pnl", "profit/loss", "profit loss", "net profit",
          "ganancia", "perdida", "gana", "resultado", "importe",
          "beneficio", "ganancias", "beneficios",
        ])
        const symbolIndex = findIndex([
          "item", "symbol", "simbolo", "pair", "ticket", "order",
          "instrument", "instrumento", "activo", "par",
        ])

        const resolveDateTime = (cells) => {
          if (datetimeIndex !== -1) {
            return normalizeCell(cells[datetimeIndex])
          }
          const dateValue = dateIndex !== -1 ? normalizeCell(cells[dateIndex]) : ""
          const timeValue = timeIndex !== -1 ? normalizeCell(cells[timeIndex]) : ""
          return [dateValue, timeValue].filter(Boolean).join(" ")
        }

        if (
          typeIndex === -1 ||
          profitIndex === -1 ||
          symbolIndex === -1 ||
          (datetimeIndex === -1 && dateIndex === -1 && timeIndex === -1)
        ) {
          throw new Error("El archivo no tiene las columnas esperadas.")
        }

        const imported = rows.map((cells) => {
          const rawTime = resolveDateTime(cells)
          const { date, time } = parseDateString(rawTime)
          const rawType = normalizeCell(cells[typeIndex])
          const rawProfit = normalizeCell(cells[profitIndex]) || "0"
          const rawSymbol = normalizeCell(cells[symbolIndex]) || ""

          return {
            symbol: rawSymbol,
            type: rawType.toUpperCase().includes("BUY")
              ? "BUY"
              : rawType.toUpperCase().includes("SELL")
              ? "SELL"
              : rawType.toUpperCase(),
            profit: parseNumber(rawProfit).toFixed(2),
            note: "Importado desde MT5",
            date,
            openTime: time,
            strategy: "",
            account: accountName,
            stopLoss: null,
            takeProfit: null,
          }
        })

        const validTrades = imported.filter(
          (trade) =>
            trade.symbol &&
            trade.date &&
            (trade.type === "BUY" || trade.type === "SELL")
        )

        if (validTrades.length === 0) {
          throw new Error("No se encontraron trades BUY o SELL en el archivo.")
        }

        await onImportTrades(validTrades)
        setMessage(`Importados ${validTrades.length} trades desde MT5.`)
      } catch (err) {
        setError(err.message || "Error al importar el archivo.")
      } finally {
        setLoading(false)
      }
    }

    const isXlsx =
      file.name.toLowerCase().endsWith(".xlsx") ||
      file.name.toLowerCase().endsWith(".xls")
    if (isXlsx) {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsText(file)
    }
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div style={cardStyle}>
        <div style={{ marginBottom: "18px" }}>
          <p
            style={{
              margin: 0,
              color: "var(--text-muted)",
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
            }}
          >
            Importar datos MT5
          </p>
          <h1 style={{ margin: "10px 0 0", color: "var(--text-1)" }}>Importar trades</h1>
          <p style={{ margin: "10px 0 0", color: "var(--text-muted)" }}>
            Sube el CSV exportado desde MetaTrader 5 y conviértelo automáticamente en tu
            journal.
          </p>
        </div>

        <div style={{ display: "grid", gap: "18px", maxWidth: "680px" }}>
          <div>
            <div style={labelStyle}>
              Cuenta destino <span style={{ color: "#f87171" }}>*</span>
            </div>
            <select
              value={selectedAccountId}
              onChange={(e) => { setSelectedAccountId(e.target.value); setError("") }}
              style={{
                ...inputStyle,
                borderColor: !selectedAccountId ? "rgba(248, 113, 113, 0.40)" : "rgba(148, 163, 184, 0.12)",
              }}
            >
              <option value="">— Selecciona una cuenta —</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            {!selectedAccountId && (
              <p style={{ margin: "6px 0 0", color: "#f87171", fontSize: "12px" }}>
                Selecciona una cuenta para continuar.
              </p>
            )}
          </div>

          <div>
            <div style={labelStyle}>Selecciona el archivo CSV, HTML o XLSX</div>
            <div
              onDragOver={(e) => { e.preventDefault(); if (selectedAccountId) setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragging(false)
                handleFile(e.dataTransfer.files?.[0])
              }}
              onClick={() => { if (selectedAccountId) fileInputRef.current?.click() }}
              style={{
                border: `2px dashed ${dragging ? "#10b981" : selectedAccountId ? "rgba(16,185,129,0.3)" : "rgba(148,163,184,0.15)"}`,
                borderRadius: "14px",
                padding: "32px 20px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
                cursor: selectedAccountId ? "pointer" : "not-allowed",
                background: dragging ? "rgba(16,185,129,0.06)" : "transparent",
                opacity: selectedAccountId ? 1 : 0.45,
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: "52px", height: "52px", borderRadius: "14px",
                background: selectedAccountId ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: selectedAccountId ? "#10b981" : "var(--text-muted)",
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
              <div style={{ color: selectedAccountId ? "#10b981" : "var(--text-muted)", fontSize: "13px", fontWeight: "500" }}>
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
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          </div>

          {loading && (
            <div style={{ fontSize: "13px", color: "var(--text-muted)", padding: "10px 14px", background: "rgba(148,163,184,0.07)", borderRadius: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Importando trades...
            </div>
          )}
          {message && !loading && (
            <div style={{ fontSize: "13px", color: "#10b981", fontWeight: "600", padding: "10px 14px", background: "rgba(16,185,129,0.08)", borderRadius: "10px" }}>
              {message}
            </div>
          )}
          {error && (
            <div style={{ fontSize: "13px", color: "#f87171", padding: "10px 14px", background: "rgba(248,113,113,0.08)", borderRadius: "10px" }}>
              {error}
            </div>
          )}

          <div style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
            El archivo puede ser CSV, HTML o XLSX exportado desde MT5. El parser extrae
            columnas como Fecha/Hora, Tipo, Símbolo y Ganancia/Pérdida.
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={{ margin: 0, color: "var(--text-1)" }}>Cómo funciona</h2>
        <ul style={{ marginTop: "16px", color: "var(--text-muted)", paddingLeft: "18px" }}>
          <li>El parser detecta el delimitador del CSV automáticamente.</li>
          <li>
            Convierte cada fila en un trade con símbolo, tipo, ganancia, fecha y cuenta.
          </li>
          <li>Los trades importados se agregan al inicio del journal.</li>
        </ul>
      </div>
    </div>
  )
}
