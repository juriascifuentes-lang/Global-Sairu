import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { showConfirm } from "../lib/confirm"

const cardStyle = {
  background: "var(--card-bg)",
  borderRadius: "20px",
  padding: "24px",
  border: "1px solid rgba(148, 163, 184, 0.08)",
}

export function AdminPanel() {
  const [pending, setPending] = useState([])
  const [approved, setApproved] = useState([])
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
    if (data) {
      setPending(data.filter((u) => !u.is_approved))
      setApproved(data.filter((u) => u.is_approved))
    }
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const approveUser = async (id) => {
    await supabase.from("profiles").update({ is_approved: true }).eq("id", id)
    loadUsers()
  }

  const revokeUser = async (id) => {
    if (await showConfirm("¿Revocar el acceso de este usuario?", { title: "Revocar acceso", confirmLabel: "Revocar", danger: true })) {
      await supabase.from("profiles").update({ is_approved: false }).eq("id", id)
      loadUsers()
    }
  }

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
          Administración
        </p>
        <h1 style={{ margin: "8px 0 6px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
          Usuarios
        </h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
          Aprueba o revoca el acceso de los usuarios del journal
        </p>
      </div>

      {/* Pendientes */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>
            Pendientes de aprobación
          </h2>
          {pending.length > 0 && (
            <span
              style={{
                background: "rgba(248,113,113,0.15)",
                color: "#f87171",
                fontSize: "11px",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "999px",
              }}
            >
              {pending.length}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Cargando...</div>
        ) : pending.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "14px", padding: "12px 0" }}>
            No hay usuarios pendientes
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {pending.map((user) => (
              <div
                key={user.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "var(--inner-bg)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-input)",
                }}
              >
                <div>
                  <div style={{ color: "var(--text-1)", fontSize: "14px", fontWeight: "600" }}>
                    {user.email}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
                    Registrado el {formatDate(user.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => approveUser(user.id)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "#fff",
                    fontWeight: "700",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Aprobar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aprobados */}
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 18px", fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>
          Usuarios con acceso
        </h2>

        {approved.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Sin usuarios aprobados</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {approved.map((user) => (
              <div
                key={user.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "var(--inner-bg)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-input)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "var(--text-1)", fontSize: "14px", fontWeight: "600" }}>
                      {user.email}
                    </span>
                    {user.is_admin && (
                      <span
                        style={{
                          fontSize: "10px",
                          background: "rgba(16,185,129,0.15)",
                          color: "#10b981",
                          padding: "2px 7px",
                          borderRadius: "999px",
                          fontWeight: "700",
                        }}
                      >
                        Admin
                      </span>
                    )}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
                    Desde {formatDate(user.created_at)}
                  </div>
                </div>
                {!user.is_admin && (
                  <button
                    onClick={() => revokeUser(user.id)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "10px",
                      border: "1px solid rgba(248,113,113,0.3)",
                      background: "transparent",
                      color: "#f87171",
                      fontWeight: "600",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Revocar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
