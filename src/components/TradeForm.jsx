import { useRef, useState, useCallback, useEffect } from "react"
import { uploadImageFile } from "../lib/storage"

const inputStyle = {
  background: "var(--inner-bg)",
  border: "1px solid var(--border-input)",
  color: "var(--text-1)",
  padding: "12px 14px",
  borderRadius: "10px",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "Inter, Arial, sans-serif",
}

const label = (text) => (
  <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "7px" }}>
    {text}
  </div>
)

const divider = (
  <div style={{ height: "1px", background: "var(--border-row)", margin: "18px 0" }} />
)

const MAX_IMAGES = 10

function ImageZone({ images = [], onChange }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")

  const addFiles = useCallback(async (files) => {
    const toAdd = Array.from(files).slice(0, MAX_IMAGES - images.length).filter((f) => f.type.startsWith("image/"))
    if (!toAdd.length) return
    setUploading(true)
    setUploadError("")
    try {
      const urls = []
      const CHUNK = 3
      for (let i = 0; i < toAdd.length; i += CHUNK) {
        const chunk = toAdd.slice(i, i + CHUNK)
        const results = await Promise.all(chunk.map(uploadImageFile))
        urls.push(...results)
      }
      onChange([...images, ...urls])
    } catch (err) {
      console.error("[ImageZone upload]", err)
      setUploadError("No se pudo subir la imagen. Verifica tu conexión.")
    } finally {
      setUploading(false)
    }
  }, [images, onChange])

  useEffect(() => {
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || [])
      const imageFiles = items
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(Boolean)
      if (imageFiles.length === 0) return
      e.preventDefault()
      addFiles(imageFiles)
    }
    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [addFiles])

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: images.length > 0 ? "8px" : 0 }}>
        {images.map((src, i) => (
          <div key={i} style={{ position: "relative", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--border-input)", aspectRatio: "16/10" }}>
            <img src={src} onClick={() => setLightbox(src)} style={{ width: "100%", height: "100%", display: "block", objectFit: "cover", background: "#060b14", cursor: "zoom-in" }} />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, idx) => idx !== i))}
              style={{ position: "absolute", top: "6px", right: "6px", width: "24px", height: "24px", borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "14px", cursor: "pointer", display: "grid", placeItems: "center" }}
            >×</button>
            <span style={{ position: "absolute", bottom: "6px", left: "8px", fontSize: "10px", color: "rgba(255,255,255,0.45)", fontWeight: "600" }}>{i + 1}</span>
          </div>
        ))}
      </div>

      {images.length < MAX_IMAGES && (
        <div
          onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (!uploading) addFiles(e.dataTransfer.files) }}
          onClick={() => { if (!uploading) inputRef.current.click() }}
          style={{
            border: `1.5px dashed ${dragging ? "#10b981" : "rgba(16,185,129,0.35)"}`,
            borderRadius: "10px",
            padding: "13px",
            textAlign: "center",
            cursor: uploading ? "wait" : "pointer",
            color: uploading ? "var(--text-muted)" : "#10b981",
            fontWeight: "600",
            fontSize: "13px",
            background: dragging ? "rgba(16,185,129,0.04)" : "transparent",
            transition: "all 0.15s",
          }}
        >
          {uploading ? "Subiendo imagen..." : (
            <span>
              + Agregar capturas de pantalla
              <span style={{ display: "block", fontSize: "11px", fontWeight: "500", opacity: 0.6, marginTop: "3px" }}>
                o pega con Ctrl+V
              </span>
            </span>
          )}
          <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} disabled={uploading} />
        </div>
      )}

      {uploadError && (
        <div style={{ marginTop: "6px", fontSize: "12px", color: "#f87171" }}>{uploadError}</div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, cursor: "zoom-out", padding: "24px" }}>
          <img src={lightbox} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "10px", objectFit: "contain" }} />
        </div>
      )}
    </div>
  )
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active ? "" : opt.value)}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: "10px",
              border: active ? `1.5px solid ${opt.color}` : "1px solid var(--border-input)",
              background: active ? `${opt.color}15` : "var(--inner-bg)",
              color: active ? opt.color : "var(--text-muted)",
              fontWeight: active ? "700" : "500",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function TradeForm({ form, setForm, onAddTrade, isEditing, accounts, strategies = [], onCancel, isReview = false }) {
  const handleProfitChange = (e) => {
    const v = e.target.value
    if (v === "" || /^-?\d*\.?\d*$/.test(v)) setForm({ ...form, profit: v })
  }

  const isReady = form.symbol && form.profit !== ""

  return (
    <div style={{ background: "var(--card-bg)", padding: "24px", borderRadius: "20px", border: "1px solid var(--border-card)" }}>

      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
          {isEditing ? "Edición" : "Entrada rápida"}
        </div>
        <h2 style={{ margin: "5px 0 0", fontSize: "18px", fontWeight: "700", color: "var(--text-1)" }}>
          {isEditing ? "Editar Trade" : "Agregar Trade"}
        </h2>
      </div>

      {/* Grid básico */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          {label("Símbolo")}
          <input placeholder="BTCUSD" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} style={inputStyle} />
        </div>
        <div>
          {label("Dirección")}
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle}>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>
        <div>
          {label("P&L ($)")}
          <input placeholder="0.00" value={form.profit} onChange={handleProfitChange} style={inputStyle} type="number" step="0.01" />
        </div>
        <div>
          {label("Cuenta")}
          <select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} style={inputStyle}>
            <option value="">{accounts.length > 0 ? "Seleccionar" : "Sin cuentas"}</option>
            {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>
        <div>
          {label("Fecha")}
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
        </div>
        <div>
          {label("Hora apertura")}
          <input type="time" value={form.openTime} onChange={(e) => setForm({ ...form, openTime: e.target.value })} style={inputStyle} />
        </div>
        <div>
          {label("Stop Loss (pips)")}
          <input placeholder="0" value={form.stopLoss || ""} onChange={(e) => setForm({ ...form, stopLoss: e.target.value })} style={inputStyle} type="number" step="1" min="0" />
        </div>
        <div>
          {label("Take Profit (pips)")}
          <input placeholder="0" value={form.takeProfit || ""} onChange={(e) => setForm({ ...form, takeProfit: e.target.value })} style={inputStyle} type="number" step="1" min="0" />
        </div>

        {isReview && (() => {
          const isLoss = form.profit !== "" && Number(form.profit) < 0
          const isWin  = form.profit !== "" && Number(form.profit) >= 0
          return (
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>

              {/* RR Favorable — trades en pérdida */}
              <div>
                <div style={{ fontSize: "10px", color: isLoss ? "#f59e0b" : "rgba(245,158,11,0.3)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "7px" }}>
                  RR Favorable alcanzado
                </div>
                <input
                  placeholder="Ej: 0.8"
                  value={form.maxFavorableRR || ""}
                  onChange={(e) => setForm({ ...form, maxFavorableRR: e.target.value })}
                  disabled={!isLoss}
                  style={{
                    ...inputStyle,
                    border: `1px solid ${isLoss ? "rgba(245,158,11,0.4)" : "rgba(245,158,11,0.1)"}`,
                    opacity: isLoss ? 1 : 0.4,
                    cursor: isLoss ? "text" : "not-allowed",
                  }}
                  type="number"
                  step="0.1"
                  min="0"
                />
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", lineHeight: "1.5" }}>
                  ¿Hasta qué RR llegó a tu favor antes de revertir?
                  {isLoss && form.maxFavorableRR && Number(form.maxFavorableRR) > 0 && (
                    <span style={{ display: "block", marginTop: "3px", color: "#f59e0b", fontWeight: "600" }}>
                      Favorable: {Number(form.maxFavorableRR).toFixed(1)}R
                    </span>
                  )}
                </div>
              </div>

              {/* RR Máximo — trades en ganancia */}
              <div>
                <div style={{ fontSize: "10px", color: isWin ? "#a855f7" : "rgba(168,85,247,0.3)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "7px" }}>
                  RR Máximo alcanzado
                </div>
                <input
                  placeholder="Ej: 2.5"
                  value={form.maxRR || ""}
                  onChange={(e) => setForm({ ...form, maxRR: e.target.value })}
                  disabled={isLoss}
                  style={{
                    ...inputStyle,
                    border: `1px solid ${isWin ? "rgba(168,85,247,0.4)" : "rgba(168,85,247,0.1)"}`,
                    opacity: isWin ? 1 : .4,
                    cursor: isWin ? "text" : "not-allowed",
                  }}
                  type="number"
                  step="0.1"
                  min="0"
                />
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px", lineHeight: "1.5" }}>
                  ¿Hasta qué RR llegó el precio antes de cerrar o revertir?
                  {isWin && form.maxRR && Number(form.maxRR) > 0 && (
                    <span style={{ display: "block", marginTop: "3px", color: "#a855f7", fontWeight: "600" }}>
                      Máximo: {Number(form.maxRR).toFixed(1)}R
                    </span>
                  )}
                </div>
              </div>

            </div>
          )
        })()}
      </div>

      {divider}

      {/* Estrategia */}
      <div style={{ marginBottom: "4px", fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.16em" }}>
        Estrategia
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
        <div>
          {label("Estrategia utilizada")}
          <select value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })} style={inputStyle}>
            <option value="">Sin estrategia</option>
            {strategies.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div>
          {label("Calidad del setup")}
          <ToggleGroup
            value={form.setupQuality}
            onChange={(v) => setForm({ ...form, setupQuality: v })}
            options={[
              { value: "malo",     label: "Setup Malo",     color: "#f87171" },
              { value: "bueno",    label: "Setup Bueno",    color: "#94a3b8" },
              { value: "perfecto", label: "Setup Perfecto", color: "#10b981" },
            ]}
          />
        </div>
      </div>

      {divider}

      {/* Entrada */}
      <div style={{ marginBottom: "12px", fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.16em" }}>
        Entrada
      </div>
      <div style={{ marginBottom: "6px", fontSize: "12px", color: "#10b981" }}>¿Por qué ejecutaste la entrada en ese punto exacto?</div>
      <textarea
        placeholder="Describe tu análisis..."
        value={form.entryNote || ""}
        onChange={(e) => setForm({ ...form, entryNote: e.target.value })}
        style={{ ...inputStyle, minHeight: "88px", resize: "vertical", lineHeight: "1.55", marginBottom: "10px" }}
      />
      <ImageZone
        images={form.entryImages || []}
        onChange={(imgs) => setForm({ ...form, entryImages: imgs })}
      />

      {divider}

      {/* Acciones */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={onAddTrade}
          disabled={!isReady}
          style={{
            flex: 1,
            background: isReady ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(148,163,184,0.07)",
            color: isReady ? "#fff" : "var(--text-muted)",
            border: "none",
            padding: "13px 20px",
            borderRadius: "12px",
            fontWeight: "700",
            fontSize: "14px",
            cursor: isReady ? "pointer" : "not-allowed",
          }}
        >
          {isEditing ? "Actualizar Trade" : "Agregar Trade"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{ padding: "13px 20px", borderRadius: "12px", border: "1px solid var(--border-input)", background: "transparent", color: "var(--text-muted)", fontWeight: "600", fontSize: "14px", cursor: "pointer" }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
