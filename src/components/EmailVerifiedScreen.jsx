import { Logo } from "./Logo"

export function EmailVerifiedScreen({ onContinue }) {
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
          maxWidth: "420px",
          padding: "48px 40px",
          background: "var(--card-bg)",
          borderRadius: "28px",
          border: "1px solid rgba(16, 185, 129, 0.2)",
          boxShadow: "0 0 60px rgba(16, 185, 129, 0.06)",
          textAlign: "center",
        }}
      >
        <Logo centered />

        {/* Checkmark */}
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            background: "rgba(16, 185, 129, 0.12)",
            border: "2px solid rgba(16, 185, 129, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 28px",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path
              d="M6 16L13 23L26 9"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Título */}
        <div
          style={{
            fontSize: "26px",
            fontWeight: "800",
            color: "var(--text-1)",
            letterSpacing: "-0.02em",
            marginBottom: "12px",
          }}
        >
          ¡Email verificado!
        </div>

        {/* Mensaje */}
        <div
          style={{
            fontSize: "14px",
            color: "var(--text-muted)",
            lineHeight: "1.7",
            marginBottom: "32px",
            maxWidth: "300px",
            margin: "0 auto 32px",
          }}
        >
          Tu email fue confirmado correctamente. Tu cuenta está siendo revisada por el administrador. Te avisaremos cuando esté habilitada.
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "var(--border-card)", marginBottom: "28px" }} />

        {/* Pill info */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: "999px",
            padding: "8px 16px",
            marginBottom: "28px",
          }}
        >
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
          <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "600" }}>
            Verificación completada
          </span>
        </div>

        {/* Botón */}
        <button
          type="button"
          onClick={onContinue}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: "13px",
            border: "none",
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "#fff",
            fontSize: "14px",
            fontWeight: "700",
            cursor: "pointer",
            letterSpacing: "0.02em",
            fontFamily: "Inter, Arial, sans-serif",
          }}
        >
          Ir al Journal →
        </button>
      </div>
    </div>
  )
}
