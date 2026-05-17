import { useState } from "react"

const inputStyle = {
  background: "var(--inner-bg)",
  border: "1px solid var(--border-input)",
  color: "var(--text-1)",
  padding: "13px 15px",
  borderRadius: "12px",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "Inter, Arial, sans-serif",
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

const emptyForm = { name: "", description: "", rules: [""] }

export function StrategiesPanel({ strategies, onCreateStrategy, onDeleteStrategy }) {
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)

  const setRule = (i, val) => {
    const rules = [...form.rules]
    rules[i] = val
    setForm({ ...form, rules })
  }

  const addRule = () => setForm({ ...form, rules: [...form.rules, ""] })

  const removeRule = (i) => {
    const rules = form.rules.filter((_, idx) => idx !== i)
    setForm({ ...form, rules: rules.length > 0 ? rules : [""] })
  }

  const handleCreate = () => {
    if (!form.name.trim()) return
    const cleanRules = form.rules.filter((r) => r.trim())
    onCreateStrategy({ ...form, rules: cleanRules })
    setForm(emptyForm)
    setShowForm(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
            Trading
          </p>
          <h1 style={{ margin: "8px 0 6px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            Estrategias
          </h1>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
            Define tus estrategias y sus reglas de checklist
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: "11px 18px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff",
              fontWeight: "700",
              fontSize: "13px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            + Nueva estrategia
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-card)", borderRadius: "20px", padding: "24px", maxWidth: "520px" }}>
          <h3 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: "700", color: "var(--text-1)" }}>Nueva estrategia</h3>

          <div style={{ marginBottom: "14px" }}>
            <label style={labelStyle}>Nombre de la estrategia</label>
            <input
              style={inputStyle}
              placeholder="Ej: Scalping MNQ, Breakout..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={labelStyle}>Descripción (opcional)</label>
            <input
              style={inputStyle}
              placeholder="Breve descripción..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Reglas del checklist</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {form.rules.map((rule, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "3px", height: "36px", borderRadius: "999px", background: "#10b981", flexShrink: 0 }} />
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Describe la regla..."
                    value={rule}
                    onChange={(e) => setRule(i, e.target.value)}
                  />
                  <button
                    onClick={() => removeRule(i)}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px", padding: "4px 6px", flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addRule}
              style={{ background: "none", border: "none", color: "#10b981", cursor: "pointer", fontSize: "13px", fontWeight: "600", padding: "10px 0 0", display: "flex", alignItems: "center", gap: "4px" }}
            >
              + Agregar regla
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleCreate}
              disabled={!form.name.trim()}
              style={{
                padding: "12px 20px",
                borderRadius: "12px",
                border: "none",
                background: form.name.trim() ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(148,163,184,0.08)",
                color: form.name.trim() ? "#fff" : "var(--text-muted)",
                fontWeight: "700",
                fontSize: "14px",
                cursor: form.name.trim() ? "pointer" : "not-allowed",
              }}
            >
              Crear estrategia
            </button>
            <button
              onClick={() => { setForm(emptyForm); setShowForm(false) }}
              style={{ padding: "12px 20px", borderRadius: "12px", border: "1px solid var(--border-input)", background: "transparent", color: "var(--text-muted)", fontWeight: "600", fontSize: "14px", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {strategies.length === 0 && !showForm ? (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-card)", borderRadius: "20px", padding: "48px", textAlign: "center" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "16px" }}>No tienes estrategias creadas</div>
          <button
            onClick={() => setShowForm(true)}
            style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.22)", color: "#10b981", borderRadius: "10px", padding: "10px 20px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
          >
            + Crear primera estrategia
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {strategies.map((s) => (
            <div key={s.id} style={{ background: "var(--card-bg)", border: "1px solid var(--border-card)", borderRadius: "16px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--text-1)" }}>{s.name}</div>
                  {s.description && (
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>{s.description}</div>
                  )}
                </div>
                <button
                  onClick={() => onDeleteStrategy(s.id)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px", padding: "2px 6px", flexShrink: 0 }}
                  title="Eliminar"
                >
                  ×
                </button>
              </div>

              {s.rules && s.rules.length > 0 && (
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {s.rules.map((rule, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{rule}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
