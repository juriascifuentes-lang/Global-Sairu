import { useState, useEffect, useRef } from "react"
import { supabase } from "../lib/supabase"

const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
const WEEKDAYS_SHORT = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]

const formatIso = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
const parseIso = (value) => { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d) }
const formatDateLabel = (value) => {
  if (!value) return ""
  return parseIso(value).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function DateRangePicker({ fromDate, toDate, onFromChange, onToChange }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [month, setMonth] = useState(() => fromDate ? parseIso(fromDate) : new Date())
  const [hoverDate, setHoverDate] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setHoverDate(null) } }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const openFor = (s) => {
    setStep(s)
    if (s === 1 && fromDate) setMonth(parseIso(fromDate))
    else if (s === 2 && toDate) setMonth(parseIso(toDate))
    setOpen(true)
  }

  const changeMonth = (offset) => {
    const next = new Date(month)
    next.setMonth(month.getMonth() + offset)
    setMonth(next)
  }

  const handleDayClick = (iso) => {
    if (step === 1) { onFromChange(iso); onToChange(""); setStep(2) }
    else {
      if (fromDate && iso < fromDate) { onFromChange(iso); onToChange(""); setStep(2) }
      else { onToChange(iso); setOpen(false); setHoverDate(null) }
    }
  }

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
  const firstDayIndex = (monthStart.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()

  const renderDay = (day) => {
    const date = new Date(month.getFullYear(), month.getMonth(), day)
    const iso = formatIso(date)
    const isFrom = iso === fromDate
    const endIso = toDate || (step === 2 && hoverDate ? hoverDate : null)
    const isTo = iso === endIso
    const inRange = fromDate && endIso && iso > fromDate && iso < endIso
    const isSelected = isFrom || isTo
    return (
      <button key={day} type="button"
        onClick={() => handleDayClick(iso)}
        onMouseEnter={() => step === 2 && setHoverDate(iso)}
        onMouseLeave={() => step === 2 && setHoverDate(null)}
        style={{
          width: "100%", height: "36px",
          border: isSelected ? "1.5px solid #10b981" : "1px solid transparent",
          background: isSelected ? "rgba(16,185,129,0.22)" : inRange ? "rgba(16,185,129,0.09)" : "transparent",
          borderRadius: "9px",
          color: isSelected ? "#10b981" : "var(--text-1)",
          cursor: "pointer", fontSize: "13px", fontWeight: isSelected ? 700 : 500,
          transition: "background 0.15s", fontFamily: "Inter, Arial, sans-serif",
        }}
      >{day}</button>
    )
  }

  const chipStyle = (active) => ({
    display: "flex", alignItems: "center", gap: "8px",
    background: active ? "rgba(16,185,129,0.08)" : "var(--inner-bg)",
    border: active ? "1.5px solid rgba(16,185,129,0.5)" : "1px solid var(--border-input)",
    borderRadius: "10px", padding: "8px 12px",
    cursor: "pointer", color: "var(--text-1)",
    transition: "border 0.15s, background 0.15s", whiteSpace: "nowrap",
  })

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <button type="button" onClick={() => openFor(1)} style={chipStyle(open && step === 1)}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>📅</span>
          <span style={{ fontSize: "13px", fontWeight: fromDate ? 600 : 400, color: fromDate ? "var(--text-1)" : "var(--text-muted)" }}>
            {fromDate ? formatDateLabel(fromDate) : "Desde"}
          </span>
        </button>
        <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>→</span>
        <button type="button" onClick={() => fromDate && openFor(2)} style={{ ...chipStyle(open && step === 2), opacity: fromDate ? 1 : 0.5, cursor: fromDate ? "pointer" : "default" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>📅</span>
          <span style={{ fontSize: "13px", fontWeight: toDate ? 600 : 400, color: toDate ? "var(--text-1)" : "var(--text-muted)" }}>
            {toDate ? formatDateLabel(toDate) : "Hasta"}
          </span>
        </button>
        {(fromDate || toDate) && (
          <button type="button" onClick={() => { onFromChange(""); onToChange("") }}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "15px", padding: "4px", lineHeight: 1 }}>
            ✕
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 10px)", left: 0,
          width: "310px", background: "var(--card-bg)",
          border: "1px solid var(--border-card)", borderRadius: "20px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)", padding: "20px", zIndex: 200,
        }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#10b981", letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "center", marginBottom: "14px" }}>
            {step === 1 ? "Seleccioná fecha de inicio" : "Seleccioná fecha de fin"}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <button type="button" onClick={() => changeMonth(-1)}
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "0 6px" }}>‹</button>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)" }}>
              {MONTHS_ES[month.getMonth()]} {month.getFullYear()}
            </span>
            <button type="button" onClick={() => changeMonth(1)}
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "0 6px" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "6px" }}>
            {WEEKDAYS_SHORT.map((d) => (
              <span key={d} style={{ textAlign: "center", fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, padding: "4px 0" }}>{d}</span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
            {Array.from({ length: firstDayIndex }).map((_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => renderDay(i + 1))}
          </div>
        </div>
      )}
    </div>
  )
}

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

const isRetiro = (e) => e.entry_type === "retiro"

const PROP_FIRM_SUBCATEGORIES = ["Futuros", "Forex / CFDs"]

const PROP_FIRM_COMPANIES = {
  "Futuros":     ["Lucid Trading", "Alpha Futures", "Tradeify", "Topstep", "Apex"],
  "Forex / CFDs": ["FTMO", "WSF", "ORION", "The 5%ers", "Funding Pips"],
}

const defaultForm = {
  id: null,
  name: "",
  amount: "",
  category: "Prop Firms",
  subcategory: "Futuros",
  company: "",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
  entry_type: "gasto",
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
  const [filterFrom, setFilterFrom] = useState("")
  const [filterTo, setFilterTo] = useState("")
  const [filterCategory, setFilterCategory] = useState("")
  const [filterCompany, setFilterCompany] = useState("")

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

  const openAdd = (type = "gasto") => { setForm({ ...defaultForm, entry_type: type }); setShowForm(true) }
  const openEdit = (e) => {
    setForm({
      id: e.id, name: e.name, amount: String(e.amount),
      category: e.category, subcategory: e.subcategory || "Futuros",
      company: e.company || "",
      date: e.entry_date, notes: e.notes || "",
      entry_type: e.entry_type || "gasto",
    })
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
      subcategory: form.category === "Prop Firms" ? form.subcategory : null,
      company: form.category === "Prop Firms" ? (form.company || null) : null,
      entry_date: form.date,
      notes: form.notes.trim() || null,
      entry_type: form.entry_type,
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

  async function handleDelete(entry) {
    const label = isRetiro(entry) ? "retiro" : "gasto"
    if (!window.confirm(`¿Eliminar este ${label}?`)) return
    await supabase.from("accounting_entries").delete().eq("id", entry.id)
    setEntries((prev) => prev.filter((e) => e.id !== entry.id))
  }

  const filtered = entries
    .filter((e) => {
      if (filterFrom && e.entry_date < filterFrom) return false
      if (filterTo && e.entry_date > filterTo) return false
      if (filterCategory && e.category !== filterCategory) return false
      if (filterCompany && e.company !== filterCompany) return false
      return true
    })
    .sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date))

  const companiesInData = [...new Set(
    entries.filter((e) => e.category === "Prop Firms" && e.company).map((e) => e.company)
  )].sort()

  const gastos   = entries.filter((e) => !isRetiro(e))
  const retiros  = entries.filter((e) => isRetiro(e))
  const totalGastos  = gastos.reduce((s, e) => s + Number(e.amount), 0)
  const totalRetiros = retiros.reduce((s, e) => s + Number(e.amount), 0)
  const neto = totalRetiros - totalGastos

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const gastosThisMonth = gastos
    .filter((e) => e.entry_date.startsWith(thisMonth))
    .reduce((s, e) => s + Number(e.amount), 0)

  const filteredGastos  = filtered.filter((e) => !isRetiro(e)).reduce((s, e) => s + Number(e.amount), 0)
  const filteredRetiros = filtered.filter((e) => isRetiro(e)).reduce((s, e) => s + Number(e.amount), 0)
  const filteredNeto    = filteredRetiros - filteredGastos

  const byCategory = CATEGORIES
    .map((c) => {
      const catEntries = gastos.filter((e) => e.category === c.key)
      const total = catEntries.reduce((s, e) => s + Number(e.amount), 0)
      const subcats = c.key === "Prop Firms"
        ? PROP_FIRM_SUBCATEGORIES.map((sub) => {
            const subEntries = catEntries.filter((e) => e.subcategory === sub)
            const subTotal = subEntries.reduce((s, e) => s + Number(e.amount), 0)
            const companies = (PROP_FIRM_COMPANIES[sub] || [])
              .map((co) => {
                const coEntries = subEntries.filter((e) => e.company === co)
                return { key: co, total: coEntries.reduce((s, e) => s + Number(e.amount), 0), count: coEntries.length }
              })
              .filter((co) => co.total > 0)
            const uncategorized = subEntries.filter((e) => !e.company)
            if (uncategorized.length > 0) {
              const uTotal = uncategorized.reduce((s, e) => s + Number(e.amount), 0)
              if (uTotal > 0) companies.push({ key: "Otros", total: uTotal, count: uncategorized.length })
            }
            return { key: sub, total: subTotal, count: subEntries.length, companies }
          }).filter((s) => s.total > 0)
        : []
      return { ...c, total, count: catEntries.length, subcats }
    })
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

  const netoColor = neto > 0 ? "#10b981" : neto < 0 ? "#f87171" : "var(--text-muted)"
  const isEditingRetiro = form.entry_type === "retiro"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            Contabilidad
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "var(--text-muted)" }}>
            Gastos y retiros operativos de trading
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <DateRangePicker
            fromDate={filterFrom}
            toDate={filterTo}
            onFromChange={setFilterFrom}
            onToChange={setFilterTo}
          />
          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setFilterCompany("") }}
            style={{
              background: "var(--inner-bg)", border: "1px solid var(--border-input)",
              color: filterCategory ? "var(--text-1)" : "var(--text-muted)",
              padding: "9px 14px", borderRadius: "10px", fontSize: "13px",
              outline: "none", cursor: "pointer", fontFamily: "Inter, Arial, sans-serif",
              minWidth: "160px",
            }}
          >
            <option value="">Todas las categorías</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.key}</option>
            ))}
          </select>
          {filterCategory === "Prop Firms" && companiesInData.length > 0 && (
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              style={{
                background: "var(--inner-bg)", border: "1px solid rgba(245,158,11,0.4)",
                color: filterCompany ? "var(--text-1)" : "var(--text-muted)",
                padding: "9px 14px", borderRadius: "10px", fontSize: "13px",
                outline: "none", cursor: "pointer", fontFamily: "Inter, Arial, sans-serif",
                minWidth: "150px",
              }}
            >
              <option value="">Todas las empresas</option>
              {companiesInData.map((co) => (
                <option key={co} value={co}>{co}</option>
              ))}
            </select>
          )}
          {/* Agregar retiro */}
          <button
            onClick={() => openAdd("retiro")}
            style={{
              padding: "9px 18px", borderRadius: "10px", border: "none",
              background: "linear-gradient(135deg,#10b981,#059669)",
              color: "#fff", fontWeight: "700", fontSize: "13px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "7px",
              boxShadow: "0 4px 12px rgba(16,185,129,0.25)", whiteSpace: "nowrap",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar retiro
          </button>
          {/* Agregar gasto */}
          <button
            onClick={() => openAdd("gasto")}
            style={{
              padding: "9px 18px", borderRadius: "10px", border: "none",
              background: "linear-gradient(135deg,#f87171,#ef4444)",
              color: "#fff", fontWeight: "700", fontSize: "13px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "7px",
              boxShadow: "0 4px 12px rgba(248,113,113,0.25)", whiteSpace: "nowrap",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar gasto
          </button>
        </div>
      </div>


      {/* Category breakdown — solo gastos */}
      {byCategory.length > 0 && (
        <div style={card}>
          <h2 style={{ margin: "0 0 18px", fontSize: "14px", fontWeight: "700", color: "var(--text-1)" }}>
            Distribución por categoría
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {byCategory.map((c) => {
              const pct = totalGastos > 0 ? (c.total / totalGastos) * 100 : 0
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
                  {c.subcats?.length > 0 && (
                    <div style={{ marginTop: "10px", paddingLeft: "12px", display: "flex", flexDirection: "column", gap: "10px", borderLeft: `2px solid ${c.color}30` }}>
                      {c.subcats.map((s) => {
                        const subPct = c.total > 0 ? (s.total / c.total) * 100 : 0
                        return (
                          <div key={s.key}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: c.color, opacity: 0.6 }} />
                                <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-2, #cbd5e1)" }}>{s.key}</span>
                                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{s.count} entrada{s.count !== 1 ? "s" : ""}</span>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: c.color }}>-{fmt(s.total)}</span>
                                <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "5px" }}>{subPct.toFixed(1)}%</span>
                              </div>
                            </div>
                            <div style={{ height: "3px", borderRadius: "2px", background: "rgba(148,163,184,0.08)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${subPct}%`, background: c.color, opacity: 0.5, borderRadius: "2px", transition: "width 0.4s" }} />
                            </div>
                            {/* Empresas */}
                            {s.companies?.length > 0 && (
                              <div style={{ marginTop: "6px", paddingLeft: "12px", display: "flex", flexDirection: "column", gap: "3px", borderLeft: `1px solid ${c.color}20` }}>
                                {s.companies.map((co) => (
                                  <div key={co.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                      <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: c.color, opacity: 0.4 }} />
                                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{co.key}</span>
                                      <span style={{ fontSize: "10px", color: "var(--text-muted)", opacity: 0.5 }}>{co.count}</span>
                                    </div>
                                    <span style={{ fontSize: "11px", fontWeight: "600", color: c.color, opacity: 0.7 }}>-{fmt(co.total)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List */}
      <div style={card}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)", fontSize: "14px" }}>
            Cargando...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.6" }}>
            {entries.length === 0
              ? <>Sin entradas registradas.<br />Usa <strong style={{ color: "var(--text-1)" }}>Agregar gasto</strong> o <strong style={{ color: "var(--text-1)" }}>Agregar retiro</strong> para comenzar.</>
              : "No hay entradas con los filtros seleccionados."}
          </div>
        ) : (
          <>
            {/* Resumen conteo */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "14px", flexWrap: "wrap" }}>
              {(() => {
                const nGastos  = filtered.filter((e) => !isRetiro(e)).length
                const nRetiros = filtered.filter((e) => isRetiro(e)).length
                return (
                  <>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      <span style={{ fontWeight: "700", color: "#f87171" }}>{nGastos}</span>
                      {" "}gasto{nGastos !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", opacity: 0.3 }}>·</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      <span style={{ fontWeight: "700", color: "#10b981" }}>{nRetiros}</span>
                      {" "}retiro{nRetiros !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", opacity: 0.3 }}>·</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      <span style={{ fontWeight: "700", color: "var(--text-1)" }}>{filtered.length}</span>
                      {" "}en total
                    </span>
                  </>
                )
              })()}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 100px 120px 72px", gap: "8px", padding: "0 12px 10px", borderBottom: "1px solid var(--border-nav)", marginBottom: "4px" }}>
              {["Nombre", "Categoría", "Fecha", "Monto", ""].map((h) => (
                <span key={h} style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>{h}</span>
              ))}
            </div>

            {filtered.map((entry) => {
              const retiro = isRetiro(entry)
              const amount = Number(entry.amount)
              const amountColor = amount === 0 ? "var(--text-muted)" : retiro ? "#10b981" : "#f87171"
              const amountLabel = amount === 0 ? fmt(amount) : retiro ? `+${fmt(amount)}` : `-${fmt(amount)}`
              return (
                <div
                  key={entry.id}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 130px 100px 120px 72px",
                    gap: "8px", padding: "11px 12px", borderRadius: "10px", alignItems: "center",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--nav-hover)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-1)" }}>{entry.name}</div>
                      {retiro && (
                        <span style={{ fontSize: "9px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px", background: "rgba(16,185,129,0.12)", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          retiro
                        </span>
                      )}
                    </div>
                    {entry.notes && (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{entry.notes}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{
                      fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "6px",
                      background: `${catColor(entry.category)}1a`, color: catColor(entry.category), width: "fit-content",
                    }}>
                      {entry.category}
                    </span>
                    {entry.subcategory && (
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", paddingLeft: "2px" }}>
                        {entry.subcategory}{entry.company ? ` · ${entry.company}` : ""}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {new Date(entry.entry_date + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: amountColor }}>
                    {amountLabel}
                  </span>
                  <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => openEdit(entry)}
                      title="Editar"
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "5px", borderRadius: "6px", display: "grid", placeItems: "center", transition: "color 0.12s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#6366f1" }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(entry)}
                      title="Eliminar"
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "5px", borderRadius: "6px", display: "grid", placeItems: "center", transition: "color 0.12s" }}
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
                </div>
              )
            })}

            {/* Footer totales */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "20px", padding: "12px 12px 0", borderTop: "1px solid var(--border-nav)", marginTop: "6px", flexWrap: "wrap" }}>
              {filteredGastos > 0 && (
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Gastos: <strong style={{ color: "#f87171" }}>-{fmt(filteredGastos)}</strong>
                </span>
              )}
              {filteredRetiros > 0 && (
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Retiros: <strong style={{ color: "#10b981" }}>+{fmt(filteredRetiros)}</strong>
                </span>
              )}
              <span style={{ fontSize: "14px", fontWeight: "700", color: filteredNeto >= 0 ? "#10b981" : "#f87171" }}>
                Neto: {filteredNeto >= 0 ? "+" : "-"}{fmt(filteredNeto)}
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
                  {form.id
                    ? (isEditingRetiro ? "Editar retiro" : "Editar gasto")
                    : (isEditingRetiro ? "Agregar retiro" : "Agregar gasto")}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
                  {isEditingRetiro ? "Ingreso recibido de prop firm u otro" : "Registro de gasto operativo"}
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
                  placeholder={isEditingRetiro ? "Ej: FTMO Payout Mayo" : "Ej: FTMO Challenge 10K"}
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
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value, subcategory: "Futuros" }))}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.key}</option>
                  ))}
                </select>
              </div>

              {form.category === "Prop Firms" && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      Tipo de cuenta <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {PROP_FIRM_SUBCATEGORIES.map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, subcategory: sub, company: "" }))}
                          style={{
                            flex: 1, padding: "10px 14px", borderRadius: "10px", border: "none",
                            background: form.subcategory === sub ? "rgba(245,158,11,0.15)" : "var(--inner-bg)",
                            color: form.subcategory === sub ? "#f59e0b" : "var(--text-muted)",
                            fontWeight: form.subcategory === sub ? "700" : "500",
                            fontSize: "13px", cursor: "pointer",
                            outline: form.subcategory === sub ? "1.5px solid rgba(245,158,11,0.4)" : "1px solid var(--border-input)",
                            transition: "all 0.12s",
                            fontFamily: "Inter, Arial, sans-serif",
                          }}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      Empresa
                    </label>
                    <select
                      value={form.company}
                      onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      <option value="">— Seleccionar empresa —</option>
                      {(PROP_FIRM_COMPANIES[form.subcategory] || []).map((co) => (
                        <option key={co} value={co}>{co}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

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
                      ? (isEditingRetiro ? "rgba(16,185,129,0.4)" : "rgba(248,113,113,0.4)")
                      : isEditingRetiro
                        ? "linear-gradient(135deg,#10b981,#059669)"
                        : "linear-gradient(135deg,#f87171,#ef4444)",
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
