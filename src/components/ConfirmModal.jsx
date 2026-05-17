import { useEffect, useRef, useState } from "react"
import { registerConfirm } from "../lib/confirm"

export function ConfirmModal() {
  const [state, setState] = useState(null)
  const resolverRef = useRef(null)

  useEffect(() => {
    registerConfirm(({ message, title, confirmLabel, cancelLabel, danger }) => {
      return new Promise((resolve) => {
        resolverRef.current = resolve
        setState({ message, title, confirmLabel, cancelLabel, danger })
      })
    })
  }, [])

  const handle = (result) => {
    setState(null)
    resolverRef.current?.(result)
  }

  useEffect(() => {
    if (!state) return
    const onKey = (e) => { if (e.key === "Escape") handle(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state])

  if (!state) return null

  return (
    <div
      onClick={() => handle(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(145deg, #1a1f35, #151929)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px",
          padding: "32px 28px 24px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          animation: "slideUp 0.18s ease",
        }}
      >
        <p style={{
          fontSize: "13px", fontWeight: "700", letterSpacing: "0.08em",
          textTransform: "uppercase", color: "#6b7280", marginBottom: "10px",
        }}>
          {state.title}
        </p>
        <p style={{
          fontSize: "15px", color: "#e5e7eb", lineHeight: "1.6",
          marginBottom: "28px",
        }}>
          {state.message}
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={() => handle(false)}
            style={{
              padding: "10px 20px", borderRadius: "12px", fontWeight: "600",
              fontSize: "14px", cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)", color: "#9ca3af",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => e.target.style.background = "rgba(255,255,255,0.1)"}
            onMouseLeave={(e) => e.target.style.background = "rgba(255,255,255,0.05)"}
          >
            {state.cancelLabel}
          </button>
          <button
            onClick={() => handle(true)}
            style={{
              padding: "10px 22px", borderRadius: "12px", fontWeight: "700",
              fontSize: "14px", cursor: "pointer", border: "none",
              background: state.danger
                ? "linear-gradient(135deg, #ef4444, #dc2626)"
                : "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff",
              boxShadow: state.danger
                ? "0 4px 15px rgba(239,68,68,0.35)"
                : "0 4px 15px rgba(16,185,129,0.35)",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => e.target.style.opacity = "0.9"}
            onMouseLeave={(e) => e.target.style.opacity = "1"}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(16px);opacity:0 } to { transform:translateY(0);opacity:1 } }
      `}</style>
    </div>
  )
}
