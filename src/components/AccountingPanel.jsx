import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"

const CATEGORIES = [
  { key: "Prop Firms",    color: "#f59e0b" },
  { key: "Plataformas",   color: "#6366f1" },
  { key: "Suscripciones", color: "#3b82f6" },
  { key: "VPS",           color: "#10b981" },
  { key: "Educación",     color: "#ec4899" },
  { key: "Otros",         color: "#94a3b8" },
]

const catColor = (cat) => CATEGORIES.find((c) => c.key === cat)?.color || "#94a3b8"
const fmt = (n) =>
  `$${Math.abs(Number(n)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const defaultForm = {
  id: null,
  name: "",
  amount: "",
  category: "Prop Firms",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
}

const card = {
  background: "var(--card-bg)",
  borderRadius: "16px",
  border: "1px solid rgba(148,163,184,0.08)",
  padding: "22px 24px",
}

export function AccountingPanel({ userId }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [filterMonth, setFilterMonth] = useState("")
  const [filterCategory, setFilterCategory] = useState("")

  useEffect(() => { if (userId) load() }, [userId])

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

  const openAdd = () => { setForm(defaultForm); setShowForm(true) }
  const openEdit = (e) => {
    setForm({ id: e.id, name: e.name, amount: String(e.amount), category: e.category, date: e.entry_date, notes: e.notes || "" })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.amount || !form.date) return
    setSaving(true)
    const payload = {
      user_id: userId,
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      category: form.category,
      entry_date: form.date,
      notes: form.notes.trim() || null,
    }
    if (form.id) {
      await supabase.from("accounting_entries").update(payload).eq("id", form.id)
    } else {
      await supabase.from("accounting_entries").insert(payload)
    }
    await load()
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar este gasto?")) return
    await supabase.from("accounting_entries").delete().eq("id", id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const filtered = entries.filter((e) => {
    if (filterMonth && !e.entry_date.startsWith(filterMonth)) return false
    if (filterCategory && e.category !== filterCategory) return false
    return true
  })

  const totalAll = entries.reduce((s, e) => s + Number(e.amount), 0)
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const totalThisMonth = entries
    .filter((e) => e.entry_date.startsWith(thisMonth))
    .reduce((s, e) => s + Number(e.amount), 0)
  const totalFiltered = filtered.reduce((s, e) => s + Number(e.amount), 0)

  const byCategory = CATEGORIES
    .map((c) => ({
      ...c,
      total: entries.filter((e) => e.category === c.key).reduce((s, e) => s + Number(e.amount), 0),
      count: entries.filter((e) => e.category === c.key).length,
    }))
    .filter((c) => c.total > 0)

  const months = [...new Set(entries.map((e) => e.entry_date.slice(0, 7)))].sort().reverse()

  const monthLabel = (ym) => {
    const [y, m] = ym.split("-")
    return new Date(Number(y), Number(m) - 1).toLocaleString("es-MX", { month: "long", year: "numeric" })
  }

  const inputStyle = {
    width: "100%",
    background: "var(--inner-bg)",
    border: "1px solid var(--border-input)",
    color: "var(--text-1)",
    padding: "11px 14px",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    fontFamily: "Inter, Arial, sans-serif",
    boxSizing: "border-box",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            Contabilidad
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--text-muted)" }}>
            Registro de gastos operativos de trading
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            padding: "11px 20px", borderRadius: "12px", border: "none",
            background: "linear-gradient(135deg,#10b981,#059669)",
            color: "#fff", fontWeight: "700", fontSize: "14px",
            cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
            boxShadow: "0 4px 12px rgba(16,185,129,0.25)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Agregar gasto
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "16px" }}>
        <div style={{ ...card, borderTop: "3px solid #f87171" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: "8px" }}>
            Total acumulado
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "#f87171", letterSpacing: "-0.02em" }}>
            -{fmt(totalAll)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            {entries.length} entradas
          </div>
        </div>

        <div style={{ ...card, borderTop: "3px solid #f59e0b" }}>
          <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: "8px" }}>
            Este mes
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "#f59e0b", letterSpacing: "-0.02em" }}>
            {totalThisMonth > 0 ? `-${fmt(totalThisMonth)}` : "$0.00"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            {new Date().toLocaleString("es-MX", { month: "long", year: "numeric" })}
          </div>
        </div>

        {byCategory.slice(0, 2).map((c) => (
          <div key={c.key} style={{ ...card, borderTop: `3px solid ${c.color}` }}>
            <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: "8px" }}>
              {c.key}
            </div>
            <div style={{ fontSize: "26px", fontWeight: "800", color: c.color, letterSpacing: "-0.02em" }}>
              -{fmt(c.total)}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              {c.count} entrada{c.count !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div style={card}>
          <h2 style={{ margin: "0 0 18px", fontSize: "14px", fontWeight: "700", color: "var(--text-1)" }}>
            Distribución por categoría
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {byCategory.map((c) => {
              const pct = totalAll > 0 ? (c.total / totalAll) * 100 : 0
              return (
                <div key={c.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: c.color, flexShrink: 0 }} />
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-1)" }}>{c.key}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{c.count} entrada{c.count !== 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: c.color }}>-{fmt(c.total)}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "6px" }}>{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div style={{ height: "5px", borderRadius: "3px", background: "rgba(148,163,184,0.1)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: c.color, borderRadius: "3px", transition: "width 0.4s" }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters + List */}
      <div style={card}>
        {/* Filtros */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            style={{ ...inputStyle, width: "auto", flex: "1 1 140px", cursor: "pointer" }}
          >
            <option value="">Todos los meses</option>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ ...inputStyle, width: "auto", flex: "1 1 140px", cursor: "pointer" }}
          >
            <option value="">Todas las categorías</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.key}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)", fontSize: "14px" }}>
            Cargando...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.6" }}>
            {entries.length === 0
              ? <>Sin gastos registrados.<br />Haz clic en <strong style={{ color: "var(--text-1)" }}>Agregar gasto</strong> para comenzar.</>
              : "No hay entradas con los filtros seleccionados."}
          </div>
        ) : (
          <>
            {/* Tabla */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 100px 120px 36px", gap: "8px", padding: "0 12px 10px", borderBottom: "1px solid var(--border-nav)", marginBottom: "4px" }}>
              {["Nombre", "Categoría", "Fecha", "Monto", ""].map((h) => (
                <span key={h} style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>{h}</span>
              ))}
            </div>

            {filtered.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 130px 100px 120px 36px",
                  gap: "8px", padding: "11px 12px", borderRadius: "10px", alignItems: "center",
                  cursor: "pointer", transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--nav-hover)" }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                onClick={() => openEdit(entry)}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-1)" }}>{entry.name}</div>
                  {entry.notes && (
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{entry.notes}</div>
                  )}
                </div>
                <span style={{
                  fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "6px",
                  background: `${catColor(entry.category)}1a`,
                  color: catColor(entry.category),
                  width: "fit-content",
                }}>
                  {entry.category}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {new Date(entry.entry_date + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#f87171" }}>
                  -{fmt(entry.amount)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(entry.id) }}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", borderRadius: "6px", display: "grid", placeItems: "center", transition: "color 0.12s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171" }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 12px 0", borderTop: "1px solid var(--border-nav)", marginTop: "6px" }}>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#f87171" }}>
                Total: -{fmt(totalFiltered)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Modal agregar/editar */}
      {showForm && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}
        >
          <div style={{ width: "100%", maxWidth: "440px", background: "var(--card-bg)", borderRadius: "20px", border: "1px solid rgba(148,163,184,0.08)", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div>
                <div style={{ fontWeight: "700", fontSize: "16px", color: "var(--text-1)" }}>
                  {form.id ? "Editar gasto" : "Agregar gasto"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
                  Registro de gasto operativo
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px", padding: "4px", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Nombre <span style={{ color: "#f87171" }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: FTMO Challenge 10K"
                  style={inputStyle}
                  autoFocus
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Monto (USD) <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Fecha <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Categoría
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.key}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Notas
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Opcional..."
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <button
                  onClick={() => setShowForm(false)}
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
                  onClick={handleSave}
                  disabled={saving || !form.name.trim() || !form.amount || !form.date}
                  style={{
                    flex: 1, padding: "11px", borderRadius: "11px", border: "none",
                    background: saving || !form.name.trim() || !form.amount || !form.date
                      ? "rgba(16,185,129,0.4)"
                      : "linear-gradient(135deg,#10b981,#059669)",
                    color: "#fff", fontWeight: "700", fontSize: "13px",
                    cursor: saving || !form.name.trim() || !form.amount || !form.date ? "not-allowed" : "pointer",
                    fontFamily: "Inter, Arial, sans-serif",
                  }}
                >
                  {saving ? "Guardando..." : form.id ? "Actualizar" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
