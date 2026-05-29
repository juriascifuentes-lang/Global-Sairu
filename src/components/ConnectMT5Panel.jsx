import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"

const cardStyle = {
  background: "var(--card-bg)",
  borderRadius: "20px",
  padding: "24px",
  border: "1px solid rgba(148, 163, 184, 0.08)",
}

const mt5Steps = [
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

const ntSteps = [
  {
    num: "1",
    title: "Descarga el archivo del AddOn",
    desc: "Haz clic en el botón de abajo para descargar GlobalSairu_Journal.cs.",
  },
  {
    num: "2",
    title: "Importa en NinjaTrader 8",
    desc: "En NinjaTrader ve a Herramientas → Importar NinjaScript → selecciona el archivo .cs descargado. NinjaTrader lo compilará automáticamente.",
  },
  {
    num: "3",
    title: "Agrega el strategy a un gráfico",
    desc: "Abre cualquier gráfico → clic derecho → Estrategias → busca GlobalSairu_Journal → clic en Configurar.",
  },
  {
    num: "4",
    title: "Configura los parámetros",
    desc: "Ingresa tu USER_ID y el nombre exacto de tu cuenta (JOURNAL_ACCOUNT) en los campos del panel de parámetros.",
  },
  {
    num: "5",
    title: "Activa el strategy",
    desc: "Haz clic en Habilitar. El AddOn sube todo el historial de trades cerrados automáticamente al journal.",
  },
]

const platforms = [
  { key: "MT5",         label: "MetaTrader 5",  logo: "/MT5.png" },
  { key: "NINJATRADER", label: "NinjaTrader 8", logo: "/NINJATRADER.png" },
  { key: "TRADOVATE",   label: "Tradovate",     logo: "/TRADOVATE.png" },
]

// Multiplicadores de contratos de futuros
const FUTURES_MULTIPLIERS = {
  MNQ: 2, NQ: 20, MES: 5, ES: 50, MCL: 10, CL: 1000,
  MGC: 10, GC: 100, MYM: 0.5, YM: 5, M2K: 5, RTY: 50,
  ZB: 1000, ZN: 1000, ZF: 1000, ZT: 2000,
}

function getMultiplier(symbol) {
  // Extrae la raíz quitando el mes/año del contrato (ej: MNQH4 → MNQ)
  const root = symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "").toUpperCase()
  return FUTURES_MULTIPLIERS[root] ?? 1
}

// Convierte fills de la API de Tradovate a trades del journal usando FIFO
function parseTradovateFills(fills, contracts, accountId) {
  if (!Array.isArray(fills) || fills.length === 0) return []

  // Mapa contractId → símbolo
  const contractMap = {}
  for (const c of (contracts || [])) {
    if (c?.id && c?.name) contractMap[c.id] = c.name
  }

  // Filtrar por cuenta si se especifica
  const filtered = accountId != null
    ? fills.filter((f) => f.accountId === accountId)
    : fills

  // Agrupar por símbolo
  const bySymbol = {}
  for (const fill of filtered) {
    const symbol = contractMap[fill.contractId] || `Contract_${fill.contractId}`
    if (!bySymbol[symbol]) bySymbol[symbol] = []
    bySymbol[symbol].push(fill)
  }

  const trades = []

  for (const [symbol, symFills] of Object.entries(bySymbol)) {
    symFills.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    const mult = getMultiplier(symbol)
    const longs  = [] // { qty, price, fillTs }
    const shorts = []

    for (const fill of symFills) {
      const isBuy = fill.action === "Buy"
      let qty = fill.qty ?? 1
      const price  = fill.price ?? 0
      const fillTs = fill.timestamp ?? new Date().toISOString()

      const opposite = isBuy ? shorts : longs

      while (qty > 0 && opposite.length > 0) {
        const entry = opposite[0]
        const matched = Math.min(qty, entry.qty)
        const pl = isBuy
          ? (entry.price - price)  * matched * mult  // cierra short
          : (price  - entry.price) * matched * mult  // cierra long

        trades.push({
          symbol,
          type:      isBuy ? "SELL" : "BUY",
          profit:    parseFloat(pl.toFixed(2)),
          date:      entry.fillTs.split("T")[0],
          open_time: entry.fillTs,
          note:      "Tradovate sync",
        })

        entry.qty -= matched
        qty -= matched
        if (entry.qty <= 0) opposite.shift()
      }

      if (qty > 0) {
        (isBuy ? longs : shorts).push({ qty, price, fillTs })
      }
    }
  }

  return trades
}

function StepList({ steps }) {
  return (
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
  )
}

export function ConnectMT5Panel({ accounts, userId, onImportTrades }) {
  const [platform, setPlatform]                   = useState(null)
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [serverOnline, setServerOnline]           = useState(false)
  const [compiling, setCompiling]                 = useState(false)

  // Estado Tradovate
  const [tvConnection, setTvConnection]         = useState(null)
  const [tvLoading, setTvLoading]               = useState(false)
  const [tvSelectedAccount, setTvSelectedAccount] = useState("")  // ID numérico de Tradovate
  const [tvJournalAccount, setTvJournalAccount] = useState("")    // nombre de cuenta del journal
  const [tvSyncing, setTvSyncing]               = useState(false)
  const [tvPendingTrades, setTvPendingTrades]   = useState([])    // trades listos para importar
  const [tvError, setTvError]                   = useState("")

  const selectedAccount = accounts.find((a) => String(a.id) === selectedAccountId)

  // Ping servidor local (MT5)
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

  // Cargar conexión Tradovate cuando se selecciona esa plataforma
  useEffect(() => {
    if (platform !== "TRADOVATE" || !userId) return
    setTvLoading(true)
    setTvError("")
    supabase
      .from("tradovate_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setTvError("Error cargando conexión")
        setTvConnection(data || null)
        setTvLoading(false)
      })
  }, [platform, userId])

  const handleConnectTradovate = () => {
    window.location.href = `/api/tradovate/auth?userId=${encodeURIComponent(userId)}`
  }

  const handleDisconnect = async () => {
    if (!window.confirm("¿Desconectar Tradovate? Se eliminarán los tokens guardados.")) return
    await supabase.from("tradovate_connections").delete().eq("user_id", userId)
    setTvConnection(null)
    setTvPendingTrades([])
    setTvSelectedAccount("")
    setTvJournalAccount("")
  }

  const handleSync = async () => {
    if (!tvSelectedAccount) { setTvError("Selecciona una cuenta de Tradovate"); return }
    setTvSyncing(true)
    setTvError("")
    setTvPendingTrades([])
    try {
      const res = await fetch("/api/tradovate/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          tradovateAccountId: Number(tvSelectedAccount),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const { fills, contracts } = await res.json()
      const parsed = parseTradovateFills(fills, contracts, Number(tvSelectedAccount))
      if (parsed.length === 0) {
        setTvError("No se encontraron trades cerrados en esta cuenta.")
      } else {
        setTvPendingTrades(parsed)
        // Actualizar last_sync_at en estado local
        setTvConnection((prev) => prev ? { ...prev, last_sync_at: new Date().toISOString() } : prev)
      }
    } catch (e) {
      setTvError(`Error al sincronizar: ${e.message}`)
    } finally {
      setTvSyncing(false)
    }
  }

  const handleImport = async () => {
    if (!tvJournalAccount) { setTvError("Selecciona la cuenta del journal destino"); return }
    if (!onImportTrades) return
    const withAccount = tvPendingTrades.map((t) => ({ ...t, account: tvJournalAccount }))
    await onImportTrades(withAccount)
    setTvPendingTrades([])
  }

  const handleDownload = async () => {
    if (serverOnline && selectedAccount) {
      setCompiling(true)
      try {
        const res = await fetch(
          `http://localhost:3001/compile-ea?account=${encodeURIComponent(selectedAccount.name)}&userId=${encodeURIComponent(userId || "")}`,
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
    const link = document.createElement("a")
    link.href  = "/GlobalSairu_Journal.ex5"
    link.download = "GlobalSairu_Journal.ex5"
    link.click()
  }

  const handleDownloadCS = () => {
    const link = document.createElement("a")
    link.href  = "/GlobalSairu_Journal.cs"
    link.download = "GlobalSairu_Journal.cs"
    link.click()
  }

  const canDownload = !!selectedAccount

  const ParamsSection = () => (
    <div style={cardStyle}>
      <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>
        Parámetros del {platform === "MT5" ? "EA" : "AddOn"}
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: "13px", color: "var(--text-muted)" }}>
        {platform === "MT5"
          ? "Al arrastrar el EA al gráfico en MT5, copia estos valores exactos en los campos correspondientes."
          : "Copia estos valores en los campos del panel de parámetros en NinjaTrader."}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[
          { label: "USER_ID",         value: userId || "—",                                                    desc: "Tu identificador único — no lo compartas" },
          { label: "JOURNAL_ACCOUNT", value: selectedAccount ? selectedAccount.name : "Selecciona una cuenta arriba", desc: "Nombre exacto de tu cuenta en el journal" },
        ].map(({ label, value, desc }) => (
          <div key={label} style={{ background: "var(--inner-bg)", borderRadius: "12px", padding: "14px 16px", border: "1px solid var(--border-input)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                  {label}
                </div>
                <code style={{ fontSize: "13px", color: "var(--text-1)", fontFamily: "monospace", display: "block", wordBreak: "break-all", lineHeight: "1.4" }}>
                  {value}
                </code>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "5px" }}>{desc}</div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(value)}
                title="Copiar"
                style={{ flexShrink: 0, padding: "8px", borderRadius: "8px", border: "1px solid rgba(148,163,184,0.18)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}
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
  )

  // ─── Sección Tradovate ────────────────────────────────────────────────────
  const TradovateSection = () => {
    const tvAccounts = tvConnection?.tradovate_accounts || []
    const lastSync   = tvConnection?.last_sync_at
      ? new Date(tvConnection.last_sync_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
      : null

    const selectStyle = {
      width: "100%",
      background: "var(--inner-bg)",
      border: "1px solid var(--border-input)",
      color: "var(--text-1)",
      padding: "11px 14px",
      borderRadius: "10px",
      fontSize: "14px",
      outline: "none",
      fontFamily: "Inter, Arial, sans-serif",
      boxSizing: "border-box",
    }

    if (tvLoading) {
      return (
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: "12px", color: "var(--text-muted)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Cargando conexión...
        </div>
      )
    }

    if (!tvConnection) {
      // ── Estado: NO conectado ──
      return (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" }}>
            <img src="/TRADOVATE.png" alt="Tradovate" style={{ width: "40px", height: "40px", objectFit: "contain" }} />
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>
                Conectar cuenta de Tradovate
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                Sincroniza trades automáticamente con OAuth — sin guardar tu contraseña.
              </p>
            </div>
          </div>

          {/* Pasos */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
            {[
              { n: "1", t: "Haz clic en Conectar",       d: "Se abre la página de autorización de Tradovate." },
              { n: "2", t: "Inicia sesión en Tradovate",  d: "Introduce tus credenciales de Tradovate. Nosotros nunca las vemos." },
              { n: "3", t: "¡Listo!",                     d: "Tradovate te devuelve al journal con la conexión activa." },
            ].map(({ n, t, d }) => (
              <div key={n} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "8px",
                  background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
                  display: "grid", placeItems: "center",
                  fontSize: "12px", fontWeight: "800", color: "#818cf8", flexShrink: 0,
                }}>{n}</div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-1)", marginBottom: "2px" }}>{t}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.55" }}>{d}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleConnectTradovate}
            style={{
              padding: "13px 20px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg,#6366f1,#4f46e5)",
              color: "#fff",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
            }}
          >
            <img src="/TRADOVATE.png" alt="" style={{ width: "20px", height: "20px", objectFit: "contain", filter: "brightness(10)" }} />
            Conectar con Tradovate
          </button>
        </div>
      )
    }

    // ── Estado: CONECTADO ──
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Encabezado estado */}
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img src="/TRADOVATE.png" alt="Tradovate" style={{ width: "36px", height: "36px", objectFit: "contain" }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-1)" }}>Tradovate</span>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: "6px", border: "1px solid rgba(16,185,129,0.25)" }}>
                  Conectado
                </span>
              </div>
              {lastSync && (
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
                  Última sync: {lastSync}
                </div>
              )}
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>
                {tvAccounts.length} cuenta{tvAccounts.length !== 1 ? "s" : ""} disponible{tvAccounts.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            style={{
              padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "600",
              border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.06)",
              color: "#f87171", cursor: "pointer",
            }}
          >
            Desconectar
          </button>
        </div>

        {/* Panel de sincronización */}
        <div style={cardStyle}>
          <h2 style={{ margin: "0 0 18px", fontSize: "15px", fontWeight: "700", color: "var(--text-1)" }}>
            Sincronizar trades
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Selección cuenta Tradovate */}
            <div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "7px" }}>
                Cuenta de Tradovate <span style={{ color: "#f87171" }}>*</span>
              </div>
              {tvAccounts.length === 0 ? (
                <div style={{ fontSize: "13px", color: "var(--text-muted)", padding: "10px", background: "var(--inner-bg)", borderRadius: "10px", border: "1px solid var(--border-input)" }}>
                  No se encontraron cuentas en esta conexión.
                </div>
              ) : (
                <select value={tvSelectedAccount} onChange={(e) => { setTvSelectedAccount(e.target.value); setTvPendingTrades([]) }} style={selectStyle}>
                  <option value="">— Selecciona cuenta de Tradovate —</option>
                  {tvAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Botón sincronizar */}
            <button
              onClick={handleSync}
              disabled={tvSyncing || !tvSelectedAccount}
              style={{
                padding: "12px 20px", borderRadius: "12px", border: "none",
                background: tvSyncing || !tvSelectedAccount
                  ? "rgba(148,163,184,0.07)"
                  : "linear-gradient(135deg,#6366f1,#4f46e5)",
                color: tvSyncing || !tvSelectedAccount ? "var(--text-muted)" : "#fff",
                fontWeight: "700", fontSize: "14px",
                cursor: tvSyncing || !tvSelectedAccount ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              {tvSyncing ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Sincronizando...
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  Obtener trades de Tradovate
                </>
              )}
            </button>

            {/* Error */}
            {tvError && (
              <div style={{ padding: "12px 14px", background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", fontSize: "13px", color: "#f87171" }}>
                {tvError}
              </div>
            )}

            {/* Trades pendientes de importar */}
            {tvPendingTrades.length > 0 && (
              <div style={{ padding: "16px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "#10b981" }}>
                    {tvPendingTrades.length} trade{tvPendingTrades.length !== 1 ? "s" : ""} encontrado{tvPendingTrades.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "7px" }}>
                    Importar a cuenta del journal <span style={{ color: "#f87171" }}>*</span>
                  </div>
                  <select value={tvJournalAccount} onChange={(e) => setTvJournalAccount(e.target.value)} style={selectStyle}>
                    <option value="">— Selecciona cuenta destino —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleImport}
                  disabled={!tvJournalAccount}
                  style={{
                    padding: "12px 20px", borderRadius: "12px", border: "none",
                    background: tvJournalAccount
                      ? "linear-gradient(135deg,#10b981,#059669)"
                      : "rgba(148,163,184,0.07)",
                    color: tvJournalAccount ? "#fff" : "var(--text-muted)",
                    fontWeight: "700", fontSize: "14px",
                    cursor: tvJournalAccount ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Importar {tvPendingTrades.length} trades al journal
                </button>

                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Los trades ya existentes en el journal no se duplicarán.
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Header */}
      <div>
        <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
          Automatización
        </p>
        <h1 style={{ margin: "8px 0 6px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
          Conectar a:
        </h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
          Elige tu plataforma para sincronizar trades automáticamente al journal
        </p>
      </div>

      {/* Selector de plataforma */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        {platforms.map(({ key, label, logo }) => {
          const active = platform === key
          return (
            <button
              key={key}
              onClick={() => setPlatform(active ? null : key)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: "14px", width: "140px", height: "130px", borderRadius: "18px",
                border: active ? "2px solid #10b981" : "2px solid rgba(148,163,184,0.12)",
                background: active ? "rgba(16,185,129,0.07)" : "var(--card-bg)",
                cursor: "pointer", transition: "all 0.18s",
                boxShadow: active ? "0 0 0 3px rgba(16,185,129,0.15)" : "none", padding: "0",
              }}
            >
              <img
                src={logo} alt={label}
                style={{ width: "52px", height: "52px", objectFit: "contain", filter: active ? "none" : "grayscale(30%) opacity(0.75)", transition: "filter 0.18s" }}
              />
              <span style={{ fontSize: "12px", fontWeight: "700", color: active ? "#10b981" : "var(--text-muted)", letterSpacing: "0.02em", transition: "color 0.18s" }}>
                {label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Contenido por plataforma */}
      {platform === "MT5" && (
        <>
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>
                Generar EA para tu cuenta
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: serverOnline ? "#10b981" : "var(--text-muted)", fontWeight: "600" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: serverOnline ? "#10b981" : "rgba(148,163,184,0.4)", boxShadow: serverOnline ? "0 0 6px #10b981" : "none", flexShrink: 0 }} />
                {serverOnline ? "Servidor activo" : "Servidor inactivo"}
              </div>
            </div>
            <div style={{ display: "grid", gap: "14px", maxWidth: "480px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "7px" }}>
                  Cuenta del journal <span style={{ color: "#f87171" }}>*</span>
                </div>
                <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} style={{ width: "100%", background: "var(--inner-bg)", border: `1px solid ${!selectedAccountId ? "rgba(248,113,113,0.4)" : "var(--border-input)"}`, color: "var(--text-1)", padding: "12px 14px", borderRadius: "10px", fontSize: "14px", outline: "none", fontFamily: "Inter, Arial, sans-serif", boxSizing: "border-box" }}>
                  <option value="">— Selecciona una cuenta —</option>
                  {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                </select>
              </div>
              {selectedAccount && (
                <div style={{ padding: "12px 14px", background: serverOnline ? "rgba(16,185,129,0.06)" : "rgba(148,163,184,0.05)", border: `1px solid ${serverOnline ? "rgba(16,185,129,0.2)" : "rgba(148,163,184,0.12)"}`, borderRadius: "10px", fontSize: "13px", color: "var(--text-muted)" }}>
                  {serverOnline ? (<>El EA se compilará con <span style={{ color: "#10b981", fontWeight: "700", fontFamily: "monospace" }}>JOURNAL_ACCOUNT = "{selectedAccount.name}"</span> incluido.</>) : (<>Se descargará el EA genérico. Al arrastrarlo a MT5 escribe <span style={{ color: "var(--text-1)", fontWeight: "700" }}>{selectedAccount.name}</span> en el campo <span style={{ fontFamily: "monospace", color: "var(--text-1)" }}>JOURNAL_ACCOUNT</span>.<br /><span style={{ fontSize: "11px", marginTop: "4px", display: "block" }}>Para generación automática inicia el servidor: <code style={{ color: "var(--text-1)", background: "rgba(148,163,184,0.1)", padding: "1px 5px", borderRadius: "4px" }}>npm run compile-server</code></span></>)}
                </div>
              )}
              <button onClick={handleDownload} disabled={!canDownload || compiling} style={{ padding: "13px 20px", borderRadius: "12px", border: "none", background: canDownload && !compiling ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(148,163,184,0.07)", color: canDownload && !compiling ? "#fff" : "var(--text-muted)", fontWeight: "700", fontSize: "14px", cursor: canDownload && !compiling ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                {compiling ? (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Compilando...</>) : (<><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>{serverOnline && selectedAccount ? `Descargar EA para "${selectedAccount.name}"` : "Descargar EA (.ex5)"}</>)}
              </button>
              {compiling && (<div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>Compilando el EA personalizado, esto puede tardar hasta 30 segundos...</div>)}
            </div>
          </div>
          <ParamsSection />
          <div style={cardStyle}>
            <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>Instrucciones de instalación</h2>
            <StepList steps={mt5Steps} />
            <div style={{ marginTop: "20px", padding: "14px 16px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: "12px", fontSize: "12px", color: "var(--text-muted)", display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <svg style={{ color: "#10b981", flexShrink: 0, marginTop: "1px" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span><span style={{ color: "#10b981", fontWeight: "700" }}>Historial automático — </span>al activar el EA sube todos los trades pasados de esa cuenta. Los ya existentes en el journal no se duplican.</span>
            </div>
          </div>
        </>
      )}

      {platform === "TRADOVATE" && <TradovateSection />}

      {platform === "NINJATRADER" && (
        <>
          <div style={cardStyle}>
            <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>Descargar AddOn para NinjaTrader 8</h2>
            <p style={{ margin: "0 0 18px", fontSize: "13px", color: "var(--text-muted)" }}>Archivo NinjaScript (.cs) — se importa directamente desde NinjaTrader sin necesidad de compilar manualmente.</p>
            <div style={{ display: "grid", gap: "14px", maxWidth: "480px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "7px" }}>Cuenta del journal <span style={{ color: "#f87171" }}>*</span></div>
                <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} style={{ width: "100%", background: "var(--inner-bg)", border: `1px solid ${!selectedAccountId ? "rgba(248,113,113,0.4)" : "var(--border-input)"}`, color: "var(--text-1)", padding: "12px 14px", borderRadius: "10px", fontSize: "14px", outline: "none", fontFamily: "Inter, Arial, sans-serif", boxSizing: "border-box" }}>
                  <option value="">— Selecciona una cuenta —</option>
                  {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                </select>
              </div>
              <button onClick={handleDownloadCS} style={{ padding: "13px 20px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", fontWeight: "700", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Descargar GlobalSairu_Journal.cs
              </button>
              <div style={{ padding: "12px 14px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: "10px", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6" }}>
                Compatible con <span style={{ color: "var(--text-1)", fontWeight: "600" }}>NinjaTrader 8</span>. Sincroniza todos los trades cerrados de la cuenta seleccionada.
              </div>
            </div>
          </div>
          <ParamsSection />
          <div style={cardStyle}>
            <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "700", color: "var(--text-1)" }}>Instrucciones de instalación</h2>
            <StepList steps={ntSteps} />
            <div style={{ marginTop: "20px", padding: "14px 16px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: "12px", fontSize: "12px", color: "var(--text-muted)", display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <svg style={{ color: "#10b981", flexShrink: 0, marginTop: "1px" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span><span style={{ color: "#10b981", fontWeight: "700" }}>Historial automático — </span>al activar el strategy sube todos los trades pasados. Los ya existentes en el journal no se duplican.</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
