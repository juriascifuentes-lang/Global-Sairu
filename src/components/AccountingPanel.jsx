import { useState, useEffect, useMemo } from "react"
import { supabase } from "../lib/supabase"

const fmt = (n) =>
  `$${Math.abs(Number(n)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtShort = (n) => {
  const abs = Math.abs(Number(n))
  if (abs >= 1000) return `$${(abs / 1000).toFixed(1)}k`
  return fmt(n)
}

const PROP_FIRMS = [
  "Lucid Trading", "Alpha Futures", "Tradeify", "Topstep", "Apex",
  "FTMO", "WSF", "ORION", "The 5%ers", "Funding Pips", "Alpha Capital",
  "Funded Next", "MFF", "Take Profit Trader",
]

const OTHER_CATEGORIES = ["Plataformas", "Suscripciones", "VPS", "Educación", "Otros"]

const TIPOS = [
  { key: "retiro", label: "Retirada",   color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  { key: "examen", label: "Examen",     color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  { key: "gasto",  label: "Otro gasto", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
]

const getEntryTipo = (e) => {
  if (e.entry_type === "retiro") return "retiro"
  if (e.category === "Prop Firms") return "examen"
  return "gasto"
}

const tipoInfo = (tipo) => TIPOS.find((t) => t.key === tipo) || TIPOS[2]

const defaultForm = {
  id: null,
  tipo: "retiro",
  prop: "",
  category: "Plataformas",
  importe: "",
  currency: "USD",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
}

// ── Monthly bar chart ────────────────────────────────────────────
function useMonthlyData(entries) {
  const months = useMemo(() => {
    const result = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      result.push({ key, label: d.toLocaleString("es-MX", { month: "short" }) })
    }
    return result
  }, [])

  return useMemo(() => months.map(({ key, label }) => {
    const mes = entries.filter((e) => e.entry_date.startsWith(key))
    const retiros = mes.filter((e) => getEntryTipo(e) === "retiro").reduce((s, e) => s + Number(e.amount), 0)
    const costes  = mes.filter((e) => getEntryTipo(e) === "examen").reduce((s, e) => s + Number(e.amount), 0)
    return { label, retiros, costes }
  }), [months, entries])
}

// ── Totales por mes (a la par de la gráfica) ────────────────────
function MonthlyTotals({ data }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", minWidth: "280px", alignContent: "start" }}>
      {data.map(({ label, retiros, costes }) => {
        const neto = retiros - costes
        return (
          <div key={label} style={{
            background: "var(--inner-bg)", borderRadius: "10px",
            padding: "8px 12px", display: "flex", flexDirection: "column", gap: "3px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                {label}
              </span>
              <span style={{ fontSize: "12px", fontWeight: "800", color: neto >= 0 ? "#10b981" : "#f87171" }}>
                {neto >= 0 ? "+" : ""}{fmt(neto)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
              <span style={{ color: "#10b981" }}>+{fmt(retiros)}</span>
              <span style={{ color: "#f87171" }}>-{fmt(costes)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MonthlyChart({ data }) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.retiros, d.costes)), 1)
  const W = 600, H = 160
  const PAD = { top: 16, right: 10, bottom: 28, left: 52 }
  const cW = W - PAD.left - PAD.right
  const cH = H - PAD.top - PAD.bottom
  const groupW = cW / data.length
  const bW = groupW * 0.28
  const yOf = (v) => PAD.top + cH - (v / maxVal) * cH

  const hasData = data.some((d) => d.retiros > 0 || d.costes > 0)

  if (!hasData) {
    return (
      <div style={{ height: "160px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
        Sin datos en los últimos 6 meses
      </div>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "160px" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = yOf(maxVal * t)
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="rgba(148,163,184,0.4)" fontFamily="Inter, sans-serif">
              {fmtShort(maxVal * t)}
            </text>
          </g>
        )
      })}
      {data.map(({ label, retiros, costes }, i) => {
        const cx = PAD.left + i * groupW + groupW / 2
        const rH = Math.max((retiros / maxVal) * cH, retiros > 0 ? 2 : 0)
        const eH = Math.max((costes / maxVal) * cH, costes > 0 ? 2 : 0)
        return (
          <g key={label}>
            {retiros > 0 && (
              <rect x={cx - bW - 2} y={yOf(retiros)} width={bW} height={rH}
                fill="#10b981" opacity="0.8" rx="3" />
            )}
            {costes > 0 && (
              <rect x={cx + 2} y={yOf(costes)} width={bW} height={eH}
                fill="#f87171" opacity="0.8" rx="3" />
            )}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="rgba(148,163,184,0.5)" fontFamily="Inter, sans-serif">
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Stat card ────────────────────────────────────────────────────
function StatCard({ label, value, valueColor, sub, icon }) {
  return (
    <div style={{
      background: "var(--card-bg)", borderRadius: "16px",
      border: "1px solid rgba(148,163,184,0.08)", padding: "20px 22px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text-muted)" }}>
          {label}
        </span>
        <span style={{ color: valueColor || "var(--text-muted)", opacity: 0.6 }}>{icon}</span>
      </div>
      <div style={{ fontSize: "24px", fontWeight: "800", color: valueColor || "var(--text-1)", letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "5px" }}>{sub}</div>}
    </div>
  )
}

// ── Modal nuevo movimiento ───────────────────────────────────────
function MovimientoModal({ form, setForm, onSave, onClose, saving }) {
  const needsProp = form.tipo === "retiro" || form.tipo === "examen"

  const inputStyle = {
    width: "100%", background: "var(--inner-bg)", border: "1px solid var(--border-input)",
    color: "var(--text-1)", padding: "11px 14px", borderRadius: "10px",
    fontSize: "13px", outline: "none", fontFamily: "Inter, Arial, sans-serif", boxSizing: "border-box",
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: "100%", maxWidth: "460px", background: "var(--card-bg)", borderRadius: "20px", border: "1px solid rgba(148,163,184,0.08)", padding: "28px" }}>
        {/* Header modal */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
          <div>
            <div style={{ fontWeight: "700", fontSize: "16px", color: "var(--text-1)" }}>
              {form.id ? "Editar movimiento" : "Nuevo movimiento"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
              Añade un movimiento manualmente
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px", padding: "4px", lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Tipo de movimiento */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "8px" }}>
              Tipo de movimiento
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              {TIPOS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, tipo: t.key }))}
                  style={{
                    flex: 1, padding: "9px 10px", borderRadius: "10px",
                    border: form.tipo === t.key ? `1.5px solid ${t.color}` : "1px solid var(--border-input)",
                    background: form.tipo === t.key ? t.bg : "transparent",
                    color: form.tipo === t.key ? t.color : "var(--text-muted)",
                    fontWeight: form.tipo === t.key ? "700" : "500",
                    fontSize: "12px", cursor: "pointer", fontFamily: "Inter, Arial, sans-serif",
                    transition: "all 0.12s",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prop firm (para retiro y examen) */}
          {needsProp && (
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "6px" }}>
                Prop Firm
              </label>
              <input
                list="prop-firms-list"
                value={form.prop}
                onChange={(e) => setForm((p) => ({ ...p, prop: e.target.value }))}
                placeholder="Buscar o escribir prop firm"
                style={inputStyle}
                autoFocus
              />
              <datalist id="prop-firms-list">
                {PROP_FIRMS.map((pf) => <option key={pf} value={pf} />)}
              </datalist>
            </div>
          )}

          {/* Categoría (solo para gasto) */}
          {form.tipo === "gasto" && (
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "6px" }}>
                Categoría
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {OTHER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Importe + Currency */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "6px" }}>
                Importe <span style={{ color: "#f87171" }}>*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.importe}
                onChange={(e) => setForm((p) => ({ ...p, importe: e.target.value }))}
                placeholder="100.00"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "6px" }}>
                Currency
              </label>
              <select
                value={form.currency}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                style={{ ...inputStyle, cursor: "pointer", width: "80px" }}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "6px" }}>
              Fecha <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {/* Notas */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "6px" }}>
              Notas
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Opcional..."
              rows={2}
              style={{ ...inputStyle, resize: "vertical", minHeight: "64px" }}
            />
          </div>

          {/* Botones */}
          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: "11px", borderRadius: "11px",
                border: "1px solid var(--border-input)", background: "transparent",
                color: "var(--text-muted)", fontWeight: "600", fontSize: "13px",
                cursor: "pointer", fontFamily: "Inter, Arial, sans-serif",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              disabled={saving || !form.importe || !form.date}
              style={{
                flex: 1, padding: "11px", borderRadius: "11px", border: "none",
                background: saving || !form.importe || !form.date
                  ? "rgba(16,185,129,0.4)"
                  : "linear-gradient(135deg,#10b981,#059669)",
                color: "#fff", fontWeight: "700", fontSize: "13px",
                cursor: saving || !form.importe || !form.date ? "not-allowed" : "pointer",
                fontFamily: "Inter, Arial, sans-serif",
              }}
            >
              {saving ? "Guardando..." : form.id ? "Actualizar" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── OCR / Extraer historial modal ────────────────────────────────
function ExtraerModal({ userId, onClose, onImported }) {
  const [step, setStep]         = useState("upload") // "upload"|"analyzing"|"results"|"importing"
  const [imageFile, setImageFile] = useState(null)
  const [preview, setPreview]   = useState(null)
  const [drag, setDrag]         = useState(false)
  const [data, setData]         = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [company, setCompany]   = useState("")
  const [error, setError]       = useState(null)
  const [typeOverrides, setTypeOverrides] = useState({}) // { [index]: "retiro"|"examen"|"gasto" }

  const handleFile = (file) => {
    if (!file) return
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!ok.includes(file.type)) { setError("Solo imágenes JPG, PNG o WEBP"); return }
    if (file.size > 8 * 1024 * 1024) { setError("Máximo 8 MB"); return }
    setImageFile(file)
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const analyze = async () => {
    if (!imageFile) return
    setStep("analyzing")
    setError(null)
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = (e) => res(e.target.result.split(",")[1])
        r.onerror = rej
        r.readAsDataURL(imageFile)
      })
      const resp = await fetch("/api/funding/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: b64, mimeType: imageFile.type }),
      })
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({ error: resp.statusText }))
        throw new Error(e.error || "Error del servidor")
      }
      const result = await resp.json()
      if (!result.transactions?.length) throw new Error("No se detectaron transacciones en la imagen")
      setData(result)
      setCompany(result.company || "")
      // pre-seleccionar solo las válidas
      setSelected(new Set(result.transactions.map((t, i) => t.valid ? i : -1).filter(i => i !== -1)))
      setStep("results")
    } catch (e) {
      setError(e.message)
      setStep("upload")
    }
  }

  // Corrige fechas imposibles que devuelve el OCR (ej: "2024-02-30" → "2024-02-29")
  const safeDate = (raw) => {
    if (!raw) return new Date().toISOString().slice(0, 10)
    const parts = raw.split("-").map(Number)
    if (parts.length !== 3 || parts.some(isNaN)) return new Date().toISOString().slice(0, 10)
    const [y, m, d] = parts
    const lastDay = new Date(y, m, 0).getDate() // día máximo del mes
    const clampedDay = Math.min(d, lastDay)
    return `${y}-${String(m).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`
  }

  const doImport = async () => {
    setStep("importing")
    setError(null)
    const comp = company.trim() || data.company || null
    const rows = data.transactions
      .map((t, i) => ({ t, i }))
      .filter(({ i }) => selected.has(i))
      .map(({ t, i }) => {
        const effectiveType = getRowType(i, t)
        const isRetiro = effectiveType === "retiro"
        const isExamen = effectiveType === "examen"
        return {
          user_id: userId,
          name: t.description || (isRetiro ? "Retiro" : isExamen ? "Examen" : "Gasto"),
          amount: Number(t.amount),
          entry_type: isRetiro ? "retiro" : "gasto",
          category: "Prop Firms",
          subcategory: isExamen ? "Examen" : null,
          company: comp,
          entry_date: safeDate(t.date),
          notes: `OCR · ${t.status}`,
        }
      })

    const { error: dbErr } = await supabase.from("accounting_entries").insert(rows)
    if (dbErr) {
      setError(`Error al guardar: ${dbErr.message}`)
      setStep("results")
      return
    }

    // Auto-guardar imagen como certificado de retiro si hay retiros importados
    const hasRetiros = rows.some((r) => r.entry_type === "retiro")
    if (hasRetiros && imageFile) {
      try {
        const ext = imageFile.name.split(".").pop()
        const path = `${userId}/${Date.now()}-ocr.${ext}`
        const { error: upErr } = await supabase.storage
          .from("funding-certificates")
          .upload(path, imageFile, { contentType: imageFile.type, upsert: false })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from("funding-certificates").getPublicUrl(path)
          await supabase.from("funding_certificates").insert({
            user_id: userId,
            company: comp,
            cert_type: "retiro",
            file_url: publicUrl,
            file_name: imageFile.name,
            amount: null,
            notes: "Guardado automáticamente desde importación OCR",
          })
        }
      } catch (_) { /* no bloquear si falla el cert */ }
    }

    onImported()
    onClose()
  }

  const toggle = (i) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(i) ? next.delete(i) : next.add(i)
    return next
  })

  const setRowType = (i, type) => setTypeOverrides((prev) => ({ ...prev, [i]: type }))
  const getRowType = (i, t) => typeOverrides[i] ?? t.type

  const selTotal = data?.transactions.filter((_, i) => selected.has(i)).reduce((s, t) => s + t.amount, 0) || 0

  const inputStyle = {
    background: "var(--inner-bg)", border: "1px solid var(--border-input)",
    color: "var(--text-1)", padding: "9px 12px", borderRadius: "9px",
    fontSize: "13px", outline: "none", fontFamily: "Inter, Arial, sans-serif",
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: "100%", maxWidth: step === "results" ? "640px" : "480px", background: "var(--card-bg)", borderRadius: "20px", border: "1px solid rgba(148,163,184,0.08)", padding: "28px", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
          <div>
            <div style={{ fontWeight: "700", fontSize: "16px", color: "var(--text-1)" }}>Importar historial</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
              {step === "upload" && "Sube una imagen y Claude extraerá los movimientos"}
              {step === "analyzing" && "Analizando imagen con IA..."}
              {step === "results" && `${data?.transactions.length} transacciones detectadas`}
              {step === "importing" && "Importando movimientos..."}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px", padding: "4px" }}>✕</button>
        </div>

        {/* ── Step: Upload ── */}
        {(step === "upload") && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {error && (
              <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "12px 14px", fontSize: "13px", color: "#f87171" }}>
                {error}
              </div>
            )}
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => document.getElementById("ocr-file-input").click()}
              style={{
                border: drag ? "2px dashed #a855f7" : imageFile ? "2px solid #a855f7" : "2px dashed var(--border-input)",
                borderRadius: "14px", padding: "0", textAlign: "center", cursor: "pointer",
                background: drag ? "rgba(168,85,247,0.05)" : "transparent", transition: "all 0.15s",
                overflow: "hidden",
              }}
            >
              <input id="ocr-file-input" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
              {preview ? (
                <div style={{ position: "relative" }}>
                  <img src={preview} alt="preview" style={{ width: "100%", maxHeight: "320px", objectFit: "contain", display: "block" }} />
                  <div style={{ position: "absolute", bottom: "10px", right: "10px", background: "rgba(0,0,0,0.7)", borderRadius: "8px", padding: "4px 10px", fontSize: "11px", color: "#fff" }}>
                    click para cambiar
                  </div>
                </div>
              ) : (
                <div style={{ padding: "48px 24px" }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.4 }}>🤖</div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-muted)" }}>Arrastra o haz clic</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px", opacity: 0.7 }}>
                    Historial de pagos, facturación, order history<br/>JPG, PNG · máx. 8 MB
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={analyze}
              disabled={!imageFile}
              style={{
                width: "100%", padding: "12px", borderRadius: "12px", border: "none",
                background: imageFile ? "linear-gradient(135deg,#a855f7,#7c3aed)" : "rgba(168,85,247,0.3)",
                color: "#fff", fontWeight: "700", fontSize: "14px",
                cursor: imageFile ? "pointer" : "not-allowed",
                boxShadow: imageFile ? "0 4px 14px rgba(168,85,247,0.3)" : "none",
              }}
            >
              🤖 Analizar con IA
            </button>
          </div>
        )}

        {/* ── Step: Analyzing ── */}
        {step === "analyzing" && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px", animation: "spin 2s linear infinite" }}>⚙️</div>
            <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-1)" }}>Analizando imagen...</div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "8px" }}>Claude está leyendo las transacciones</div>
            <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
          </div>
        )}

        {/* ── Step: Results ── */}
        {step === "results" && data && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Error de importación */}
            {error && (
              <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "12px 14px", fontSize: "13px", color: "#f87171" }}>
                {error}
              </div>
            )}
            {/* Empresa detectada (editable) */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "var(--inner-bg)", borderRadius: "11px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Empresa:</span>
              <input
                list="ocr-firms-list"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Prop firm detectada"
                style={{ ...inputStyle, flex: 1 }}
              />
              <datalist id="ocr-firms-list">
                {PROP_FIRMS.map((pf) => <option key={pf} value={pf} />)}
              </datalist>
            </div>

            {/* Selector global de tipo */}
            {(() => {
              const GLOBAL_TYPES = [
                { key: "retiro", label: "↑ Retiro",  color: "#10b981", bg: "rgba(16,185,129,0.13)" },
                { key: "examen", label: "✕ Examen",  color: "#f87171", bg: "rgba(248,113,113,0.13)" },
                { key: "gasto",  label: "$ Gasto",   color: "#94a3b8", bg: "rgba(148,163,184,0.13)" },
              ]
              // Detecta si todos los válidos tienen el mismo tipo
              const validIdxs = data.transactions.map((t, i) => t.valid ? i : null).filter((i) => i !== null)
              const allSameType = validIdxs.length > 0 && validIdxs.every((i) => getRowType(i, data.transactions[i]) === getRowType(validIdxs[0], data.transactions[validIdxs[0]]))
              const currentGlobal = allSameType ? getRowType(validIdxs[0], data.transactions[validIdxs[0]]) : null
              const setAllTypes = (type) => {
                const overrides = {}
                data.transactions.forEach((t, i) => { if (t.valid) overrides[i] = type })
                setTypeOverrides(overrides)
              }
              return (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "var(--inner-bg)", borderRadius: "11px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>Tipo para todos:</span>
                  <div style={{ display: "flex", gap: "6px", flex: 1 }}>
                    {GLOBAL_TYPES.map((gt) => (
                      <button key={gt.key} type="button"
                        onClick={() => setAllTypes(gt.key)}
                        style={{
                          flex: 1, padding: "7px 0", borderRadius: "9px", border: "none",
                          background: currentGlobal === gt.key ? gt.bg : "transparent",
                          color: currentGlobal === gt.key ? gt.color : "var(--text-muted)",
                          fontWeight: currentGlobal === gt.key ? "800" : "500",
                          fontSize: "12px", cursor: "pointer",
                          outline: currentGlobal === gt.key ? `1.5px solid ${gt.color}` : "1px solid var(--border-sub)",
                          fontFamily: "Inter, Arial, sans-serif", transition: "all 0.12s",
                        }}
                      >{gt.label}</button>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Resumen */}
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ flex: 1, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "10px", padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Seleccionadas</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "#10b981", marginTop: "4px" }}>{selected.size}</div>
              </div>
              <div style={{ flex: 1, background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: "10px", padding: "10px 14px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Total a importar</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "#a855f7", marginTop: "4px" }}>{fmt(selTotal)}</div>
              </div>
            </div>

            {/* Tabla de transacciones */}
            <div style={{ background: "var(--inner-bg)", borderRadius: "12px", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 82px 90px 78px", gap: "6px", padding: "8px 12px", borderBottom: "1px solid var(--border-nav)" }}>
                {["", "Descripción / Tipo", "Fecha", "Importe", "Estado"].map((h) => (
                  <span key={h} style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>{h}</span>
                ))}
              </div>
              {data.transactions.map((t, i) => {
                const isSel = selected.has(i)
                const rowType = getRowType(i, t)
                const rowColor = !t.valid ? "rgba(248,113,113,0.06)" : isSel ? "transparent" : "rgba(148,163,184,0.03)"
                const amtColor = rowType === "retiro" ? "#10b981" : "#f87171"
                const TYPE_BTNS = [
                  { key: "retiro", label: "↑ Retiro",  color: "#10b981", bg: "rgba(16,185,129,0.13)" },
                  { key: "examen", label: "✕ Examen",  color: "#f87171", bg: "rgba(248,113,113,0.13)" },
                  { key: "gasto",  label: "$ Gasto",   color: "#94a3b8", bg: "rgba(148,163,184,0.13)" },
                ]
                return (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "32px 1fr 82px 90px 78px",
                    gap: "6px", padding: "10px 12px", borderBottom: "1px solid var(--border-sub)",
                    alignItems: "center", background: rowColor,
                    opacity: !t.valid ? 0.5 : 1,
                  }}>
                    {/* Checkbox */}
                    <div
                      onClick={() => t.valid && toggle(i)}
                      style={{
                        width: "18px", height: "18px", borderRadius: "5px",
                        border: `2px solid ${isSel && t.valid ? "#10b981" : "var(--border-input)"}`,
                        background: isSel && t.valid ? "#10b981" : "transparent",
                        display: "grid", placeItems: "center", flexShrink: 0,
                        cursor: t.valid ? "pointer" : "default",
                      }}
                    >
                      {isSel && t.valid && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>

                    {/* Descripción + selector de tipo */}
                    <div>
                      <div
                        onClick={() => t.valid && toggle(i)}
                        style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-1)", cursor: t.valid ? "pointer" : "default", marginBottom: "5px" }}
                      >{t.description || "—"}</div>
                      {/* Botones de tipo (solo si la fila es válida) */}
                      {t.valid && (
                        <div style={{ display: "flex", gap: "4px" }}>
                          {TYPE_BTNS.map((tb) => (
                            <button
                              key={tb.key}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setRowType(i, tb.key) }}
                              style={{
                                padding: "2px 7px", borderRadius: "5px", border: "none",
                                background: rowType === tb.key ? tb.bg : "transparent",
                                color: rowType === tb.key ? tb.color : "var(--text-muted)",
                                fontWeight: rowType === tb.key ? "700" : "400",
                                fontSize: "10px", cursor: "pointer",
                                outline: rowType === tb.key ? `1px solid ${tb.color}` : "1px solid var(--border-sub)",
                                fontFamily: "Inter, Arial, sans-serif",
                                transition: "all 0.1s",
                              }}
                            >{tb.label}</button>
                          ))}
                        </div>
                      )}
                    </div>

                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t.date}</span>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: amtColor }}>
                      {rowType === "retiro" ? "+" : "-"}{fmt(t.amount)}
                    </span>
                    <span style={{
                      fontSize: "10px", fontWeight: "700", padding: "3px 7px", borderRadius: "5px",
                      background: t.valid ? "rgba(16,185,129,0.12)" : "rgba(248,113,113,0.12)",
                      color: t.valid ? "#10b981" : "#f87171",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {t.status}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Volver + Importar */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => { setStep("upload"); setData(null); setError(null); setTypeOverrides({}) }}
                style={{ flex: 0, padding: "11px 18px", borderRadius: "11px", border: "1px solid var(--border-input)", background: "transparent", color: "var(--text-muted)", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}
              >
                ← Volver
              </button>
              <button
                onClick={doImport}
                disabled={selected.size === 0}
                style={{
                  flex: 1, padding: "11px", borderRadius: "11px", border: "none",
                  background: selected.size > 0 ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(16,185,129,0.3)",
                  color: "#fff", fontWeight: "700", fontSize: "13px",
                  cursor: selected.size > 0 ? "pointer" : "not-allowed",
                }}
              >
                Importar {selected.size} movimiento{selected.size !== 1 ? "s" : ""} · {fmt(selTotal)}
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Importing ── */}
        {step === "importing" && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
            <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-1)" }}>Guardando movimientos...</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Certificate upload modal (estado propio para evitar desincronización) ──
function CertModal({ onSave, onClose, uploading }) {
  // items: [{ id, file, preview, cert_type }]
  const [items, setItems]       = useState([])
  const [company, setCompany]   = useState("")
  const [drag, setDrag]         = useState(false)

  const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]

  const addFiles = (fileList) => {
    const valid = Array.from(fileList).filter((f) => {
      if (!ALLOWED.includes(f.type)) return false
      if (f.size > 10 * 1024 * 1024) return false
      return true
    })
    valid.forEach((f) => {
      const id = `${Date.now()}-${Math.random()}`
      const reader = new FileReader()
      reader.onload = (e) => {
        setItems((prev) => [...prev, { id, file: f, preview: e.target.result, cert_type: "cuenta_aprobada" }])
      }
      reader.readAsDataURL(f)
    })
  }

  const removeItem = (id) => setItems((prev) => prev.filter((x) => x.id !== id))
  const setType = (id, type) => setItems((prev) => prev.map((x) => x.id === id ? { ...x, cert_type: type } : x))

  const canSubmit = items.length > 0 && company.trim()

  const inputStyle = {
    background: "var(--inner-bg)", border: "1px solid var(--border-input)",
    color: "var(--text-1)", padding: "10px 13px", borderRadius: "10px",
    fontSize: "13px", outline: "none", fontFamily: "Inter, Arial, sans-serif",
  }

  const CERT_TYPES = [
    { key: "cuenta_aprobada", label: "✓ Aprobada", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    { key: "retiro",          label: "↑ Retiro",   color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  ]

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: "100%", maxWidth: "580px", background: "var(--card-bg)", borderRadius: "20px", border: "1px solid rgba(148,163,184,0.08)", padding: "28px", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
          <div>
            <div style={{ fontWeight: "700", fontSize: "16px", color: "var(--text-1)" }}>Subir certificados</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
              Puedes subir varias imágenes a la vez · máx. 10 MB cada una
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px", padding: "4px", lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Prop firm (compartida) */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "6px" }}>
              Prop Firm <span style={{ color: "#f87171" }}>*</span>
            </label>
            <input
              list="cert-firms-list" value={company} autoFocus
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nombre de la prop firm para todos los certificados"
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
            />
            <datalist id="cert-firms-list">
              {PROP_FIRMS.map((pf) => <option key={pf} value={pf} />)}
            </datalist>
          </div>

          {/* Zona drag & drop */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
            onClick={() => document.getElementById("cert-multi-input").click()}
            style={{
              border: drag ? "2px dashed #10b981" : "2px dashed var(--border-input)",
              borderRadius: "14px", padding: "28px 16px", textAlign: "center",
              cursor: "pointer", transition: "all 0.15s",
              background: drag ? "rgba(16,185,129,0.05)" : "transparent",
            }}
          >
            <input
              id="cert-multi-input" type="file" accept="image/*,.pdf" multiple
              style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)}
            />
            <div style={{ fontSize: "32px", marginBottom: "10px", opacity: 0.4 }}>⬆</div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-muted)" }}>
              Arrastra aquí o haz clic para seleccionar
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "5px", opacity: 0.7 }}>
              JPG, PNG, PDF · puedes seleccionar varias a la vez
            </div>
          </div>

          {/* Lista de imágenes seleccionadas */}
          {items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>
                {items.length} imagen{items.length !== 1 ? "es" : ""} seleccionada{items.length !== 1 ? "s" : ""}
              </div>
              {items.map((item) => {
                const isPdf = item.file.type === "application/pdf"
                return (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--inner-bg)", borderRadius: "12px", padding: "10px 12px" }}>
                    {/* Thumbnail */}
                    <div style={{ width: "52px", height: "52px", borderRadius: "8px", overflow: "hidden", flexShrink: 0, background: "var(--card-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isPdf
                        ? <span style={{ fontSize: "24px" }}>📄</span>
                        : <img src={item.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      }
                    </div>
                    {/* Nombre */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.file.name}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {(item.file.size / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </div>
                    {/* Tipo por imagen */}
                    <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
                      {CERT_TYPES.map((t) => (
                        <button key={t.key} type="button"
                          onClick={() => setType(item.id, t.key)}
                          style={{
                            padding: "5px 10px", borderRadius: "8px", border: "none",
                            background: item.cert_type === t.key ? t.bg : "transparent",
                            color: item.cert_type === t.key ? t.color : "var(--text-muted)",
                            fontWeight: item.cert_type === t.key ? "700" : "500",
                            fontSize: "11px", cursor: "pointer",
                            outline: item.cert_type === t.key ? `1.5px solid ${t.color}` : "1px solid var(--border-input)",
                          }}
                        >{t.label}</button>
                      ))}
                    </div>
                    {/* Eliminar */}
                    <button
                      onClick={() => removeItem(item.id)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px", padding: "4px", lineHeight: 1, flexShrink: 0 }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171" }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
                    >✕</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Botones */}
          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button onClick={onClose} style={{ flex: 0, padding: "11px 20px", borderRadius: "11px", border: "1px solid var(--border-input)", background: "transparent", color: "var(--text-muted)", fontWeight: "600", fontSize: "13px", cursor: "pointer", fontFamily: "Inter, Arial, sans-serif" }}>
              Cancelar
            </button>
            <button
              onClick={() => onSave({ company, items })}
              disabled={uploading || !canSubmit}
              style={{
                flex: 1, padding: "11px", borderRadius: "11px", border: "none",
                background: uploading || !canSubmit ? "rgba(16,185,129,0.35)" : "linear-gradient(135deg,#10b981,#059669)",
                color: "#fff", fontWeight: "700", fontSize: "13px",
                cursor: uploading || !canSubmit ? "not-allowed" : "pointer",
                fontFamily: "Inter, Arial, sans-serif",
              }}
            >
              {uploading
                ? "Subiendo..."
                : canSubmit
                  ? `Subir ${items.length} certificado${items.length !== 1 ? "s" : ""}`
                  : "Selecciona imágenes y prop firm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Certificate gallery ──────────────────────────────────────────
function CertCard({ cert, onDelete, selected, onToggle }) {
  const [hovered, setHovered] = useState(false)
  const isPdf = cert.file_name?.toLowerCase().endsWith(".pdf")
  const isAprobada = cert.cert_type === "cuenta_aprobada"
  const typeColor = isAprobada ? "#10b981" : "#38bdf8"
  const typeBg = isAprobada ? "rgba(16,185,129,0.12)" : "rgba(56,189,248,0.12)"
  const typeLabel = isAprobada ? "Cuenta aprobada" : "Retiro"

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--card-bg)", borderRadius: "14px",
        border: selected ? "1.5px solid #10b981" : "1px solid rgba(148,163,184,0.08)",
        overflow: "hidden",
        transition: "transform 0.15s, box-shadow 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: selected ? "0 0 0 3px rgba(16,185,129,0.15)" : hovered ? "0 8px 24px rgba(0,0,0,0.25)" : "none",
        position: "relative",
      }}
    >
      {/* Checkbox overlay */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggle(cert.id) }}
        style={{
          position: "absolute", top: "8px", left: "8px", zIndex: 10,
          width: "20px", height: "20px", borderRadius: "6px",
          border: `2px solid ${selected ? "#10b981" : "rgba(255,255,255,0.5)"}`,
          background: selected ? "#10b981" : "rgba(0,0,0,0.45)",
          display: "grid", placeItems: "center", cursor: "pointer",
          opacity: selected || hovered ? 1 : 0,
          transition: "opacity 0.15s",
          backdropFilter: "blur(4px)",
        }}
      >
        {selected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
      {/* Thumbnail / preview */}
      <div
        onClick={() => window.open(cert.file_url, "_blank")}
        style={{
          height: "160px", background: "var(--inner-bg)", display: "flex",
          alignItems: "center", justifyContent: "center", cursor: "pointer",
          overflow: "hidden",
        }}
      >
        {isPdf ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "8px" }}>📄</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", maxWidth: "140px", wordBreak: "break-all", padding: "0 8px" }}>
              {cert.file_name}
            </div>
          </div>
        ) : (
          <img src={cert.file_url} alt={cert.company}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-1)" }}>{cert.company}</div>
          <button
            onClick={() => onDelete(cert)}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", lineHeight: 1, fontSize: "12px" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171" }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
        </div>
        <span style={{ fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "5px", background: typeBg, color: typeColor }}>
          {typeLabel}
        </span>
        {cert.amount && (
          <div style={{ fontSize: "13px", fontWeight: "700", color: "#38bdf8", marginTop: "6px" }}>
            +{fmt(cert.amount)}
          </div>
        )}
        {cert.notes && (
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{cert.notes}</div>
        )}
        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "6px", opacity: 0.6 }}>
          {new Date(cert.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────
export function AccountingPanel({ userId }) {
  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState(() => {
    const saved = localStorage.getItem("funding_tab")
    return ["resumen", "empresas", "certificados"].includes(saved) ? saved : "resumen"
  })
  const changeTab = (t) => { setTab(t); localStorage.setItem("funding_tab", t) }
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]         = useState(defaultForm)
  const [saving, setSaving]     = useState(false)
  const [filterProp, setFilterProp] = useState("")
  const [filterTipo, setFilterTipo] = useState("")
  const [selEntries, setSelEntries] = useState(new Set())
  const monthlyData = useMonthlyData(entries)

  // Certificados state
  const [certs, setCerts]           = useState([])
  const [loadingCerts, setLoadingCerts] = useState(false)
  const [showCertModal, setShowCertModal] = useState(false)
  // certForm ya no se usa — el modal CertModal maneja su propio estado
  const [uploadingCert, setUploadingCert] = useState(false)
  const [showExtraer, setShowExtraer]     = useState(false)
  const [certFilter, setCertFilter] = useState("all") // "all" | "cuenta_aprobada" | "retiro"
  const [selCerts, setSelCerts] = useState(new Set())
  const toggleSelCert = (id) => setSelCerts((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  useEffect(() => { if (userId) load() }, [userId])
  useEffect(() => { if (userId && tab === "certificados") loadCerts() }, [userId, tab])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from("accounting_entries")
      .select("*")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setForm({ ...defaultForm, date: new Date().toISOString().slice(0, 10) })
    setShowModal(true)
  }

  const openEdit = (e) => {
    const tipo = getEntryTipo(e)
    setForm({
      id: e.id,
      tipo,
      prop: e.company || "",
      category: tipo === "gasto" ? (e.category || "Plataformas") : "Plataformas",
      importe: String(e.amount),
      currency: e.currency || "USD",
      date: e.entry_date,
      notes: e.notes || "",
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.importe || !form.date) return
    setSaving(true)
    const isRetiro = form.tipo === "retiro"
    const isExamen = form.tipo === "examen"
    const payload = {
      user_id: userId,
      name: form.prop || (isRetiro ? "Retiro" : isExamen ? "Examen" : form.category),
      amount: parseFloat(form.importe),
      entry_type: isRetiro ? "retiro" : "gasto",
      category: isExamen ? "Prop Firms" : (isRetiro ? "Prop Firms" : form.category),
      subcategory: isExamen ? "Examen" : null,
      company: (isRetiro || isExamen) ? (form.prop || null) : null,
      entry_date: form.date,
      notes: form.notes.trim() || null,
    }
    if (form.id) {
      await supabase.from("accounting_entries").update(payload).eq("id", form.id)
    } else {
      await supabase.from("accounting_entries").insert(payload)
    }
    await load()
    setShowModal(false)
    setSaving(false)
  }

  async function handleDelete(e) {
    if (!window.confirm("¿Eliminar este movimiento?")) return
    await supabase.from("accounting_entries").delete().eq("id", e.id)
    setEntries((prev) => prev.filter((x) => x.id !== e.id))
    setSelEntries((prev) => { const n = new Set(prev); n.delete(e.id); return n })
  }

  async function handleBulkDelete() {
    if (selEntries.size === 0) return
    if (!window.confirm(`¿Eliminar ${selEntries.size} movimiento${selEntries.size !== 1 ? "s" : ""}? Esta acción no se puede deshacer.`)) return
    const ids = [...selEntries]
    await supabase.from("accounting_entries").delete().in("id", ids)
    setEntries((prev) => prev.filter((x) => !selEntries.has(x.id)))
    setSelEntries(new Set())
  }

  const toggleSelEntry = (id) => setSelEntries((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  // ── Certificados ───────────────────────────────────────────────
  async function loadCerts() {
    setLoadingCerts(true)
    const { data } = await supabase
      .from("funding_certificates")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
    setCerts(data || [])
    setLoadingCerts(false)
  }

  async function handleCertUpload({ company, items }) {
    if (!items?.length || !company) return
    setUploadingCert(true)
    for (const item of items) {
      const ext = item.file.name.split(".").pop()
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from("funding-certificates")
        .upload(path, item.file, { contentType: item.file.type, upsert: false })
      if (upErr) { alert(`Error al subir ${item.file.name}: ${upErr.message}`); continue }
      const { data: { publicUrl } } = supabase.storage
        .from("funding-certificates")
        .getPublicUrl(path)
      await supabase.from("funding_certificates").insert({
        user_id: userId,
        company: company.trim(),
        cert_type: item.cert_type,
        file_url: publicUrl,
        file_name: item.file.name,
        amount: null,
        notes: null,
      })
    }
    await loadCerts()
    setShowCertModal(false)
    setUploadingCert(false)
  }

  async function handleCertDelete(cert) {
    if (!window.confirm("¿Eliminar este certificado?")) return
    const url = new URL(cert.file_url)
    const storagePath = url.pathname.split("/object/public/funding-certificates/")[1]
    if (storagePath) await supabase.storage.from("funding-certificates").remove([storagePath])
    await supabase.from("funding_certificates").delete().eq("id", cert.id)
    setCerts((prev) => prev.filter((c) => c.id !== cert.id))
    setSelCerts((p) => { const n = new Set(p); n.delete(cert.id); return n })
  }

  async function handleBulkCertDelete() {
    if (selCerts.size === 0) return
    if (!window.confirm(`¿Eliminar ${selCerts.size} certificado${selCerts.size !== 1 ? "s" : ""}? Esta acción no se puede deshacer.`)) return
    const toDelete = certs.filter((c) => selCerts.has(c.id))
    const paths = toDelete
      .map((c) => { try { return new URL(c.file_url).pathname.split("/object/public/funding-certificates/")[1] } catch { return null } })
      .filter(Boolean)
    if (paths.length) await supabase.storage.from("funding-certificates").remove(paths)
    await supabase.from("funding_certificates").delete().in("id", [...selCerts])
    setCerts((prev) => prev.filter((c) => !selCerts.has(c.id)))
    setSelCerts(new Set())
  }

  const filteredCerts = useMemo(() => {
    if (certFilter === "all") return certs
    return certs.filter((c) => c.cert_type === certFilter)
  }, [certs, certFilter])

  // ── Stats ──────────────────────────────────────────────────────
  const totalRetiros  = entries.filter((e) => getEntryTipo(e) === "retiro").reduce((s, e) => s + Number(e.amount), 0)
  const totalExamenes = entries.filter((e) => getEntryTipo(e) === "examen").reduce((s, e) => s + Number(e.amount), 0)
  const totalOtros    = entries.filter((e) => getEntryTipo(e) === "gasto").reduce((s, e) => s + Number(e.amount), 0)
  const beneficioTotal = totalRetiros - totalExamenes
  const costesTotal    = totalExamenes + totalOtros
  const roiGlobal      = totalExamenes > 0 ? (beneficioTotal / totalExamenes) * 100 : null

  // ── Ranking de props ───────────────────────────────────────────
  const propRanking = useMemo(() => {
    const map = {}
    entries.forEach((e) => {
      const company = e.company
      if (!company) return
      if (!map[company]) map[company] = { name: company, retiros: 0, costes: 0 }
      const tipo = getEntryTipo(e)
      if (tipo === "retiro") map[company].retiros += Number(e.amount)
      else if (tipo === "examen") map[company].costes += Number(e.amount)
    })
    return Object.values(map)
      .map((p) => ({ ...p, beneficio: p.retiros - p.costes, roi: p.costes > 0 ? ((p.retiros - p.costes) / p.costes) * 100 : null }))
      .sort((a, b) => b.beneficio - a.beneficio)
  }, [entries])

  // ── Filtered movimientos ───────────────────────────────────────
  const filtered = useMemo(() => entries.filter((e) => {
    if (filterProp && e.company !== filterProp) return false
    if (filterTipo && getEntryTipo(e) !== filterTipo) return false
    return true
  }), [entries, filterProp, filterTipo])

  const propsInData = useMemo(() => [...new Set(entries.filter((e) => e.company).map((e) => e.company))].sort(), [entries])

  // ── Tab selector ──────────────────────────────────────────────
  const TabBtn = ({ id, label }) => (
    <button
      onClick={() => changeTab(id)}
      style={{
        padding: "8px 20px", borderRadius: "10px", border: "none",
        background: tab === id ? "var(--card-bg)" : "transparent",
        color: tab === id ? "var(--text-1)" : "var(--text-muted)",
        fontWeight: tab === id ? "700" : "500", fontSize: "13px",
        cursor: "pointer", fontFamily: "Inter, Arial, sans-serif",
        boxShadow: tab === id ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
            Finanzas
          </p>
          <h1 style={{ margin: "6px 0 4px", fontSize: "32px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            Funding Manager
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>
            Gestiona tus retiradas, costes y movimientos de fondeo
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
          {tab === "certificados" ? (
            <button
              onClick={() => setShowCertModal(true)}
              style={{
                padding: "11px 20px", borderRadius: "12px", border: "none",
                background: "linear-gradient(135deg,#38bdf8,#0284c7)",
                color: "#fff", fontWeight: "700", fontSize: "13px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                boxShadow: "0 4px 14px rgba(56,189,248,0.3)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Subir certificado
            </button>
          ) : (
            <>
              {/* Botón secundario: Importar historial con IA */}
              <button
                onClick={() => setShowExtraer(true)}
                style={{
                  padding: "11px 18px", borderRadius: "12px",
                  border: "1.5px solid rgba(168,85,247,0.4)",
                  background: "rgba(168,85,247,0.08)",
                  color: "#a855f7", fontWeight: "700", fontSize: "13px",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "7px",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(168,85,247,0.15)" }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(168,85,247,0.08)" }}
              >
                🤖 Importar historial
              </button>
              {/* Botón primario: Nuevo movimiento */}
              <button
                onClick={openAdd}
                style={{
                  padding: "11px 20px", borderRadius: "12px", border: "none",
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  color: "#fff", fontWeight: "700", fontSize: "13px",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                  boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Nuevo movimiento
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
        <StatCard
          label="Beneficio Total"
          value={fmt(beneficioTotal)}
          valueColor={beneficioTotal >= 0 ? "#10b981" : "#f87171"}
          sub={`Retiros − Exámenes`}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>}
        />
        <StatCard
          label="Retiradas Totales"
          value={fmt(totalRetiros)}
          valueColor="#10b981"
          sub={`${entries.filter((e) => getEntryTipo(e) === "retiro").length} retiros`}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 12 12 16 16 12"/><line x1="12" y1="8" x2="12" y2="16"/><circle cx="12" cy="12" r="10"/></svg>}
        />
        <StatCard
          label="Coste Total Exámenes"
          value={fmt(totalExamenes)}
          valueColor="#f87171"
          sub={`${entries.filter((e) => getEntryTipo(e) === "examen").length} exámenes`}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/><circle cx="12" cy="12" r="10"/></svg>}
        />
        <StatCard
          label="ROI Global"
          value={roiGlobal !== null ? `${roiGlobal >= 0 ? "+" : ""}${roiGlobal.toFixed(1)}%` : "—"}
          valueColor={roiGlobal !== null ? (roiGlobal >= 0 ? "#10b981" : "#f87171") : "var(--text-muted)"}
          sub="Sobre costes de exámenes"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", background: "var(--inner-bg)", borderRadius: "14px", padding: "4px", width: "fit-content" }}>
        <TabBtn id="resumen" label="Resumen" />
        <TabBtn id="empresas" label="Empresas" />
        <TabBtn id="certificados" label="Certificados" />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)", fontSize: "14px" }}>Cargando...</div>
      ) : tab === "resumen" ? (

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Evolución mensual + Ranking */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "14px" }}>

            {/* Evolución mensual */}
            <div style={{ background: "var(--card-bg)", borderRadius: "18px", border: "1px solid rgba(148,163,184,0.08)", padding: "22px 24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Últimos 6 meses
                </div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--text-1)" }}>Evolución mensual</h3>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Comparativa de retiradas vs costes de exámenes</p>
              </div>
              <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MonthlyChart data={monthlyData} />
                  <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#10b981" }} />
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Retiradas</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#f87171" }} />
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Exámenes</span>
                    </div>
                  </div>
                </div>
                <MonthlyTotals data={monthlyData} />
              </div>
            </div>

            {/* Ranking de props */}
            <div style={{ background: "var(--card-bg)", borderRadius: "18px", border: "1px solid rgba(148,163,184,0.08)", padding: "22px 24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Por prop firm
                </div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--text-1)" }}>Ranking de props</h3>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Orden por beneficio acumulado</p>
              </div>
              {propRanking.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "13px", paddingTop: "20px" }}>
                  No hay datos de ranking aún
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {propRanking.map((p, i) => (
                    <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "10px", background: "var(--inner-bg)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", width: "16px" }}>
                          {i + 1}
                        </span>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-1)" }}>{p.name}</div>
                          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "1px" }}>
                            +{fmt(p.retiros)} retiros · -{fmt(p.costes)} costes
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "14px", fontWeight: "800", color: p.beneficio >= 0 ? "#10b981" : "#f87171" }}>
                          {p.beneficio >= 0 ? "+" : ""}{fmt(p.beneficio)}
                        </div>
                        {p.roi !== null && (
                          <div style={{ fontSize: "10px", color: p.roi >= 0 ? "#10b981" : "#f87171", fontWeight: "600" }}>
                            {p.roi >= 0 ? "+" : ""}{p.roi.toFixed(0)}% ROI
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Movimientos */}
          <div style={{ background: "var(--card-bg)", borderRadius: "18px", border: "1px solid rgba(148,163,184,0.08)", overflow: "hidden" }}>
            {/* Header movimientos */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--text-1)" }}>Movimientos</h3>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Listado de retiradas y costes</p>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {selEntries.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    style={{
                      padding: "8px 14px", borderRadius: "10px", border: "none",
                      background: "rgba(248,113,113,0.15)", color: "#f87171",
                      fontWeight: "700", fontSize: "12px", cursor: "pointer",
                      fontFamily: "Inter, Arial, sans-serif", display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                    Eliminar {selEntries.size}
                  </button>
                )}
                <select
                  value={filterProp}
                  onChange={(e) => setFilterProp(e.target.value)}
                  style={{
                    background: "var(--inner-bg)", border: "1px solid var(--border-input)",
                    color: filterProp ? "var(--text-1)" : "var(--text-muted)",
                    padding: "8px 12px", borderRadius: "10px", fontSize: "12px",
                    outline: "none", cursor: "pointer", fontFamily: "Inter, Arial, sans-serif",
                  }}
                >
                  <option value="">Todas las props</option>
                  {propsInData.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  style={{
                    background: "var(--inner-bg)", border: "1px solid var(--border-input)",
                    color: filterTipo ? "var(--text-1)" : "var(--text-muted)",
                    padding: "8px 12px", borderRadius: "10px", fontSize: "12px",
                    outline: "none", cursor: "pointer", fontFamily: "Inter, Arial, sans-serif",
                  }}
                >
                  <option value="">Todos los tipos</option>
                  {TIPOS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)", fontSize: "13px" }}>
                {entries.length === 0
                  ? "Sin movimientos registrados. Haz clic en \"+ Nuevo movimiento\" para comenzar."
                  : "No hay movimientos con los filtros seleccionados."}
              </div>
            ) : (
              <>
                {/* Tabla header */}
                {(() => {
                  const allSel = filtered.length > 0 && filtered.every((e) => selEntries.has(e.id))
                  const someSel = !allSel && filtered.some((e) => selEntries.has(e.id))
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 110px 120px 110px 60px", gap: "8px", padding: "10px 24px", borderTop: "1px solid var(--border-nav)", borderBottom: "1px solid var(--border-nav)", background: "rgba(148,163,184,0.03)", alignItems: "center" }}>
                      {/* Checkbox seleccionar todo */}
                      <div
                        onClick={() => {
                          if (allSel) {
                            setSelEntries((prev) => { const n = new Set(prev); filtered.forEach((e) => n.delete(e.id)); return n })
                          } else {
                            setSelEntries((prev) => { const n = new Set(prev); filtered.forEach((e) => n.add(e.id)); return n })
                          }
                        }}
                        style={{
                          width: "16px", height: "16px", borderRadius: "4px", cursor: "pointer",
                          border: `2px solid ${allSel ? "#10b981" : someSel ? "#10b981" : "var(--border-input)"}`,
                          background: allSel ? "#10b981" : someSel ? "rgba(16,185,129,0.3)" : "transparent",
                          display: "grid", placeItems: "center",
                        }}
                      >
                        {(allSel || someSel) && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      {["Movimiento", "Tipo", "Fecha", "Importe", ""].map((h) => (
                        <span key={h} style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>{h}</span>
                      ))}
                    </div>
                  )
                })()}

                {/* Filas */}
                {filtered.map((entry) => {
                  const tipo = getEntryTipo(entry)
                  const info = tipoInfo(tipo)
                  const amount = Number(entry.amount)
                  const isR = tipo === "retiro"
                  const amountColor = isR ? "#10b981" : "#f87171"
                  const amountLabel = isR ? `+${fmt(amount)}` : `-${fmt(amount)}`
                  const isSel = selEntries.has(entry.id)
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: "grid", gridTemplateColumns: "36px 1fr 110px 120px 110px 60px",
                        gap: "8px", padding: "13px 24px", borderBottom: "1px solid var(--border-sub)",
                        alignItems: "center", transition: "background 0.12s",
                        background: isSel ? "rgba(16,185,129,0.05)" : "transparent",
                      }}
                      onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--nav-hover)" }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isSel ? "rgba(16,185,129,0.05)" : "transparent" }}
                    >
                      {/* Checkbox */}
                      <div
                        onClick={() => toggleSelEntry(entry.id)}
                        style={{
                          width: "16px", height: "16px", borderRadius: "4px", cursor: "pointer",
                          border: `2px solid ${isSel ? "#10b981" : "var(--border-input)"}`,
                          background: isSel ? "#10b981" : "transparent",
                          display: "grid", placeItems: "center", flexShrink: 0,
                        }}
                      >
                        {isSel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-1)" }}>
                          {entry.company || entry.name || entry.category}
                        </div>
                        {entry.notes && (
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{entry.notes}</div>
                        )}
                      </div>
                      <span style={{
                        fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "6px",
                        background: info.bg, color: info.color, width: "fit-content",
                      }}>
                        {info.label}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {new Date(entry.entry_date + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: "700", color: amountColor }}>{amountLabel}</span>
                      <div style={{ display: "flex", gap: "2px", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => openEdit(entry)}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "5px", borderRadius: "6px", display: "grid", placeItems: "center" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#6366f1" }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(entry)}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "5px", borderRadius: "6px", display: "grid", placeItems: "center" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171" }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Footer totales filtrados */}
                <div style={{ display: "flex", gap: "20px", justifyContent: "flex-end", padding: "14px 24px", borderTop: "1px solid var(--border-nav)" }}>
                  {(() => {
                    const r = filtered.filter((e) => getEntryTipo(e) === "retiro").reduce((s, e) => s + Number(e.amount), 0)
                    const c = filtered.filter((e) => getEntryTipo(e) !== "retiro").reduce((s, e) => s + Number(e.amount), 0)
                    const n = r - c
                    return (
                      <>
                        {r > 0 && <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Retiros: <strong style={{ color: "#10b981" }}>+{fmt(r)}</strong></span>}
                        {c > 0 && <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Costes: <strong style={{ color: "#f87171" }}>-{fmt(c)}</strong></span>}
                        <span style={{ fontSize: "14px", fontWeight: "700", color: n >= 0 ? "#10b981" : "#f87171" }}>Neto: {n >= 0 ? "+" : ""}{fmt(n)}</span>
                      </>
                    )
                  })()}
                </div>
              </>
            )}
          </div>
        </div>

      ) : tab === "empresas" ? (
        /* ── Tab Empresas ── */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "14px" }}>
          {propRanking.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px", color: "var(--text-muted)", fontSize: "13px" }}>
              Sin datos por empresa. Agrega movimientos con prop firm asignada.
            </div>
          ) : propRanking.map((p) => (
            <div key={p.name} style={{ background: "var(--card-bg)", borderRadius: "16px", border: "1px solid rgba(148,163,184,0.08)", padding: "22px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-1)" }}>{p.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {entries.filter((e) => e.company === p.name).length} movimientos
                  </div>
                </div>
                <div style={{
                  fontSize: "13px", fontWeight: "700", padding: "4px 12px", borderRadius: "8px",
                  background: p.beneficio >= 0 ? "rgba(16,185,129,0.12)" : "rgba(248,113,113,0.12)",
                  color: p.beneficio >= 0 ? "#10b981" : "#f87171",
                }}>
                  {p.beneficio >= 0 ? "+" : ""}{fmt(p.beneficio)}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Retiradas</span>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#10b981" }}>+{fmt(p.retiros)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.12)" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Costes exámenes</span>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#f87171" }}>-{fmt(p.costes)}</span>
                </div>
                {p.roi !== null && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", background: "var(--inner-bg)" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>ROI</span>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: p.roi >= 0 ? "#10b981" : "#f87171" }}>
                      {p.roi >= 0 ? "+" : ""}{p.roi.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

      ) : (
        /* ── Tab Certificados ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Filtros tipo */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {[
              { key: "all", label: "Todos" },
              { key: "cuenta_aprobada", label: "✓ Cuentas aprobadas", color: "#10b981" },
              { key: "retiro", label: "↑ Retiros", color: "#38bdf8" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setCertFilter(f.key)}
                style={{
                  padding: "7px 16px", borderRadius: "10px", border: "none",
                  background: certFilter === f.key ? (f.color ? `${f.color}22` : "var(--card-bg)") : "var(--inner-bg)",
                  color: certFilter === f.key ? (f.color || "var(--text-1)") : "var(--text-muted)",
                  fontWeight: certFilter === f.key ? "700" : "500", fontSize: "12px",
                  cursor: "pointer", fontFamily: "Inter, Arial, sans-serif",
                  border: certFilter === f.key && f.color ? `1px solid ${f.color}44` : "1px solid transparent",
                  transition: "all 0.12s",
                }}
              >
                {f.label}
              </button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
              {selCerts.size > 0 && (
                <button
                  onClick={handleBulkCertDelete}
                  style={{
                    padding: "7px 14px", borderRadius: "10px", border: "none",
                    background: "rgba(248,113,113,0.15)", color: "#f87171",
                    fontWeight: "700", fontSize: "12px", cursor: "pointer",
                    fontFamily: "Inter, Arial, sans-serif", display: "flex", alignItems: "center", gap: "5px",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                  Eliminar {selCerts.size}
                </button>
              )}
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {filteredCerts.length} certificado{filteredCerts.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {loadingCerts ? (
            <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)", fontSize: "14px" }}>Cargando certificados...</div>
          ) : filteredCerts.length === 0 ? (
            /* Estado vacío */
            <div
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "80px 40px", background: "var(--card-bg)", borderRadius: "18px",
                border: "2px dashed rgba(148,163,184,0.12)", textAlign: "center",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>🏆</div>
              <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-1)", marginBottom: "8px" }}>
                Sin certificados
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "320px", marginBottom: "20px" }}>
                Sube tus certificados de cuentas aprobadas y retiros para tener tu historial completo
              </div>
              <button
                onClick={() => setShowCertModal(true)}
                style={{
                  padding: "10px 20px", borderRadius: "11px", border: "none",
                  background: "linear-gradient(135deg,#38bdf8,#0284c7)",
                  color: "#fff", fontWeight: "700", fontSize: "13px", cursor: "pointer",
                }}
              >
                Subir primer certificado
              </button>
            </div>
          ) : (
            /* Grid de certificados */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
              {filteredCerts.map((cert) => (
                <CertCard
                  key={cert.id} cert={cert} onDelete={handleCertDelete}
                  selected={selCerts.has(cert.id)} onToggle={toggleSelCert}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal movimiento */}
      {showModal && (
        <MovimientoModal
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}

      {/* Modal certificado */}
      {showCertModal && (
        <CertModal
          onSave={handleCertUpload}
          onClose={() => setShowCertModal(false)}
          uploading={uploadingCert}
        />
      )}

      {/* Modal importar historial con OCR */}
      {showExtraer && (
        <ExtraerModal
          userId={userId}
          onClose={() => setShowExtraer(false)}
          onImported={() => { load(); loadCerts(); setShowExtraer(false) }}
        />
      )}
    </div>
  )
}
