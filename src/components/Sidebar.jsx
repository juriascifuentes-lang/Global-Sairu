import { useState, useEffect, useRef } from "react"
import { supabase } from "../lib/supabase"

const navIcons = {
  DASHBOARD: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  TRADES: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="12" y2="16"/>
    </svg>
  ),
  METRICS: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  CALENDAR: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  WITHDRAWALS: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="8 12 12 16 16 12"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
    </svg>
  ),
  IMPORT: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  STRATEGIES: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  ACCOUNTS: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  ROI_ACCOUNTS: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  ADMIN: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  CONNECT_MT5: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  COPY_TRADING: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
}

const refreshIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)

const sunIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const moonIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const navItems = [
  { key: "DASHBOARD", label: "Dashboard" },
  { key: "TRADES", label: "Trades" },
  { key: "METRICS", label: "Métricas" },
  { key: "CALENDAR", label: "Calendario" },
  { key: "STRATEGIES", label: "Estrategias" },
  { key: "WITHDRAWALS", label: "Retiros" },
  { key: "ROI_ACCOUNTS", label: "ROI de Cuentas" },
  { key: "IMPORT", label: "Importar" },
  { key: "ACCOUNTS", label: "Cuentas" },
  { key: "COPY_TRADING", label: "Copiador" },
  { key: "CONNECT_MT5", label: "Conectar MT5" },
]

const lockIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const logoutIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

function AccountSelector({ accounts, activeAccountId, onSelectAccount, onRefresh, showPct, onTogglePct }) {
  const [open, setOpen] = useState(false)

  const activeAccount = accounts.find((a) => String(a.id) === activeAccountId)
  const activeName = activeAccount ? activeAccount.name : "Todas las cuentas"

  const select = (id) => {
    onSelectAccount(id)
    setOpen(false)
  }

  return (
    <div style={{ marginBottom: "28px", position: "relative" }}>
      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: "6px", marginBottom: "8px", gap: "8px" }}>
        <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: "600" }}>
          Cuenta activa
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={onRefresh}
            title="Recargar"
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", padding: "6px", borderRadius: "10px" }}
          >
            {refreshIcon}
          </button>
        </div>
      </div>

      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 13px",
          borderRadius: "12px",
          border: open ? "1px solid rgba(16,185,129,0.5)" : "1px solid var(--border-input)",
          background: "var(--card-bg)",
          color: "var(--text-1)",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: "600",
          fontFamily: "Inter, Arial, sans-serif",
          transition: "border-color 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "6px",
              background: activeAccount ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(148,163,184,0.15)",
              display: "grid",
              placeItems: "center",
              fontSize: "9px",
              fontWeight: "800",
              color: activeAccount ? "#fff" : "var(--text-muted)",
              flexShrink: 0,
            }}
          >
            {activeAccount ? activeAccount.name.slice(0, 2).toUpperCase() : "✦"}
          </div>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeName}
          </span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "var(--text-muted)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--card-bg)",
            border: "1px solid var(--border-input)",
            borderRadius: "14px",
            overflow: "hidden",
            zIndex: 100,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          {/* Todas las cuentas */}
          <button
            onClick={() => select("")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 13px",
              background: !activeAccountId ? "rgba(16,185,129,0.08)" : "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "Inter, Arial, sans-serif",
              borderBottom: "1px solid var(--border-sub)",
            }}
          >
            <div style={{ width: "22px", height: "22px", borderRadius: "6px", background: "rgba(148,163,184,0.12)", display: "grid", placeItems: "center", fontSize: "11px", flexShrink: 0 }}>
              ✦
            </div>
            <span style={{ fontSize: "13px", fontWeight: !activeAccountId ? "700" : "500", color: !activeAccountId ? "#10b981" : "var(--text-1)" }}>
              Todas las cuentas
            </span>
            {!activeAccountId && (
              <svg style={{ marginLeft: "auto", color: "#10b981" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>

          {/* Cuentas individuales */}
          {accounts.map((account) => {
            const isActive = String(account.id) === activeAccountId
            return (
              <button
                key={account.id}
                onClick={() => select(String(account.id))}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 13px",
                  background: isActive ? "rgba(16,185,129,0.08)" : "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--border-sub)",
                  cursor: "pointer",
                  fontFamily: "Inter, Arial, sans-serif",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(148,163,184,0.05)" }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent" }}
              >
                <div style={{ width: "22px", height: "22px", borderRadius: "6px", background: "linear-gradient(135deg,#10b981,#059669)", display: "grid", placeItems: "center", fontSize: "9px", fontWeight: "800", color: "#fff", flexShrink: 0 }}>
                  {account.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: isActive ? "700" : "500", color: isActive ? "#10b981" : "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {account.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "2px" }}>
                    {account.broker && (
                      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                        {account.broker === "otro" ? account.brokerCustom : account.broker}
                      </span>
                    )}
                    {account.status && (
                      <span style={{
                        fontSize: "9px", fontWeight: "700", letterSpacing: "0.04em",
                        padding: "1px 5px", borderRadius: "4px",
                        background: account.status === "Suspendida" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.12)",
                        color: account.status === "Suspendida" ? "#ef4444" : "#10b981",
                      }}>
                        {account.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                {isActive && (
                  <svg style={{ color: "#10b981", flexShrink: 0 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const keyIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
)

function ChangePasswordModal({ onClose }) {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const inputStyle = {
    width: "100%",
    padding: "10px 13px",
    borderRadius: "10px",
    border: "1px solid var(--border-input)",
    background: "var(--app-bg)",
    color: "var(--text-1)",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "Inter, Arial, sans-serif",
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden"); return }
    if (newPassword.length < 6) { setError("Mínimo 6 caracteres"); return }
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setError("No se pudo cambiar la contraseña. Intenta de nuevo.")
    } else {
      setSuccess(true)
      timerRef.current = setTimeout(onClose, 1800)
    }
    setLoading(false)
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: "100%", maxWidth: "360px",
          background: "var(--card-bg)",
          borderRadius: "20px",
          border: "1px solid rgba(148,163,184,0.08)",
          padding: "28px 28px 24px",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--text-1)" }}>Cambiar contraseña</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>Elige una nueva contraseña segura</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "4px" }}
          >
            ✕
          </button>
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>✓</div>
            <div style={{ fontWeight: "700", color: "#10b981", fontSize: "14px" }}>Contraseña actualizada</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "13px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Nueva contraseña
              </label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Confirmar contraseña
              </label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" style={inputStyle} />
            </div>

            {error && (
              <p style={{ margin: 0, fontSize: "12px", color: "#f87171", background: "rgba(248,113,113,0.08)", padding: "9px 13px", borderRadius: "9px" }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button
                type="button" onClick={onClose}
                style={{
                  flex: 1, padding: "10px", borderRadius: "11px",
                  border: "1px solid var(--border-input)", background: "transparent",
                  color: "var(--text-muted)", fontWeight: "600", fontSize: "13px",
                  cursor: "pointer", fontFamily: "Inter, Arial, sans-serif",
                }}
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={loading}
                style={{
                  flex: 1, padding: "10px", borderRadius: "11px", border: "none",
                  background: loading ? "rgba(16,185,129,0.5)" : "linear-gradient(135deg,#10b981,#059669)",
                  color: "#fff", fontWeight: "700", fontSize: "13px",
                  cursor: loading ? "not-allowed" : "pointer", fontFamily: "Inter, Arial, sans-serif",
                }}
              >
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export function Sidebar({
  activePage,
  accounts,
  activeAccountId,
  onNavigate,
  onSelectAccount,
  onRefresh,
  userName = "Usuario",
  userEmail = "",
  theme = "dark",
  onToggleTheme,
  onLogout,
  isAdmin = false,
  userLevel = 1,
  showPct = false,
  onTogglePct,
}) {
  const isDark = theme === "dark"
  const [collapsed, setCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  if (collapsed) {
    return (
      <aside
        style={{
          width: "64px",
          background: "var(--sidebar-bg)",
          padding: "20px 10px",
          borderRight: "1px solid var(--border-nav)",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexShrink: 0,
          transition: "width 0.2s",
        }}
      >
        {/* Logo icon */}
        <div
          translate="no"
          style={{
            width: "34px", height: "34px", borderRadius: "10px",
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "grid", placeItems: "center",
            fontSize: "13px", fontWeight: "800", color: "#fff", marginBottom: "20px",
          }}
        >
          GS
        </div>

        {/* Expand button */}
        <button
          onClick={() => setCollapsed(false)}
          title="Expandir menú"
          style={{
            width: "36px", height: "36px", borderRadius: "10px",
            border: "1px solid var(--border-input)", background: "var(--card-bg)",
            color: "var(--text-muted)", cursor: "pointer",
            display: "grid", placeItems: "center", marginBottom: "16px",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.color = "#10b981" }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-input)"; e.currentTarget.style.color = "var(--text-muted)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* Nav icons only */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
          {[...navItems, ...(isAdmin ? [{ key: "ADMIN", label: "Usuarios" }] : [])].map((item) => {
            const isActive = activePage === item.key
            const isLocked = item.key === "COPY_TRADING" && userLevel === 1
            return (
              <button
                key={item.key}
                onClick={() => !isLocked && onNavigate(item.key)}
                title={isLocked ? `${item.label} (Nivel 2 requerido)` : item.label}
                style={{
                  width: "100%", padding: "10px", borderRadius: "10px", border: "none",
                  background: isActive ? "rgba(16,185,129,0.11)" : "transparent",
                  color: isActive ? "#10b981" : "var(--text-muted)",
                  cursor: isLocked ? "not-allowed" : "pointer",
                  display: "grid", placeItems: "center",
                  opacity: isLocked ? 0.45 : 1,
                }}
              >
                {navIcons[item.key]}
              </button>
            )
          })}
        </nav>
      </aside>
    )
  }

  return (
    <aside
      style={{
        width: "252px",
        background: "var(--sidebar-bg)",
        padding: "28px 18px",
        borderRight: "1px solid var(--border-nav)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Logo + collapse button */}
      <div style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: "32px", paddingLeft: "6px" }}>
        <div
          translate="no"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "grid",
            placeItems: "center",
            fontSize: "13px",
            fontWeight: "800",
            color: "#fff",
            flexShrink: 0,
            letterSpacing: "-0.02em",
          }}
        >
          GS
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--text-1)", fontWeight: "700", fontSize: "16px", lineHeight: 1, letterSpacing: "-0.01em" }}>
            Global Sairu
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px" }}>Journal Dashboard</div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          title="Colapsar menú"
          style={{
            flexShrink: 0, width: "28px", height: "28px", borderRadius: "8px",
            border: "1px solid var(--border-input)", background: "transparent",
            color: "var(--text-muted)", cursor: "pointer",
            display: "grid", placeItems: "center",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.color = "#10b981" }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-input)"; e.currentTarget.style.color = "var(--text-muted)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      <AccountSelector
        accounts={accounts}
        activeAccountId={activeAccountId}
        onSelectAccount={onSelectAccount}
        onRefresh={onRefresh}
        showPct={showPct}
        onTogglePct={onTogglePct}
      />

      {/* Nav label */}
      <div
        style={{
          fontSize: "10px",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          marginBottom: "8px",
          paddingLeft: "6px",
        }}
      >
        Navegación
      </div>

      {/* Nav items */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "auto" }}>
        {[...navItems, ...(isAdmin ? [{ key: "ADMIN", label: "Usuarios" }] : [])].map((item) => {
          const isActive = activePage === item.key
          const isLocked = item.key === "COPY_TRADING" && userLevel === 1
          return (
            <button
              key={item.key}
              onClick={() => !isLocked && onNavigate(item.key)}
              title={isLocked ? "Requiere Nivel 2" : undefined}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                borderRadius: "12px",
                border: "none",
                background: isActive ? "rgba(16, 185, 129, 0.11)" : "transparent",
                color: isActive ? "#10b981" : "var(--text-muted)",
                cursor: isLocked ? "not-allowed" : "pointer",
                fontSize: "13.5px",
                fontWeight: isActive ? "600" : "500",
                display: "flex",
                alignItems: "center",
                gap: "11px",
                transition: "background 0.12s, color 0.12s",
                opacity: isLocked ? 0.45 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isActive && !isLocked) {
                  e.currentTarget.style.background = "var(--nav-hover)"
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent"
              }}
            >
              <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.65 }}>
                {navIcons[item.key]}
              </span>
              {item.label}
              {isLocked && (
                <span style={{ marginLeft: "auto", opacity: 0.7 }}>
                  {lockIcon}
                </span>
              )}
            </button>
          )
        })}
      </nav>


      {/* User */}
      <div
        style={{
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: "1px solid var(--border-nav)",
          position: "relative",
        }}
        onMouseEnter={() => setUserMenuOpen(true)}
        onMouseLeave={() => setUserMenuOpen(false)}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "11px",
            paddingLeft: "4px",
            cursor: "pointer",
          }}
          onClick={() => setUserMenuOpen((prev) => !prev)}
        >
          <div
            translate="no"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #10b981, #059669)",
              display: "grid",
              placeItems: "center",
              fontWeight: "700",
              fontSize: "12px",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            GS
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: "var(--text-2)",
                fontWeight: "600",
                fontSize: "13px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userName}
            </div>
            {userEmail && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  marginTop: "2px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {userEmail}
              </div>
            )}
          </div>
        </div>

        {userMenuOpen && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "100%",
              background: "var(--card-bg)",
              border: "1px solid var(--border-input)",
              borderRadius: "18px",
              padding: "12px",
              boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
              zIndex: 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={onToggleTheme}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-input)",
                  background: "var(--card-bg)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ display: "flex", flexShrink: 0 }}>
                  {isDark ? sunIcon : moonIcon}
                </span>
                {isDark ? "Modo claro" : "Modo oscuro"}
              </button>

              <button
                onClick={() => { setShowChangePassword(true); setUserMenuOpen(false) }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-input)",
                  background: "var(--card-bg)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ display: "flex", flexShrink: 0 }}>{keyIcon}</span>
                Cambiar contraseña
              </button>

              {onLogout && (
                <button
                  onClick={onLogout}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: "1px solid rgba(248,113,113,0.2)",
                    background: "transparent",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ display: "flex", flexShrink: 0 }}>{logoutIcon}</span>
                  Cerrar sesión
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </aside>
  )
}
