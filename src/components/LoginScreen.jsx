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

export function LoginScreen() {
  const [tab, setTab] = useState("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const switchTab = (t) => {
    setTab(t)
    setError("")
    setSuccess("")
    setEmail("")
    setPassword("")
    setConfirmPassword("")
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) {
      setError(error.message || "No se pudo enviar el correo. Verifica el email ingresado.")
    } else {
      setSuccess("Te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.")
    }
    setLoading(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message?.toLowerCase().includes("email not confirmed")) {
        setError("Debes verificar tu correo antes de iniciar sesión.")
      } else if (error.message?.toLowerCase().includes("too many requests")) {
        setError("Demasiados intentos. Espera unos minutos e intenta de nuevo.")
      } else {
        setError("Email o contraseña incorrectos.")
      }
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccess("Cuenta creada. El administrador debe aprobarla antes de que puedas entrar.")
      setEmail("")
      setPassword("")
      setConfirmPassword("")
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

        {/* Tabs — solo visible en login y register */}
        {tab !== "forgot" && (
          <div
            style={{
              display: "flex",
              gap: "4px",
              background: "var(--inner-bg)",
              borderRadius: "12px",
              padding: "4px",
              marginBottom: "24px",
            }}
          >
            {[
              { key: "login", label: "Iniciar sesión" },
              { key: "register", label: "Registrarse" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => switchTab(t.key)}
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: "9px",
                  border: "none",
                  background: tab === t.key ? "var(--card-bg)" : "transparent",
                  color: tab === t.key ? "var(--text-1)" : "var(--text-muted)",
                  fontWeight: tab === t.key ? "700" : "500",
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "Inter, Arial, sans-serif",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {tab === "forgot" ? (
          <form onSubmit={handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ marginBottom: "4px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: "700", color: "var(--text-1)" }}>
                Recuperar contraseña
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
              </p>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Email
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" style={inputStyle} />
            </div>

            {error && (
              <p style={{ margin: 0, fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", padding: "10px 14px", borderRadius: "10px" }}>
                {error}
              </p>
            )}
            {success && (
              <p style={{ margin: 0, fontSize: "13px", color: "#10b981", background: "rgba(16,185,129,0.08)", padding: "10px 14px", borderRadius: "10px" }}>
                {success}
              </p>
            )}

            {!success && (
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
                {loading ? "Enviando..." : "Enviar enlace"}
              </button>
            )}

            <button
              type="button"
              onClick={() => switchTab("login")}
              style={{
                padding: "10px",
                borderRadius: "12px",
                border: "1px solid rgba(148,163,184,0.15)",
                background: "transparent",
                color: "var(--text-muted)",
                fontWeight: "600",
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "Inter, Arial, sans-serif",
              }}
            >
              Volver al inicio de sesión
            </button>
          </form>
        ) : tab === "login" ? (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Email
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" style={inputStyle} />
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => switchTab("forgot")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#10b981",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "Inter, Arial, sans-serif",
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" style={inputStyle} />
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
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Email
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Contraseña
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Confirmar contraseña
              </label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" style={inputStyle} />
            </div>

            {error && (
              <p style={{ margin: 0, fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", padding: "10px 14px", borderRadius: "10px" }}>
                {error}
              </p>
            )}
            {success && (
              <p style={{ margin: 0, fontSize: "13px", color: "#10b981", background: "rgba(16,185,129,0.08)", padding: "10px 14px", borderRadius: "10px" }}>
                {success}
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
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
