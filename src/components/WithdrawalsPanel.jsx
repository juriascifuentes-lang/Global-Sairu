import { useState } from "react"

const labelStyle = {
  color: "var(--text-muted)",
  fontSize: "10px",
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  marginBottom: "7px",
  display: "block",
}

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
  border: "1px solid var(--border-card)",
}

export function WithdrawalsPanel({ withdrawals, accounts, onAddWithdrawal, onDeleteWithdrawal }) {
  const [form, setForm] = useState({
    account: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "",
  })

  const handleSubmit = () => {
    if (!form.account || form.amount === "") return
    onAddWithdrawal({ id: Date.now(), ...form })
    setForm({ account: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "" })
  }

  const upcoming = withdrawals.filter(
    (w) => new Date(w.date) >= new Date(new Date().toISOString().split("T")[0])
  )

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div style={cardStyle}>
        <div style={{ marginBottom: "20px" }}>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.18em" }}>Retiros</p>
          <h1 style={{ margin: "10px 0 0", color: "var(--text-1)" }}>Registrar retiro</h1>
          <p style={{ margin: "10px 0 0", color: "var(--text-muted)" }}>Registra retiros y analiza tu flujo de salida en cada cuenta.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr", gap: "24px" }}>
          <div style={{ display: "grid", gap: "18px" }}>
            <div>
              <div style={labelStyle}>Cuenta</div>
              <select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} style={inputStyle}>
                <option value="">Seleccionar cuenta</option>
                {accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Monto (USD)</div>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Fecha</div>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Notas (opcional)</div>
              <textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ej: retiro mensual, pago de challenge..." style={{ ...inputStyle, resize: "none", minHeight: "110px", fontFamily: "Inter, Arial, sans-serif" }} />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!form.account || form.amount === ""}
              style={{ marginTop: "8px", width: "fit-content", background: form.account && form.amount !== "" ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(148,163,184,0.10)", color: form.account && form.amount !== "" ? "#fff" : "var(--text-muted)", border: "none", padding: "14px 24px", borderRadius: "14px", cursor: form.account && form.amount !== "" ? "pointer" : "not-allowed", fontWeight: "700" }}
            >
              Registrar retiro
            </button>
          </div>

          <div>
            <div style={{ background: "var(--inner-bg)", borderRadius: "20px", padding: "22px", minHeight: "240px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: "12px" }}>Próximos retiros</div>
                {upcoming.length === 0 ? (
                  <p style={{ color: "var(--text-dim)", margin: 0 }}>Sin retiros programados.</p>
                ) : (
                  upcoming.slice(0, 3).map((w) => (
                    <div key={w.id} style={{ marginBottom: "14px" }}>
                      <div style={{ color: "var(--text-1)", fontWeight: "700" }}>{w.account}</div>
                      <div style={{ color: "#10b981", marginTop: "6px" }}>${Number(w.amount).toFixed(2)}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>{w.date}</div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>Se mostrarán los próximos retiros programados por fecha.</div>
            </div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-1)" }}>Historial de retiros</h2>
            <p style={{ margin: "8px 0 0", color: "var(--text-muted)" }}>Revisa los retiros anteriores y elimina los que ya no necesites.</p>
          </div>
          <span style={{ color: "#10b981", fontWeight: "700" }}>{withdrawals.length} registros</span>
        </div>

        {withdrawals.length === 0 ? (
          <div style={{ color: "var(--text-dim)", textAlign: "center", padding: "40px 0" }}>No hay retiros registrados aún.</div>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {withdrawals.map((w) => (
              <div key={w.id} style={{ background: "var(--inner-bg)", borderRadius: "18px", padding: "18px", display: "grid", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                  <div>
                    <div style={{ color: "var(--text-1)", fontWeight: "700" }}>{w.account}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>{w.date}</div>
                  </div>
                  <div style={{ color: "#10b981", fontWeight: "700" }}>${Number(w.amount).toFixed(2)}</div>
                </div>
                {w.notes && <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "13px" }}>{w.notes}</p>}
                <button onClick={() => onDeleteWithdrawal(w.id)} style={{ width: "fit-content", border: "1px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.08)", color: "#f87171", padding: "8px 14px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "12px" }}>
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
