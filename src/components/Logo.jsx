export function Logo({ centered = false }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      marginBottom: "28px",
      justifyContent: centered ? "center" : "flex-start",
    }}>
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
          flexShrink: 0,
        }}
      >
        GS
      </div>
      <div>
        <div style={{ color: "var(--text-1)", fontWeight: "700", fontSize: "16px", lineHeight: 1 }}>
          Global Sairu
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>
          Journal Dashboard
        </div>
      </div>
    </div>
  )
}
