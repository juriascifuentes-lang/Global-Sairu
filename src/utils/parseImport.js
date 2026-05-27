import * as XLSX from "xlsx"

export const parseNumber = (value) => {
  if (!value) return 0
  // Normalize unicode minus/dash variants to ASCII hyphen-minus
  let str = String(value)
    .replace(/[−–—]/g, "-")
    .replace(/\s/g, "")
  if (!str || str === "-") return 0

  const lastComma = str.lastIndexOf(",")
  const lastDot = str.lastIndexOf(".")

  let normalized
  if (lastComma > lastDot) {
    // European: "1.234,56" — comma is decimal separator
    normalized = str.replace(/\./g, "").replace(",", ".")
  } else if (lastDot > lastComma) {
    const decimals = str.slice(lastDot + 1).replace(/\D/g, "")
    if (decimals.length <= 2) {
      // Decimal dot: "-27.32" or "451.92"
      normalized = str.replace(/,/g, "")
    } else {
      // Thousands dot: "25.000" -> remove dots
      normalized = str.replace(/\./g, "").replace(",", ".")
    }
  } else {
    normalized = str
  }

  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export const normalizeCell = (cell) =>
  (cell || "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()

export const parseDateString = (value) => {
  if (!value) return { date: "", time: "" }

  const raw = String(value).replace(/ /g, " ").trim()
  const timeMatch = raw.match(/(\d{1,2}:\d{2}(?::\d{2})?)/)
  const time = timeMatch ? timeMatch[0] : ""
  const datePart = raw
    .replace(time, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[./]/g, "-")

  const parts = datePart.split("-").map((part) => part.trim())
  if (parts.length !== 3) {
    return { date: datePart || "", time: time || "" }
  }

  let [first, second, third] = parts
  const numeric = (v) => Number(v.replace(/^0+/, "") || "0")
  const firstNum = numeric(first)

  let year, month, day

  if (first.length === 4) {
    year = first; month = second; day = third
  } else if (third.length === 4) {
    year = third
    const sNum = numeric(second)
    if (firstNum > 12) {
      // DD/MM/YYYY: first is clearly a day
      month = second; day = first
    } else if (sNum > 12) {
      // MM/DD/YYYY: second is clearly a day (Tradovate format)
      month = first; day = second
    } else {
      // Ambiguous — default to DD/MM/YYYY
      month = second; day = first
    }
  } else if (firstNum > 31) {
    year = first; month = second; day = third
  } else {
    year = `20${third.padStart(2, "0")}`; month = second; day = first
  }

  return {
    date: `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    time: time || "",
  }
}

export const parseCSVRow = (line, delimiter = ",") => {
  const cells = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

export const detectDelimiter = (text) => {
  const headerLine = text.split(/\r?\n/)[0] || ""
  const commaCount = (headerLine.match(/,/g) || []).length
  const semicolonCount = (headerLine.match(/;/g) || []).length
  return semicolonCount > commaCount ? ";" : ","
}

export const normalizeHeader = (header) =>
  header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const headerKeywords = [
  "order", "ticket", "symbol", "simbolo", "item", "pair", "instrument",
  "instrumento", "activo", "tipo", "type", "side", "orden", "operacion",
  "operaciones", "posicion", "fecha", "hora", "profit", "p/l", "pnl",
  "ganancia", "perdida", "importe", "beneficio", "resultado", "saldo",
  "balance", "transaccion", "transaccion",
]

const scoreHeaderRow = (cells) =>
  cells.reduce(
    (score, cell) =>
      score + (headerKeywords.some((keyword) => cell.includes(keyword)) ? 1 : 0),
    0
  )

export const findHeaderRow = (rows) => {
  let bestIndex = 0
  let bestScore = -1

  rows.forEach((row, index) => {
    const normalized = row.map((cell) => normalizeHeader(String(cell || "")))
    const score = scoreHeaderRow(normalized)
    if (score > bestScore && normalized.some((cell) => cell.length > 0)) {
      bestScore = score
      bestIndex = index
    }
  })

  return bestIndex
}

const looksLikeSectionHeader = (cells) => {
  const text = cells
    .map((cell) => normalizeHeader(String(cell || "")))
    .filter(Boolean)
    .join(" ")

  const sectionTitles = [
    "posiciones", "positions", "ordenes", "orders",
    "transacciones", "transactions", "balance", "resumen", "summary",
  ]

  return sectionTitles.includes(text)
}

export const sliceUntilSectionEnd = (rows) => {
  const dataRows = []
  for (const row of rows) {
    if (looksLikeSectionHeader(row) || row.every((cell) => !String(cell).trim())) {
      break
    }
    dataRows.push(row)
  }
  return dataRows
}

const formatXlsxCell = (cell) => {
  if (cell instanceof Date) {
    const p = (n) => String(n).padStart(2, "0")
    return `${p(cell.getDate())}/${p(cell.getMonth() + 1)}/${cell.getFullYear()} ${p(cell.getHours())}:${p(cell.getMinutes())}:${p(cell.getSeconds())}`
  }
  return normalizeCell(String(cell ?? ""))
}

export const parseXlsxFile = (arrayBuffer) => {
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true })
  const firstSheet = workbook.SheetNames[0]
  const sheet = workbook.Sheets[firstSheet]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })

  if (!rows || rows.length < 2) {
    throw new Error("El archivo XLSX no contiene suficientes filas de datos.")
  }

  const headerRowIndex = findHeaderRow(rows.slice(0, Math.min(rows.length, 8)))
  const headers = rows[headerRowIndex].map((cell) => normalizeHeader(String(cell || "")))
  const dataRows = sliceUntilSectionEnd(rows.slice(headerRowIndex + 1)).map((row) =>
    row.map(formatXlsxCell)
  )
  return { headers, dataRows }
}

export const isTradovateFormat = (headers) =>
  headers.some((h) => h === "bought timestamp") &&
  headers.some((h) => h === "sold timestamp")

export const parseTradovateCSV = (headers, rows, accountName) => {
  const idx = (candidates) =>
    candidates.reduce(
      (found, c) => (found !== -1 ? found : headers.findIndex((h) => h === c || h.includes(c))),
      -1
    )

  const contractIdx  = idx(["contract"])
  const plIdx        = idx(["p l"])
  const boughtTsIdx  = idx(["bought timestamp"])
  const soldTsIdx    = idx(["sold timestamp"])
  const pairedQtyIdx = idx(["paired qty"])

  const parseTs = (ts) => {
    const m = ts.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}):(\d{2})/)
    return m ? new Date(+m[3], +m[1] - 1, +m[2], +m[4], +m[5]).getTime() : 0
  }

  const trades = []

  for (const cells of rows) {
    const contract = normalizeCell(cells[contractIdx] || "")
    const pl       = parseNumber(normalizeCell(cells[plIdx] || "0"))
    const boughtTs = normalizeCell(cells[boughtTsIdx] || "")
    const soldTs   = normalizeCell(cells[soldTsIdx] || "")
    const qty      = Math.abs(parseInt(normalizeCell(cells[pairedQtyIdx] || "1")) || 1)

    if (!contract || !boughtTs || !soldTs) continue

    const isLong         = parseTs(boughtTs) <= parseTs(soldTs)
    const entryTs        = isLong ? boughtTs : soldTs
    const { date, time } = parseDateString(entryTs)
    if (!date) continue

    trades.push({
      symbol:     contract,
      type:       isLong ? "BUY" : "SELL",
      profit:     pl.toFixed(2),
      date,
      openTime:   time,
      account:    accountName,
      note:       `Tradovate | Contratos: ${qty}`,
      strategy:   "",
      stopLoss:   null,
      takeProfit: null,
    })
  }

  return trades
}

const FUTURES_POINT_VALUES = {
  MNQ: 2, NQ: 20, ES: 50, MES: 5,
  YM: 5, MYM: 0.5, RTY: 50, M2K: 5,
  GC: 100, MGC: 10, CL: 1000, NG: 10000,
  ZB: 1000, ZN: 1000, ZF: 1000, ZT: 2000,
}

export const isTradovateOrdersFormat = (headers) =>
  headers.some((h) => h === "b s") &&
  headers.some((h) => h === "fill time") &&
  headers.some((h) => h === "avg fill price") &&
  headers.some((h) => h === "status")

export const parseTradovateOrdersCSV = (headers, rows, accountName) => {
  const idx = (candidates) =>
    candidates.reduce(
      (found, c) => (found !== -1 ? found : headers.findIndex((h) => h === c || h.includes(c))),
      -1
    )

  const bsIdx       = idx(["b s"])
  const productIdx  = idx(["product"])
  const contractIdx = idx(["contract"])
  const priceIdx    = idx(["avg fill price"])
  const qtyIdx      = idx(["filled qty"])
  const timeIdx     = idx(["fill time"])
  const statusIdx   = idx(["status"])
  const notionalIdx = idx(["notional value"])

  // FIFO open position queue per symbol: [{side, price, qty, time, multiplier}]
  const positions = {}
  const trades = []

  for (const cells of rows) {
    const status = normalizeCell(cells[statusIdx] || "").toLowerCase()
    if (status !== "filled") continue

    const bs       = normalizeCell(cells[bsIdx] || "").toLowerCase()
    if (bs !== "buy" && bs !== "sell") continue

    const contract = normalizeCell(cells[contractIdx] || "")
    const product  = normalizeCell(cells[productIdx] || "")
    const price    = parseNumber(normalizeCell(cells[priceIdx] || "0"))
    const qty      = Math.abs(parseInt(normalizeCell(cells[qtyIdx] || "0")) || 0)
    const fillTime = normalizeCell(cells[timeIdx] || "")
    const notional = notionalIdx >= 0 ? parseNumber(normalizeCell(cells[notionalIdx] || "0")) : 0

    if (!contract || !price || !qty || !fillTime) continue

    // Use clean product symbol (MNQ) or strip month code from contract (MNQM6 → MNQ)
    const symbol = product || contract.replace(/[A-Z]\d+$/, "") || contract
    const upper  = symbol.toUpperCase()

    // Derive multiplier from known table, then from notional, then fallback to 1
    const multiplier =
      FUTURES_POINT_VALUES[upper] ||
      (notional && price && qty ? notional / (price * qty) : 1)

    if (!positions[symbol]) positions[symbol] = []
    const queue = positions[symbol]

    let remaining = qty

    while (remaining > 0 && queue.length > 0) {
      const front = queue[0]
      const isClosing = (bs === "buy" && front.side === "sell") || (bs === "sell" && front.side === "buy")
      if (!isClosing) break

      const matchQty = Math.min(remaining, front.qty)
      remaining -= matchQty
      front.qty -= matchQty

      const pnl = front.side === "buy"
        ? (price - front.price) * matchQty * front.multiplier
        : (front.price - price) * matchQty * front.multiplier

      const { date, time } = parseDateString(front.time)
      if (date) {
        trades.push({
          symbol,
          type:      front.side === "buy" ? "BUY" : "SELL",
          profit:    pnl.toFixed(2),
          date,
          openTime:  time,
          account:   accountName,
          note:      `Tradovate | Contratos: ${matchQty}`,
          strategy:  "",
          stopLoss:  null,
          takeProfit: null,
        })
      }

      if (front.qty === 0) queue.shift()
    }

    if (remaining > 0) {
      queue.push({ side: bs, price, qty: remaining, time: fillTime, multiplier })
    }
  }

  return trades
}

export const isDeepChartsFormat = (headers) =>
  headers.some((h) => h === "entry date") &&
  headers.some((h) => h === "exit date") &&
  headers.some((h) => h === "net p l" || h.includes("net p"))

export const parseDeepChartsCSV = (headers, rows, accountName) => {
  const idx = (candidates) =>
    candidates.reduce(
      (found, c) => (found !== -1 ? found : headers.findIndex((h) => h === c || h.includes(c))),
      -1
    )

  const symbolIdx    = idx(["symbol"])
  const sideIdx      = idx(["side"])
  const netPlIdx     = idx(["net p l"])
  const entryDateIdx = idx(["entry date"])
  const quantityIdx  = idx(["quantity"])

  const trades = []

  for (const cells of rows) {
    const symbol  = normalizeCell(cells[symbolIdx] || "")
    const side    = normalizeCell(cells[sideIdx] || "").toUpperCase()
    const netPl   = parseNumber(normalizeCell(cells[netPlIdx] || "0"))
    const rawDate = normalizeCell(cells[entryDateIdx] || "")
    const qty     = Math.abs(parseInt(normalizeCell(cells[quantityIdx] || "1")) || 1)

    if (!symbol || !rawDate) continue

    const { date, time } = parseDateString(rawDate)
    if (!date) continue

    const type = side === "BUY" ? "BUY" : side === "SELL" ? "SELL" : null
    if (!type) continue

    trades.push({
      symbol,
      type,
      profit:     netPl.toFixed(2),
      date,
      openTime:   time,
      account:    accountName,
      note:       `DeepCharts | Contratos: ${qty}`,
      strategy:   "",
      stopLoss:   null,
      takeProfit: null,
    })
  }

  return trades
}

// Returns only the direct <tr> rows of a table — avoids picking up rows from nested tables.
const getDirectRows = (table) => {
  const rows = []
  for (const child of table.children) {
    if (child.tagName === "TR") {
      rows.push(child)
    } else if (["TBODY", "THEAD", "TFOOT"].includes(child.tagName)) {
      for (const row of child.children) {
        if (row.tagName === "TR") rows.push(row)
      }
    }
  }
  return rows
}

// Returns direct <td>/<th> cells, excluding hidden ones.
// MT5 HTML injects <td class="hidden" colspan="N"> spacers in data rows but NOT in
// header rows, which shifts every column index by 1 — filtering them fixes the mismatch.
const getDirectCells = (row) =>
  Array.from(row.children).filter(
    (el) =>
      (el.tagName === "TD" || el.tagName === "TH") &&
      !el.classList.contains("hidden")
  )

export const parseHtmlTable = (text) => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, "text/html")
  const allTables = Array.from(doc.querySelectorAll("table"))

  if (allTables.length === 0) {
    throw new Error("No se encontró ninguna tabla en el HTML.")
  }

  const htmlHeaderKeywords = [
    "order", "ticket", "symbol", "simbolo", "item", "pair", "instrument",
    "instrumento", "activo", "tipo", "type", "side", "orden", "operacion",
    "operaciones", "posicion", "fecha", "hora", "profit", "p/l", "pnl",
    "ganancia", "perdida", "importe", "beneficio", "resultado",
  ]

  const normalizeRow = (row) =>
    getDirectCells(row).map((cell) =>
      normalizeHeader((cell.textContent || "").replace(/\s+/g, " "))
    )

  const scoreRow = (cells) =>
    cells.reduce(
      (score, cell) =>
        score + (htmlHeaderKeywords.some((keyword) => cell.includes(keyword)) ? 1 : 0),
      0
    )

  const rowTitleMatches = (row) => {
    const text = normalizeRow(row).filter(Boolean).join(" ").trim()
    return text === "posiciones" || text === "positions"
  }

  // Find the Posiciones table by looking for a direct title row — avoids the outer
  // container whose textContent includes "posicion" from nested sub-tables.
  let targetTable = null
  for (const table of allTables) {
    const directRows = getDirectRows(table)
    if (directRows.some(rowTitleMatches)) {
      targetTable = table
      break
    }
  }

  // Fallback: pick the table whose direct rows have the best column-header score
  if (!targetTable) {
    let bestScore = -1
    for (const table of allTables) {
      const directRows = getDirectRows(table)
      if (directRows.length < 2) continue
      for (const row of directRows) {
        const score = scoreRow(normalizeRow(row))
        if (score >= 2 && score > bestScore) {
          bestScore = score
          targetTable = table
        }
      }
    }
  }

  if (!targetTable) {
    throw new Error("No se encontró una tabla adecuada en el HTML.")
  }

  const directRows = getDirectRows(targetTable).filter((row) =>
    normalizeRow(row).some((cell) => cell.length > 0)
  )
  const rowCells = directRows.map(normalizeRow)

  const headerIndex = rowCells.findIndex((cells) => scoreRow(cells) >= 2)
  const actualHeaderIndex = headerIndex >= 0 ? headerIndex : 0
  const headers = rowCells[actualHeaderIndex]

  // Extract direct child cells only — avoids index shifts caused by nested <td> inside cells.
  // Then cut at the next section boundary (Órdenes, Transacciones, etc.).
  const allDataRows = directRows.slice(actualHeaderIndex + 1).map((row) =>
    getDirectCells(row).map((cell) => normalizeCell(cell.textContent))
  )

  const dataRows = sliceUntilSectionEnd(allDataRows)

  return { headers, dataRows }
}
