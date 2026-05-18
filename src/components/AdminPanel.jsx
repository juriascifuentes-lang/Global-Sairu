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

  const approveUser = async (id, level = 1) => {
    await supabase.from("profiles").update({ is_approved: true, level }).eq("id", id)
    loadUsers()
  }

  const setLevel = async (id, level) => {
    await supabase.from("profiles").update({ level }).eq("id", id)
    loadUsers()
  }

  const revokeUser = async (id) => {
    if (await showConfirm("¿Revocar el acceso de este usuario?", { title: "Revocar acceso", confirmLabel: "Revocar", danger: true })) {
      await supabase.from("profiles").update({ is_approved: false }).eq("id", id)
      loadUsers()
    }
  }

  const deleteUser = async (id, email) => {
    if (await showConfirm(`¿Eliminar completamente a ${email}? Se borrarán todos sus datos y tendrá que registrarse de nuevo para acceder.`, { title: "Eliminar usuario", confirmLabel: "Eliminar", danger: true })) {
      await supabase.rpc("delete_user_completely", { target_user_id: id })
      loadUsers()
    }
  }

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })

  const LevelBadge = ({ level }) => (
    <span style={{
      fontSize: "10px",
      background: level === 2 ? "rgba(139,92,246,0.15)" : "rgba(59,130,246,0.15)",
      color: level === 2 ? "#a78bfa" : "#60a5fa",
      padding: "2px 8px",
      borderRadius: "999px",
      fontWeight: "700",
    }}>
      Nivel {level}
    </span>
  )

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
          Aprueba, revoca y asigna el nivel de acceso a los usuarios
        </p>
      </div>

      {/* Niveles info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {[
          { level: 1, color: "#60a5fa", bg: "rgba(59,130,246,0.08)", desc: "Acceso a todo excepto Copiador" },
          { level: 2, color: "#a78bfa", bg: "rgba(139,92,246,0.08)", desc: "Acceso completo a todo" },
        ].map(({ level, color, bg, desc }) => (
          <div key={level} style={{ background: bg, border: `1px solid ${color}22`, borderRadius: "14px", padding: "14px 16px" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color, marginBottom: "4px" }}>Nivel {level}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Pendientes */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>
            Pendientes de aprobación
          </h2>
          {pending.length > 0 && (
            <span style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px" }}>
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
              <div key={user.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--inner-bg)", borderRadius: "12px", border: "1px solid var(--border-input)" }}>
                <div>
                  <div style={{ color: "var(--text-1)", fontSize: "14px", fontWeight: "600" }}>{user.email}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>Registrado el {formatDate(user.created_at)}</div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => approveUser(user.id, 1)}
                    style={{ padding: "8px 14px", borderRadius: "10px", border: "none", background: "rgba(59,130,246,0.15)", color: "#60a5fa", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
                  >
                    Aprobar Niv.1
                  </button>
                  <button
                    onClick={() => approveUser(user.id, 2)}
                    style={{ padding: "8px 14px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
                  >
                    Aprobar Niv.2
                  </button>
                </div>
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
              <div key={user.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--inner-bg)", borderRadius: "12px", border: "1px solid var(--border-input)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "var(--text-1)", fontSize: "14px", fontWeight: "600" }}>{user.email}</span>
                    {user.is_admin && (
                      <span style={{ fontSize: "10px", background: "rgba(16,185,129,0.15)", color: "#10b981", padding: "2px 7px", borderRadius: "999px", fontWeight: "700" }}>
                        Admin
                      </span>
                    )}
                    {!user.is_admin && <LevelBadge level={user.level || 1} />}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>Desde {formatDate(user.created_at)}</div>
                </div>
                {!user.is_admin && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      onClick={() => setLevel(user.id, user.level === 1 ? 2 : 1)}
                      title={`Cambiar a Nivel ${user.level === 1 ? 2 : 1}`}
                      style={{ padding: "7px 12px", borderRadius: "10px", border: "1px solid rgba(148,163,184,0.2)", background: "transparent", color: "var(--text-muted)", fontWeight: "600", fontSize: "11px", cursor: "pointer" }}
                    >
                      → Niv.{user.level === 1 ? 2 : 1}
                    </button>
                    <button
                      onClick={() => revokeUser(user.id)}
                      style={{ padding: "7px 12px", borderRadius: "10px", border: "1px solid rgba(248,113,113,0.3)", background: "transparent", color: "#f87171", fontWeight: "600", fontSize: "12px", cursor: "pointer" }}
                    >
                      Revocar
                    </button>
                    <button
                      onClick={() => deleteUser(user.id, user.email)}
                      style={{ padding: "7px 12px", borderRadius: "10px", border: "none", background: "rgba(248,113,113,0.12)", color: "#f87171", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
