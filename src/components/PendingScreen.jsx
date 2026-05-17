import { supabase } from "../lib/supabase"

export function PendingScreen() {
  const handleLogout = async () => {
    await supabase.auth.signOut()
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
          maxWidth: "400px",
          padding: "40px 36px",
          background: "var(--card-bg)",
          borderRadius: "24px",
          border: "1px solid rgba(148, 163, 184, 0.08)",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "28px" }}>
          <div
            translate="no"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              display: "grid",
              placeItems: "center",
              fontSize: "14px",
              fontWeight: "800",
              color: "#fff",
            }}
          >
            GS
          </div>
        </div>

        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "rgba(251,191,36,0.12)",
            border: "1px solid rgba(251,191,36,0.3)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 20px",
            fontSize: "24px",
          }}
        >
          ⏳
        </div>

        <h2 style={{ margin: "0 0 10px", fontSize: "20px", fontWeight: "800", color: "var(--text-1)" }}>
          Cuenta pendiente de aprobación
        </h2>
        <p style={{ margin: "0 0 28px", fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.6" }}>
          Tu cuenta fue creada exitosamente. El administrador debe aprobarla antes de que puedas acceder al journal.
        </p>

        <button
          onClick={handleLogout}
          style={{
            padding: "11px 24px",
            borderRadius: "12px",
            border: "1px solid rgba(248,113,113,0.3)",
            background: "transparent",
            color: "#f87171",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
