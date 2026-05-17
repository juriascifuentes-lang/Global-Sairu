import { useState } from "react"
import { supabase } from "../lib/supabase"
import { Logo } from "./Logo"

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "12px",
  border: "1px solid var(--border-input)",
  background: "var(--app-bg)",
  color: "var(--text-1)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "Inter, Arial, sans-serif",
}

export function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError("No se pudo actualizar la contraseña. Intenta solicitar un nuevo enlace.")
    } else {
      setSuccess(true)
      setTimeout(onDone, 2500)
    }
    setLoading(false)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--app-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          padding: "40px 36px",
          background: "var(--card-bg)",
          borderRadius: "24px",
          border: "1px solid rgba(148, 163, 184, 0.08)",
        }}
      >
        <Logo />

        {success ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>✓</div>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#10b981" }}>
              Contraseña actualizada
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
              Redirigiendo al inicio de sesión...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ marginBottom: "4px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: "700", color: "var(--text-1)" }}>
                Nueva contraseña
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Elige una contraseña segura para tu cuenta.
              </p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Mínimo 6 caracteres"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>

            {error && (
              <p style={{ margin: 0, fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", padding: "10px 14px", borderRadius: "10px" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "4px",
                padding: "13px",
                borderRadius: "12px",
                border: "none",
                background: loading ? "rgba(16,185,129,0.5)" : "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                fontWeight: "700",
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "Inter, Arial, sans-serif",
              }}
            >
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
