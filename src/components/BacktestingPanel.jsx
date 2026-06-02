import { useState, useCallback, useMemo, useEffect } from "react"

// ── Presets de firmas ─────────────────────────────────────────────────────────
const FIRMS = {
  FTMO: {
    label: "FTMO",
    accounts: [
      { size: 50000,  label: "$50k" },
      { size: 100000, label: "$100k" },
      { size: 200000, label: "$200k" },
    ],
    rules: { f1TargetPct: 0.10, f2TargetPct: 0.05, dailyLimitPct: 0.05, maxDrawdownPct: 0.10, minDays: 4 },
  },
  ORION: {
    label: "Orion Fund",
    accounts: [
      { size: 50000,  label: "$50k" },
      { size: 100000, label: "$100k" },
      { size: 200000, label: "$200k" },
    ],
    rules: { f1TargetPct: 0.08, f2TargetPct: 0.05, dailyLimitPct: 0.05, maxDrawdownPct: 0.10, minDays: 3 },
  },
}

// ── Motor de simulación ───────────────────────────────────────────────────────
function runSimulation(days, config) {
  const { accountSize, f1TargetPct, f2TargetPct, dailyLimitPct, maxDrawdownPct, minDays, personalRule, pnlUnit, riskMultiplier } = config

  const f1Target      = accountSize * f1TargetPct
  const f2Target      = accountSize * f2TargetPct
  const dailyLimitAbs = accountSize * dailyLimitPct
  const maxDDabs      = accountSize * maxDrawdownPct
  const personalLimitAbs = accountSize * 0.049

  const toUsd = (v) => pnlUnit === "pct" ? (v / 100) * accountSize : v

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const attempts = []
  let i = 0

  while (i < sorted.length) {
    const startDate = sorted[i].date

    // ── F1 ────────────────────────────────────────────────────────────────────
    let pnlF1 = 0, daysF1 = 0, blownF1 = false, blownDetail = "", savedDay = false

    while (i < sorted.length) {
      let pnl = toUsd(sorted[i].pnl) * riskMultiplier
      let actual = pnl
      if (personalRule && pnl < -personalLimitAbs) { actual = -personalLimitAbs; savedDay = true }

      if (actual < -dailyLimitAbs) {
        pnlF1 += actual; daysF1++; i++
        blownF1 = true
        blownDetail = `Drawdown diario: $${Math.abs(actual).toFixed(0)} (límite $${dailyLimitAbs.toFixed(0)})`
        break
      }

      pnlF1 += actual; daysF1++; i++

      if (pnlF1 < -maxDDabs) {
        blownF1 = true
        blownDetail = `Drawdown máx acumulado: $${Math.abs(pnlF1).toFixed(0)} > $${maxDDabs.toFixed(0)}`
        break
      }

      if (pnlF1 >= f1Target && daysF1 >= minDays) break
    }

    const f1Passed = !blownF1 && pnlF1 >= f1Target && daysF1 >= minDays

    if (!f1Passed) {
      attempts.push({
        num: attempts.length + 1,
        progress: blownF1 ? "F1" : "F1...",
        startDate,
        endDate: sorted[i - 1]?.date || startDate,
        days: daysF1,
        pnlF1, pnlF2: null,
        pnlAccum: pnlF1,
        blownPhase: blownF1 ? "F1" : null,
        result: blownF1 ? "QUEMADA" : "EN_PROGRESO",
        detail: blownF1 ? blownDetail : "F1 en progreso",
        savedDay,
      })
      continue
    }

    // ── F2 ────────────────────────────────────────────────────────────────────
    let pnlF2 = 0, daysF2 = 0, blownF2 = false

    while (i < sorted.length) {
      let pnl = toUsd(sorted[i].pnl) * riskMultiplier
      let actual = pnl
      if (personalRule && pnl < -personalLimitAbs) { actual = -personalLimitAbs; savedDay = true }

      if (actual < -dailyLimitAbs) {
        pnlF2 += actual; daysF2++; i++
        blownF2 = true
        blownDetail = `Drawdown diario en F2: $${Math.abs(actual).toFixed(0)}`
        break
      }

      pnlF2 += actual; daysF2++; i++

      if (pnlF2 < -maxDDabs) {
        blownF2 = true
        blownDetail = `Drawdown máx en F2: $${Math.abs(pnlF2).toFixed(0)}`
        break
      }

      if (pnlF2 >= f2Target && daysF2 >= minDays) break
    }

    const f2Passed = !blownF2 && pnlF2 >= f2Target && daysF2 >= minDays

    attempts.push({
      num: attempts.length + 1,
      progress: f2Passed ? "F1→F2→✓" : blownF2 ? "F1→F2" : "F1→F2...",
      startDate,
      endDate: sorted[i - 1]?.date || startDate,
      days: daysF1 + daysF2,
      pnlF1, pnlF2,
      pnlAccum: pnlF1 + pnlF2,
      blownPhase: blownF2 ? "F2" : null,
      result: f2Passed ? "FONDEADO" : blownF2 ? "QUEMADA" : "EN_PROGRESO",
      detail: f2Passed ? "Objetivos cumplidos" : blownF2 ? blownDetail : "F2 en progreso",
      savedDay,
    })
  }

  return attempts
}

// ── Comprimir imagen antes de enviar ─────────────────────────────────────────
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const maxW = 1600
      let w = img.width, h = img.height
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW }
      canvas.width = w; canvas.height = h
      canvas.getContext("2d").drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ base64: reader.result.split(",")[1], mediaType: "image/jpeg" })
        reader.readAsDataURL(blob)
      }, "image/jpeg", 0.82)
    }
    img.src = url
  })
}

// ── Helpers visuales ──────────────────────────────────────────────────────────
function fmtUsd(n) {
  return (n >= 0 ? "+" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function ResultBadge({ result }) {
  const map = {
    FONDEADO:    { bg: "rgba(16,185,129,0.15)", color: "#10b981", border: "rgba(16,185,129,0.3)", label: "FONDEADO" },
    QUEMADA:     { bg: "rgba(239,68,68,0.15)",  color: "#ef4444", border: "rgba(239,68,68,0.3)",  label: "Quemada"  },
    EN_PROGRESO: { bg: "rgba(156,163,175,0.12)", color: "#9ca3af", border: "rgba(156,163,175,0.3)", label: "En progreso" },
  }
  const s = map[result] || map.EN_PROGRESO
  return (
    <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function BacktestingPanel() {
  const [firmKey, setFirmKey]         = useState(() => localStorage.getItem("bt_firmKey") || "FTMO")
  const [accountIdx, setAccountIdx]   = useState(0)
  const [personalRule, setPersonalRule] = useState(() => localStorage.getItem("bt_personalRule") !== "false")
  const pnlUnit = "usd"
  const [riskMult, setRiskMult]       = useState(() => Number(localStorage.getItem("bt_riskMult") ?? 1.0))
  const [days, setDays]               = useState(() => { try { return JSON.parse(localStorage.getItem("bt_days") || "[]") } catch { return [] } })
  const [imgList, setImgList]         = useState(() => { try { return JSON.parse(localStorage.getItem("bt_imgList") || "[]") } catch { return [] } })
  const [loading, setLoading]         = useState(false)
  const [editingIdx, setEditingIdx]   = useState(null)
  const [editValue, setEditValue]     = useState("")
  const [dragOver, setDragOver]       = useState(false)


  // Persistir configuración y datos en localStorage
  useEffect(() => { localStorage.setItem("bt_firmKey", firmKey) }, [firmKey])
  useEffect(() => { localStorage.setItem("bt_accountIdx", accountIdx) }, [accountIdx])
  useEffect(() => { localStorage.setItem("bt_personalRule", personalRule) }, [personalRule])
  useEffect(() => { localStorage.setItem("bt_riskMult", riskMult) }, [riskMult])
  useEffect(() => { localStorage.setItem("bt_days", JSON.stringify(days)) }, [days])
  useEffect(() => {
    // Solo guarda metadata de imágenes (no base64), filtrando las que están procesando
    const toSave = imgList.map(im => ({ ...im, status: im.status === "procesando" ? "error" : im.status }))
    localStorage.setItem("bt_imgList", JSON.stringify(toSave))
  }, [imgList])


  const firm    = FIRMS[firmKey]
  const account = firm.accounts[accountIdx] || firm.accounts[0]
  const rules   = { ...firm.rules, accountSize: account.size, personalRule, pnlUnit, riskMultiplier: riskMult }

  const simulation = useMemo(() => days.length === 0 ? [] : runSimulation(days, rules),
    [days, firmKey, accountIdx, personalRule, pnlUnit, riskMult])

  const stats = useMemo(() => {
    const funded  = simulation.filter(a => a.result === "FONDEADO").length
    const blown   = simulation.filter(a => a.result === "QUEMADA").length
    const total   = simulation.length
    const rate    = total > 0 ? Math.round(funded / total * 100) : 0
    const pnl     = simulation.reduce((s, a) => s + a.pnlAccum, 0)
    return { funded, blown, total, rate, pnl, attempts: total }
  }, [simulation])

  // ── Procesar archivos ──────────────────────────────────────────────────────
  const processFiles = useCallback(async (files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/"))
    if (imgs.length === 0) return
    setLoading(true)

    // Cada imagen recibe una clave única para poder borrar sus días después
    const batchTs = Date.now()
    const newMeta = imgs.map((f, i) => ({ name: f.name, status: "procesando", count: 0, imgKey: `${batchTs}-${i}` }))
    setImgList(prev => [...prev, ...newMeta])

    for (let idx = 0; idx < imgs.length; idx++) {
      const imgKey = newMeta[idx].imgKey
      try {
        const { base64, mediaType } = await compressImage(imgs[idx])
        const res  = await fetch("/api/backtesting/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mediaType, filename: imgs[idx].name }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        const extracted = (Array.isArray(data.days) ? data.days : []).map(d => ({ ...d, imgKey }))
        setImgList(prev => prev.map(im => im.imgKey === imgKey ? { ...im, status: "ok", count: extracted.length } : im))
        setDays(prev => {
          const merged = [...prev]
          for (const d of extracted) {
            const i = merged.findIndex(x => x.date === d.date)
            if (i >= 0) merged[i] = d
            else merged.push(d)
          }
          return merged.sort((a, b) => a.date.localeCompare(b.date))
        })
      } catch (err) {
        const isKeyMissing = String(err?.message).includes("ANTHROPIC_API_KEY")
        setImgList(prev => prev.map(im => im.imgKey === imgKey
          ? { ...im, status: "error", errorMsg: isKeyMissing ? "API key no configurada" : (err?.message || "Error") }
          : im
        ))
      }
    }

    setLoading(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    processFiles(e.dataTransfer.files)
  }, [processFiles])

  const handleFileInput = useCallback((e) => {
    processFiles(e.target.files)
    e.target.value = ""
  }, [processFiles])

  const deleteImage  = (imgKey) => {
    setImgList(prev => prev.filter(im => im.imgKey !== imgKey))
    setDays(prev => prev.filter(d => d.imgKey !== imgKey))
  }
  const clearAll     = () => { setImgList([]); setDays([]) }
  const deleteDay    = (idx) => setDays(prev => prev.filter((_, i) => i !== idx))
  const startEdit    = (idx) => { setEditingIdx(idx); setEditValue(String(days[idx].pnl)) }
  const commitEdit   = () => {
    if (editingIdx === null) return
    const v = parseFloat(editValue)
    if (!isNaN(v)) setDays(prev => { const d = [...prev]; d[editingIdx] = { ...d[editingIdx], pnl: v }; return d })
    setEditingIdx(null)
  }

  // ── Estilos base ───────────────────────────────────────────────────────────
  const card   = { background: "var(--card-bg)", border: "1px solid var(--border-card)", borderRadius: "14px", padding: "18px" }
  const lbl    = { fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }
  const sel    = { background: "var(--input-bg)", border: "1px solid var(--border-input)", borderRadius: "8px", color: "var(--text-1)", padding: "8px 12px", fontSize: "14px", width: "100%", cursor: "pointer" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Config ── */}
      <div style={{ ...card, display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ minWidth: "120px" }}>
          <div style={lbl}>Firma</div>
          <select style={sel} value={firmKey} onChange={e => { setFirmKey(e.target.value); setAccountIdx(0) }}>
            {Object.entries(FIRMS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
          </select>
        </div>

        <div style={{ minWidth: "100px" }}>
          <div style={lbl}>Cuenta</div>
          <select style={sel} value={accountIdx} onChange={e => setAccountIdx(Number(e.target.value))}>
            {firm.accounts.map((a, i) => <option key={i} value={i}>{a.label}</option>)}
          </select>
        </div>

        <div>
          <div style={lbl}>Multiplicador de riesgo</div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {[1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.35, 2.5, 3.0].map(m => (
              <button key={m} onClick={() => setRiskMult(m)} style={{
                padding: "7px 9px", borderRadius: "7px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                background: riskMult === m ? "#10b981" : "var(--input-bg)",
                color: riskMult === m ? "#fff" : "var(--text-muted)",
                border: `1px solid ${riskMult === m ? "#10b981" : "var(--border-input)"}`,
              }}>
                {m}x
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={lbl}>Regla personal 4.9%</div>
          <button onClick={() => setPersonalRule(p => !p)} style={{
            padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
            background: personalRule ? "rgba(16,185,129,0.15)" : "var(--input-bg)",
            color: personalRule ? "#10b981" : "var(--text-muted)",
            border: `1px solid ${personalRule ? "rgba(16,185,129,0.4)" : "var(--border-input)"}`,
          }}>
            {personalRule ? "✓ Activada" : "Desactivada"}
          </button>
        </div>

        {/* Resumen de reglas */}
        <div style={{ marginLeft: "auto", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.8", textAlign: "right" }}>
          <div>Objetivo F1: <b style={{ color: "var(--text-2)" }}>{fmtUsd(account.size * firm.rules.f1TargetPct)}</b> · F2: <b style={{ color: "var(--text-2)" }}>{fmtUsd(account.size * firm.rules.f2TargetPct)}</b></div>
          <div>Límite diario: <b style={{ color: "#ef4444" }}>-{(firm.rules.dailyLimitPct * 100).toFixed(0)}%</b> · Máx drawdown: <b style={{ color: "#ef4444" }}>-{(firm.rules.maxDrawdownPct * 100).toFixed(0)}%</b></div>
        </div>
      </div>

      {/* ── Contenido principal ── */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "20px", alignItems: "start" }}>

        {/* ── Columna izquierda: Upload + datos ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => document.getElementById("bt-file-input").click()}
            style={{
              ...card,
              border: `2px dashed ${dragOver ? "#10b981" : "var(--border-input)"}`,
              background: dragOver ? "rgba(16,185,129,0.04)" : "var(--card-bg)",
              textAlign: "center", cursor: "pointer", transition: "all 0.2s",
            }}
          >
            <input id="bt-file-input" type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFileInput} />
            <div style={{ fontSize: "38px", marginBottom: "10px" }}>📸</div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text-1)", marginBottom: "5px" }}>Arrastra tus fotos aquí</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
              Calendarios de FXReplay<br />Múltiples imágenes a la vez
            </div>
            {loading && (
              <div style={{ marginTop: "12px", color: "#10b981", fontSize: "13px", fontWeight: 600 }}>
                Analizando con IA...
              </div>
            )}
          </div>

          {/* Lista de imágenes */}
          {imgList.length > 0 && (
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div style={lbl}>Imágenes procesadas</div>
                <button onClick={clearAll} style={{ fontSize: "11px", color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "6px", padding: "3px 8px", cursor: "pointer", fontWeight: 600 }}>
                  Borrar todas
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "260px", overflowY: "auto" }}>
                {imgList.map((img) => (
                  <div key={img.imgKey} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "5px 8px", background: "var(--input-bg)", borderRadius: "6px" }}>
                    <span style={{ color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{img.name}</span>
                    <span style={{ fontWeight: 700, flexShrink: 0, color: img.status === "ok" ? "#10b981" : img.status === "error" ? "#ef4444" : "#f59e0b" }}>
                      {img.status === "ok" ? `✓ ${img.count}` : img.status === "error" ? "✗" : "..."}
                    </span>
                    <button onClick={() => deleteImage(img.imgKey)} title="Eliminar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", lineHeight: 1, flexShrink: 0, padding: "0 2px" }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)", borderTop: "1px solid var(--border-card)", paddingTop: "8px" }}>
                {days.length} días · {imgList.filter(i => i.status === "ok").length} imágenes exitosas
              </div>
            </div>
          )}

          {/* Tabla de días extraídos (editable) */}
          {days.length > 0 && (
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-card)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-1)" }}>Días extraídos</span>
                <button onClick={() => { setDays([]); setImgList([]) }} style={{ fontSize: "12px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  Limpiar todo
                </button>
              </div>
              <div style={{ maxHeight: "380px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--input-bg)", position: "sticky", top: 0 }}>
                      <th style={{ padding: "7px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Fecha</th>
                      <th style={{ padding: "7px 10px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600 }}>P&L</th>
                      <th style={{ width: "32px" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d, idx) => (
                      <tr key={d.date} style={{ borderBottom: "1px solid var(--border-card)" }}>
                        <td style={{ padding: "5px 10px", color: "var(--text-2)" }}>{d.date}</td>
                        <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 600 }}>
                          {editingIdx === idx ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingIdx(null) }}
                              style={{ width: "75px", padding: "2px 5px", textAlign: "right", background: "var(--input-bg)", border: "1px solid #10b981", borderRadius: "4px", color: "var(--text-1)", fontSize: "12px" }}
                            />
                          ) : (
                            <span onClick={() => startEdit(idx)} style={{ cursor: "pointer", color: d.pnl >= 0 ? "#10b981" : "#ef4444" }} title="Clic para editar">
                              {d.pnl >= 0 ? "+" : ""}{pnlUnit === "pct" ? `${d.pnl.toFixed(2)}%` : `$${Math.abs(d.pnl).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button onClick={() => deleteDay(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "15px", lineHeight: 1 }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Columna derecha: Resultados ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {simulation.length > 0 ? (
            <>
              {/* Stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                {[
                  { label: "Intentos totales", value: stats.attempts, color: "var(--text-1)" },
                  { label: "Veces fondeado",   value: stats.funded,   color: "#10b981" },
                  { label: "Cuentas quemadas", value: stats.blown,    color: "#ef4444" },
                  { label: "Tasa de fondeo",   value: `${stats.rate}%`, color: stats.rate >= 60 ? "#10b981" : stats.rate >= 40 ? "#f59e0b" : "#ef4444" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ ...card, padding: "14px 16px" }}>
                    <div style={{ ...lbl, marginBottom: "4px" }}>{label}</div>
                    <div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div>
                  </div>
                ))}
              </div>


              {/* Leyenda */}
              <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
                {[
                  { color: "#10b981", label: "Fondeado" },
                  { color: "#ef4444", label: "Quemada (drawdown)" },
                  { color: "#9ca3af", label: "En progreso" },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: color, flexShrink: 0 }} />
                    {label}
                  </div>
                ))}
              </div>

              {/* Tabla de intentos */}
              <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "var(--input-bg)" }}>
                        {["#", "Progreso", "Inicio", "Fin", "Días", "F1 P&L", "F2 P&L", "Resultado", "Detalle"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: h === "#" || h === "Días" ? "center" : "left", color: "var(--text-muted)", fontWeight: 600, fontSize: "11px", whiteSpace: "nowrap" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {simulation.map((a) => (
                        <tr key={a.num} style={{ borderBottom: "1px solid var(--border-card)" }}>
                          <td style={{ padding: "9px 12px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>{a.num}</td>
                          <td style={{ padding: "9px 12px", fontWeight: 700, whiteSpace: "nowrap", color: a.result === "FONDEADO" ? "#10b981" : a.result === "QUEMADA" ? "#ef4444" : "var(--text-muted)" }}>
                            {a.progress}
                          </td>
                          <td style={{ padding: "9px 12px", color: "var(--text-2)", whiteSpace: "nowrap" }}>{a.startDate}</td>
                          <td style={{ padding: "9px 12px", color: "var(--text-2)", whiteSpace: "nowrap" }}>{a.endDate}</td>
                          <td style={{ padding: "9px 12px", textAlign: "center", color: "var(--text-2)" }}>{a.days}</td>
                          <td style={{ padding: "9px 12px", fontWeight: 700, whiteSpace: "nowrap", color: a.pnlF1 >= 0 ? "#10b981" : "#ef4444" }}>
                            {fmtUsd(a.pnlF1)}
                            {a.blownPhase === "F1" && <span style={{ fontSize: "10px", color: "#ef4444", marginLeft: "4px" }}>✗F1</span>}
                          </td>
                          <td style={{ padding: "9px 12px", fontWeight: 700, whiteSpace: "nowrap", color: a.pnlF2 === null ? "var(--text-muted)" : a.pnlF2 >= 0 ? "#10b981" : "#ef4444" }}>
                            {a.pnlF2 === null ? "—" : fmtUsd(a.pnlF2)}
                            {a.blownPhase === "F2" && <span style={{ fontSize: "10px", color: "#ef4444", marginLeft: "4px" }}>✗F2</span>}
                          </td>
                          <td style={{ padding: "9px 12px" }}><ResultBadge result={a.result} /></td>
                          <td style={{ padding: "9px 12px", color: "var(--text-muted)", fontSize: "12px" }}>{a.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div style={{ ...card, textAlign: "center", padding: "60px 30px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "48px", marginBottom: "14px" }}>📊</div>
              <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px", color: "var(--text-2)" }}>
                Sube tus fotos para ver la simulación
              </div>
              <div style={{ fontSize: "13px", lineHeight: "1.6", maxWidth: "340px", margin: "0 auto" }}>
                Arrastra los calendarios de FXReplay y configura las reglas de tu firma. La IA extrae los valores diarios automáticamente.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
