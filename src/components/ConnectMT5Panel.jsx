import { useState, useEffect } from "react"

const cardStyle = {
  background: "var(--card-bg)",
  borderRadius: "20px",
  padding: "24px",
  border: "1px solid rgba(148, 163, 184, 0.08)",
}

const steps = [
  {
    num: "1",
    title: "Selecciona la cuenta y descarga el EA",
    desc: "Elige la cuenta del journal. El archivo .ex5 se genera compilado con el nombre de cuenta ya configurado.",
  },
  {
    num: "2",
    title: "Pega el archivo en MT5",
    desc: "En MT5 ve a Archivo → Abrir carpeta de datos → MQL5 → Experts → Advisors y pega el archivo .ex5.",
  },
  {
    num: "3",
    title: "Permite la URL en MT5",
    desc: "Herramientas → Opciones → Asesores Expertos → Permitir WebRequest → agrega: https://wvkdvvrbittavgjkezpy.supabase.co",
  },
  {
    num: "4",
    title: "Arrastra el EA a cualquier gráfico",
    desc: "Acepta los parámetros y listo. El EA sube todo el historial automáticamente al activarse.",
  },
]

export function ConnectMT5Panel({ accounts, userId }) {
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [serverOnline, setServerOnline]           = useState(false)
  const [compiling, setCompiling]                 = useState(false)

  const selectedAccount = accounts.find((a) => String(a.id) === selectedAccountId)

  // Detectar servidor local al montar y cada 10 segundos
  useEffect(() => {
    const check = () => {
      fetch("http://localhost:3001/ping", { signal: AbortSignal.timeout(1500) })
        .then((r) => setServerOnline(r.ok))
        .catch(() => setServerOnline(false))
    }
    check()
    const id = setInterval(check, 10000)
    return () => clearInterval(id)
  }, [])

  const handleDownload = async () => {
    if (serverOnline && selectedAccount) {
      // Compilar EA personalizado con nombre de cuenta incluido
      setCompiling(true)
      try {
        const res = await fetch(
          `http://localhost:3001/compile-ea?account=${encodeURIComponent(selectedAccount.name)}`,
          { signal: AbortSignal.timeout(30000) }
        )
        if (res.ok) {
          const blob = await res.blob()
          const url  = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href  = url
          link.download = `GlobalSairu_Journal_${selectedAccount.name.replace(/\s+/g, "_")}.ex5`
          link.click()
          URL.revokeObjectURL(url)
          setCompiling(false)
          return
        }
      } catch (e) {}
      setCompiling(false)
    }

    // Fallback: EA genérico pre-compilado
    const link = document.createElement("a")
    link.href  = "/GlobalSairu_Journal.ex5"
    link.download = "GlobalSairu_Journal.ex5"
    link.click()
  }

  const canDownload = !!selectedAccount

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div>
        <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
          Automatización
        </p>
        <h1 style={{ margin: "8px 0 6px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
          Conectar MT5
        </h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
          Descarga el EA precompilado y sincroniza trades automáticamente — sin abrir MetaEditor
        </p>
      </div>

      {/* Descarga */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>
            Generar EA para tu cuenta
          </h2>

          {/* Indicador servidor */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: serverOnline ? "#10b981" : "var(--text-muted)", fontWeight: "600" }}>
            <div style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: serverOnline ? "#10b981" : "rgba(148,163,184,0.4)",
              boxShadow: serverOnline ? "0 0 6px #10b981" : "none",
              flexShrink: 0,
            }} />
            {serverOnline ? "Servidor activo" : "Servidor inactivo"}
          </div>
        </div>

        <div style={{ display: "grid", gap: "14px", maxWidth: "480px" }}>

          {/* Selector de cuenta */}
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "7px" }}>
              Cuenta del journal <span style={{ color: "#f87171" }}>*</span>
            </div>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              style={{
                width: "100%",
                background: "var(--inner-bg)",
                border: `1px solid ${!selectedAccountId ? "rgba(248,113,113,0.4)" : "var(--border-input)"}`,
                color: "var(--text-1)",
                padding: "12px 14px",
                borderRadius: "10px",
                fontSize: "14px",
                outline: "none",
                fontFamily: "Inter, Arial, sans-serif",
                boxSizing: "border-box",
              }}
            >
              <option value="">— Selecciona una cuenta —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Callout con info del EA que se generará */}
          {selectedAccount && (
            <div style={{
              padding: "12px 14px",
              background: serverOnline ? "rgba(16,185,129,0.06)" : "rgba(148,163,184,0.05)",
              border: `1px solid ${serverOnline ? "rgba(16,185,129,0.2)" : "rgba(148,163,184,0.12)"}`,
              borderRadius: "10px",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}>
              {serverOnline ? (
                <>
                  El EA se compilará con{" "}
                  <span style={{ color: "#10b981", fontWeight: "700", fontFamily: "monospace" }}>
                    JOURNAL_ACCOUNT = "{selectedAccount.name}"
                  </span>{" "}
                  incluido — el usuario solo pega el archivo y arrastra al gráfico.
                </>
              ) : (
                <>
                  Se descargará el EA genérico. Al arrastrarlo al gráfico en MT5, escribe{" "}
                  <span style={{ color: "var(--text-1)", fontWeight: "700" }}>{selectedAccount.name}</span>{" "}
                  en el campo <span style={{ fontFamily: "monospace", color: "var(--text-1)" }}>JOURNAL_ACCOUNT</span>.
                  <br />
                  <span style={{ fontSize: "11px", marginTop: "4px", display: "block" }}>
                    Para generación automática inicia el servidor: <code style={{ color: "var(--text-1)", background: "rgba(148,163,184,0.1)", padding: "1px 5px", borderRadius: "4px" }}>npm run compile-server</code>
                  </span>
                </>
              )}
            </div>
          )}

          {/* Botón descargar */}
          <button
            onClick={handleDownload}
            disabled={!canDownload || compiling}
            style={{
              padding: "13px 20px",
              borderRadius: "12px",
              border: "none",
              background: canDownload && !compiling
                ? "linear-gradient(135deg,#10b981,#059669)"
                : "rgba(148,163,184,0.07)",
              color: canDownload && !compiling ? "#fff" : "var(--text-muted)",
              fontWeight: "700",
              fontSize: "14px",
              cursor: canDownload && !compiling ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "opacity 0.15s",
            }}
          >
            {compiling ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Compilando...
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {serverOnline && selectedAccount
                  ? `Descargar EA para "${selectedAccount.name}"`
                  : "Descargar EA (.ex5)"}
              </>
            )}
          </button>

          {compiling && (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", marginTop: "4px" }}>
              Compilando el EA personalizado, esto puede tardar hasta 30 segundos...
            </div>
          )}
        </div>
      </div>

      {/* Parámetros del EA */}
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>
          Parámetros del EA
        </h2>
        <p style={{ margin: "0 0 18px", fontSize: "13px", color: "var(--text-muted)" }}>
          Al arrastrar el EA al gráfico en MT5, copia estos valores exactos en los campos correspondientes.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[
            { label: "USER_ID", value: userId || "—", desc: "Tu identificador único — no lo compartas" },
            { label: "JOURNAL_ACCOUNT", value: selectedAccount ? selectedAccount.name : "Selecciona una cuenta arriba", desc: "Nombre exacto de tu cuenta en el journal" },
          ].map(({ label, value, desc }) => (
            <div key={label} style={{ background: "var(--inner-bg)", borderRadius: "12px", padding: "14px 16px", border: "1px solid var(--border-input)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                    {label}
                  </div>
                  <code style={{
                    fontSize: "13px", color: "var(--text-1)", fontFamily: "monospace",
                    display: "block", wordBreak: "break-all", lineHeight: "1.4",
                  }}>
                    {value}
                  </code>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "5px" }}>{desc}</div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(value)}
                  title="Copiar"
                  style={{
                    flexShrink: 0, padding: "8px", borderRadius: "8px",
                    border: "1px solid rgba(148,163,184,0.18)", background: "transparent",
                    color: "var(--text-muted)", cursor: "pointer",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instrucciones */}
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>
          Instrucciones de instalación
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {steps.map((step) => (
            <div key={step.num} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "8px",
                background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)",
                display: "grid", placeItems: "center",
                fontSize: "12px", fontWeight: "800", color: "#10b981", flexShrink: 0,
              }}>
                {step.num}
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-1)", marginBottom: "3px" }}>
                  {step.title}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.55" }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Nota historial */}
        <div style={{
          marginTop: "20px", padding: "14px 16px",
          background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.18)",
          borderRadius: "12px", fontSize: "12px", color: "var(--text-muted)",
          display: "flex", gap: "10px", alignItems: "flex-start",
        }}>
          <svg style={{ color: "#10b981", flexShrink: 0, marginTop: "1px" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>
            <span style={{ color: "#10b981", fontWeight: "700" }}>Historial automático — </span>
            al activar el EA sube todos los trades pasados de esa cuenta. Los ya existentes en el journal no se duplican.
          </span>
        </div>
      </div>
    </div>
  )
}
