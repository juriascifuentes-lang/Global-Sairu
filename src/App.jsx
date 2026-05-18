import { useState, useEffect, useMemo } from "react"
import { supabase } from "./lib/supabase"
import { useJournalData } from "./hooks/useJournalData"
import { LoginScreen } from "./components/LoginScreen"
import { Sidebar } from "./components/Sidebar"
import { TradeForm } from "./components/TradeForm"
import { TradeList } from "./components/TradeList"
import { Statistics } from "./components/Statistics"
import { CalendarPanel } from "./components/CalendarPanel"
import { EquityCurve } from "./components/EquityCurve"
import { AccountsPanel } from "./components/AccountsPanel"
import { WithdrawalsPanel } from "./components/WithdrawalsPanel"
import { ImportPanel } from "./components/ImportPanel"
import { MetricsPanel } from "./components/MetricsPanel"
import { ROIAccountsPanel } from "./components/ROIAccountsPanel"
import { StrategiesPanel } from "./components/StrategiesPanel"
import { PendingScreen } from "./components/PendingScreen"
import { EmailVerifiedScreen } from "./components/EmailVerifiedScreen"
import { ResetPasswordScreen } from "./components/ResetPasswordScreen"
import { AdminPanel } from "./components/AdminPanel"
import { ConnectMT5Panel } from "./components/ConnectMT5Panel"
import { CopyTradingPanel } from "./components/CopyTradingPanel"
import { ConfirmModal } from "./components/ConfirmModal"
import {
  RecentTradesWidget,
  AccountROIWidget,
  LastWithdrawalsWidget,
} from "./components/DashboardWidgets"

const defaultForm = {
  symbol: "", type: "BUY", profit: "", note: "",
  date: new Date().toISOString().split("T")[0],
  openTime: "", strategy: "", account: "",
  setupQuality: "", psychology: "",
  images: [], entryNote: "", entryImages: [],
  stopLoss: "", takeProfit: "",
}

const parseAccountSize = (size) => {
  const lookup = { "5K": 5000, "10K": 10000, "25K": 25000, "50K": 50000, "100K": 100000, "150K": 150000, "200K": 200000 }
  if (!size) return 0
  const s = String(size).trim()
  if (lookup[s]) return lookup[s]
  const n = parseFloat(s.replace(/[^0-9.]/g, ""))
  if (isNaN(n)) { console.warn("[parseAccountSize] valor inválido:", size); return 0 }
  return n >= 1000 ? n : n * 1000
}

const pageHeadings = {
  CALENDAR: { sup: "Calendario operativo", title: "Calendario", sub: "Revisa tus días con más actividad y compara tu desempeño en el tiempo." },
}

function PageHeader({ sup, title, sub }) {
  return (
    <section style={{ marginBottom: "8px" }}>
      <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
        {sup}
      </p>
      <h1 style={{ margin: "8px 0 6px", fontSize: "36px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
        {title}
      </h1>
      <p style={{ margin: 0, color: "var(--text-muted)", maxWidth: "600px", fontSize: "14px", lineHeight: "1.6" }}>
        {sub}
      </p>
    </section>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(() =>
    window.location.hash.includes("type=recovery")
  )
  const [emailVerified, setEmailVerified] = useState(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(window.location.search)
    return hash.includes("type=signup") || params.get("type") === "signup"
  })
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(false)
  const [activePage, setActivePage] = useState(() => localStorage.getItem("activePage") || "DASHBOARD")
  const [isEditing, setIsEditing] = useState(false)
  const [showTradeForm, setShowTradeForm] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark")
  const [showPct, setShowPct] = useState(false)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [dashboardFilter, setDashboardFilter] = useState("all")
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(false)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [activePage])

  useEffect(() => {
    if (emailVerified) {
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true)
        setSession(session)
      } else if (event === "SIGNED_IN" && window.location.hash.includes("type=recovery")) {
        setSession(session)
      } else {
        setPasswordRecovery(false)
        setSession(session)
      }
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user?.id) return
    setProfileError(false)
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data, error }) => {
        if (data) {
          setProfile(data)
        } else {
          console.error("[profile load]", error)
          setProfileError(true)
        }
      })
  }, [session?.user?.id])

  useEffect(() => {
    localStorage.setItem("activePage", activePage)
  }, [activePage])

  useEffect(() => {
    document.documentElement.className = theme
    localStorage.setItem("theme", theme)
  }, [theme])

  const showToast = (message, type = "error") => {
    setToast({ message, type })
    const duration = Math.max(4000, message.length * 60)
    setTimeout(() => setToast(null), duration)
  }

  const userId = session?.user?.id ?? ""

  const {
    trades, accounts, withdrawals, strategies,
    selectedAccountId, setSelectedAccountId,
    loadData,
    addTrade, deleteTrade, deleteManyTrades, clearAllTrades, importTrades, replaceAccountTrades,
    createAccount, deleteAccount, updateAccount,
    addWithdrawal, deleteWithdrawal,
    createStrategy, deleteStrategy,
  } = useJournalData(userId, showToast)

  const accountSizeMap = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.name, parseAccountSize(a.size)])),
    [accounts]
  )

  if (emailVerified) {
    return <EmailVerifiedScreen onContinue={() => setEmailVerified(false)} />
  }

  if (passwordRecovery) {
    return <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--app-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Cargando...</div>
      </div>
    )
  }

  if (!session) return <LoginScreen />

  if (!profile) {
    if (profileError) {
      return (
        <div style={{ minHeight: "100vh", background: "var(--app-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
          <div style={{ color: "#f87171", fontSize: "14px", fontWeight: "600" }}>No se pudo cargar tu perfil</div>
          <button
            onClick={async () => { await supabase.auth.signOut(); setProfile(null); setProfileError(false) }}
            style={{ padding: "10px 20px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
          >
            Volver al inicio
          </button>
        </div>
      )
    }
    return (
      <div style={{ minHeight: "100vh", background: "var(--app-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Cargando...</div>
      </div>
    )
  }

  if (!profile.is_approved) return <PendingScreen />

  const userEmail = session.user.email
  const rawName = userEmail.split("@")[0]
  const userName = rawName.charAt(0).toUpperCase() + rawName.slice(1)

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"))

  const activeAccount = selectedAccountId
    ? accounts.find((a) => String(a.id) === selectedAccountId)
    : null

  const accountsWithTrades = activeAccount
    ? [activeAccount]
    : accounts.filter((a) => trades.some((t) => t.account === a.name))

  const baseCapital = accountsWithTrades.length === 1
    ? parseAccountSize(accountsWithTrades[0].size)
    : accountsWithTrades.reduce((sum, a) => sum + parseAccountSize(a.size), 0)

  const resetForm = () => {
    setForm({ ...defaultForm, date: new Date().toISOString().split("T")[0] })
    setIsEditing(false)
  }

  const handleAddTrade = async () => {
    await addTrade(form, isEditing)
    resetForm()
    setShowTradeForm(false)
  }

  const editTrade = (trade) => {
    setForm({ ...trade })
    setIsEditing(true)
    setShowTradeForm(true)
    setActivePage("TRADES")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(trades, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `trades-${new Date().toISOString().split("T")[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const displayedTrades = activeAccount
    ? trades.filter((t) => t.account === activeAccount.name)
    : trades

  const displayedWithdrawals = activeAccount
    ? withdrawals.filter((w) => w.account === activeAccount.name)
    : withdrawals

  const totalProfit = displayedTrades.reduce((sum, t) => sum + Number(t.profit || 0), 0)

  const mobilePageLabels = {
    DASHBOARD: "Dashboard", TRADES: "Trades", METRICS: "Métricas",
    CALENDAR: "Calendario", STRATEGIES: "Estrategias", WITHDRAWALS: "Retiros",
    ROI_ACCOUNTS: "ROI de Cuentas", IMPORT: "Importar", ACCOUNTS: "Cuentas",
    COPY_TRADING: "Copiador", CONNECT_MT5: "Conectar", ADMIN: "Usuarios",
  }

  const bottomNavItems = [
    { key: "DASHBOARD", label: "Dashboard", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg> },
    { key: "TRADES", label: "Trades", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></svg> },
    { key: "METRICS", label: "Métricas", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { key: "ACCOUNTS", label: "Cuentas", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ]

  return (
    <div
      style={{
        background: "var(--app-bg)",
        minHeight: "100vh",
        color: "var(--text-1)",
        fontFamily: "Inter, Arial, sans-serif",
        display: "flex",
      }}
    >
      <Sidebar
        activePage={activePage}
        accounts={accounts}
        activeAccountId={selectedAccountId}
        onNavigate={setActivePage}
        onSelectAccount={setSelectedAccountId}
        onRefresh={loadData}
        userName={userName}
        userEmail={userEmail}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
        isAdmin={profile.is_admin}
        userLevel={profile.level || 1}
        showPct={showPct}
        onTogglePct={(val) => setShowPct(val)}
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile top bar */}
      {isMobile && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, height: "56px",
          background: "var(--sidebar-bg)", borderBottom: "1px solid var(--border-nav)",
          display: "flex", alignItems: "center", gap: "12px",
          padding: "0 16px", zIndex: 100,
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: "none", border: "none", color: "var(--text-1)", cursor: "pointer", padding: "6px", display: "flex" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span style={{ fontWeight: "700", fontSize: "17px", color: "var(--text-1)", letterSpacing: "-0.01em" }}>
            {mobilePageLabels[activePage] || "Global Sairu"}
          </span>
        </div>
      )}

      <main style={{ flex: 1, padding: isMobile ? "72px 16px 80px" : "32px 40px 60px", overflowY: "auto", minWidth: 0, background: "var(--app-bg)" }}>

        {/* ─── ADMIN ─── */}
        {activePage === "ADMIN" && profile.is_admin && <AdminPanel />}

        {/* ─── CONNECT MT5 ─── */}
        {activePage === "CONNECT_MT5" && <ConnectMT5Panel accounts={accounts} userId={userId} />}

        {/* ─── COPY TRADING ─── */}
        {activePage === "COPY_TRADING" && (
          <CopyTradingPanel accounts={accounts} userId={userId} />
        )}

        {/* ─── ACCOUNTS ─── */}
        {activePage === "ACCOUNTS" && (
          <AccountsPanel
            accounts={accounts}
            trades={trades}
            onCreateAccount={createAccount}
            onDeleteAccount={deleteAccount}
            onUpdateAccount={updateAccount}
            onReplaceAccountTrades={replaceAccountTrades}
            showPct={showPct}
          />
        )}

        {/* ─── STRATEGIES ─── */}
        {activePage === "STRATEGIES" && (
          <StrategiesPanel
            strategies={strategies}
            onCreateStrategy={createStrategy}
            onDeleteStrategy={deleteStrategy}
          />
        )}

        {/* ─── ROI ACCOUNTS ─── */}
        {activePage === "ROI_ACCOUNTS" && (
          <ROIAccountsPanel accounts={accounts} withdrawals={withdrawals} />
        )}

        {/* ─── WITHDRAWALS ─── */}
        {activePage === "WITHDRAWALS" && (
          <WithdrawalsPanel
            withdrawals={displayedWithdrawals}
            accounts={accounts}
            onAddWithdrawal={addWithdrawal}
            onDeleteWithdrawal={deleteWithdrawal}
          />
        )}

        {/* ─── IMPORT ─── */}
        {activePage === "IMPORT" && (
          <ImportPanel accounts={accounts} onImportTrades={importTrades} onNavigate={setActivePage} />
        )}

        {/* ─── TRADES ─── */}
        {activePage === "TRADES" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
                  Registro de trades
                </p>
                <h1 style={{ margin: "8px 0 4px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
                  Trades
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
                    Historial de operaciones
                  </p>
                  {activeAccount ? (
                    <span style={{
                      fontSize: "11px", fontWeight: "700", padding: "3px 10px",
                      borderRadius: "999px", background: "rgba(16,185,129,0.12)",
                      border: "1px solid rgba(16,185,129,0.25)", color: "#10b981",
                    }}>
                      {activeAccount.name}
                    </span>
                  ) : (
                    <span style={{
                      fontSize: "11px", fontWeight: "600", padding: "3px 10px",
                      borderRadius: "999px", background: "rgba(148,163,184,0.08)",
                      border: "1px solid rgba(148,163,184,0.15)", color: "var(--text-muted)",
                    }}>
                      Todas las cuentas
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
                {displayedTrades.length > 0 && (
                  <button
                    onClick={() => clearAllTrades(activeAccount?.name)}
                    style={{
                      padding: "11px 18px", borderRadius: "12px",
                      border: "1px solid rgba(248, 113, 113, 0.28)",
                      background: "rgba(248, 113, 113, 0.08)", color: "#f87171",
                      fontWeight: "700", fontSize: "13px", cursor: "pointer",
                    }}
                  >
                    {activeAccount ? `Limpiar "${activeAccount.name}"` : "Limpiar historial"}
                  </button>
                )}
                <button
                  onClick={() => { resetForm(); setShowTradeForm(true) }}
                  style={{
                    padding: "11px 18px", borderRadius: "12px", border: "none",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "#fff", fontWeight: "700", fontSize: "13px", cursor: "pointer",
                  }}
                >
                  + Nuevo trade
                </button>
              </div>
            </div>

            {(showTradeForm || isEditing) && (
              <TradeForm
                form={form}
                setForm={setForm}
                onAddTrade={handleAddTrade}
                isEditing={isEditing}
                accounts={accounts}
                strategies={strategies}
                onCancel={() => { resetForm(); setShowTradeForm(false) }}
              />
            )}

            <TradeList
              trades={displayedTrades}
              onEditTrade={editTrade}
              onDeleteTrade={deleteTrade}
              onDeleteManyTrades={deleteManyTrades}
              activeAccountName={activeAccount ? activeAccount.name : null}
              showPct={showPct}
              accountSizeMap={accountSizeMap}
            />
          </div>
        )}

        {/* ─── METRICS ─── */}
        {activePage === "METRICS" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
                Análisis
              </p>
              <h1 style={{ margin: "8px 0 4px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
                Métricas
              </h1>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>
                Métricas avanzadas de tu rendimiento
              </p>
            </div>
            <MetricsPanel
              trades={displayedTrades}
              showPct={showPct}
              baseCapital={baseCapital}
              accountSizeMap={accountSizeMap}
            />
          </div>
        )}

        {/* ─── CALENDAR ─── */}
        {activePage === "CALENDAR" && (
          <div style={{ display: "grid", gap: "20px" }}>
            <PageHeader {...pageHeadings.CALENDAR} />
            <CalendarPanel trades={displayedTrades} showPct={showPct} accountSizeMap={accountSizeMap} />
          </div>
        )}

        {/* ─── DASHBOARD ─── */}
        {activePage === "DASHBOARD" && (() => {
          const dashFilterNames = dashboardFilter === "all" ? null
            : accounts
                .filter(a => dashboardFilter === "challenge"
                  ? (a.phase === "Fase 1" || a.phase === "Fase 2")
                  : a.phase === "Fondeada")
                .map(a => a.name)

          const dashTrades = dashFilterNames
            ? displayedTrades.filter(t => dashFilterNames.includes(t.account))
            : displayedTrades

          const dashWithdrawals = dashFilterNames
            ? displayedWithdrawals.filter(w => dashFilterNames.includes(w.account))
            : displayedWithdrawals

          const dashAccounts = dashFilterNames
            ? accounts.filter(a => dashFilterNames.includes(a.name))
            : accountsWithTrades

          const dashCapital = dashAccounts.length === 1
            ? parseAccountSize(dashAccounts[0].size)
            : dashAccounts.reduce((s, a) => s + parseAccountSize(a.size), 0)

          const dashTotalProfit = dashTrades.reduce((s, t) => s + Number(t.profit || 0), 0)

          const totalPct = showPct
            ? dashTrades.reduce((s, t) => {
                const size = accountSizeMap[t.account] || dashCapital
                return size > 0 ? s + (Number(t.profit || 0) / size) * 100 : s
              }, 0)
            : null
          const equityLabel = showPct && totalPct !== null
            ? `${totalPct >= 0 ? "+" : ""}${totalPct.toFixed(2)}%`
            : `${dashTotalProfit >= 0 ? "+" : ""}$${dashTotalProfit.toFixed(2)}`
          const equityColor = dashTotalProfit >= 0 ? "#10b981" : "#f87171"

          const filterOptions = [
            { key: "all", label: "Todas" },
            { key: "challenge", label: "Challenge" },
            { key: "funded", label: "Fondeadas" },
          ]

          // ── Dashboard móvil ──
          if (isMobile) {
            const now = new Date()
            const monthTrades = dashTrades.filter(t => {
              const d = new Date(t.date)
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            })
            const monthProfit = monthTrades.reduce((s, t) => s + Number(t.profit || 0), 0)
            const wins = dashTrades.filter(t => Number(t.profit) > 0).length
            const winRate = dashTrades.length > 0 ? (wins / dashTrades.length) * 100 : 0
            const recentTrades = [...dashTrades].slice(0, 6)

            return (
              <>
                {/* Saludo */}
                <p style={{ margin: "0 0 20px", color: "var(--text-muted)", fontSize: "14px" }}>
                  Hola, <strong style={{ color: "var(--text-1)" }}>{userName.split(/\d/)[0]}</strong>
                </p>

                {/* P&L mes + Win rate */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ background: "var(--card-bg)", borderRadius: "16px", padding: "18px 16px", border: "1px solid var(--border-card)" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>P&L del mes</div>
                    <div style={{ fontSize: "26px", fontWeight: "800", color: monthProfit >= 0 ? "#10b981" : "#f87171", letterSpacing: "-0.02em" }}>
                      {monthProfit >= 0 ? "+" : ""}${monthProfit.toFixed(0)}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{monthTrades.length} trades</div>
                  </div>
                  <div style={{ background: "var(--card-bg)", borderRadius: "16px", padding: "18px 16px", border: "1px solid var(--border-card)" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "6px" }}>Win Rate</div>
                    <div style={{ fontSize: "26px", fontWeight: "800", color: winRate >= 50 ? "#10b981" : "#f87171", letterSpacing: "-0.02em" }}>
                      {winRate.toFixed(0)}%
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{wins}W / {dashTrades.length - wins}L</div>
                  </div>
                </div>

                {/* P&L total acumulado */}
                <div style={{ background: "var(--card-bg)", borderRadius: "16px", padding: "16px 18px", border: "1px solid var(--border-card)", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>P&L Total acumulado</div>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: equityColor, marginTop: "4px" }}>{equityLabel}</div>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "right" }}>
                    <div>{dashTrades.length} trades totales</div>
                  </div>
                </div>

                {/* Equity Curve */}
                <div style={{ background: "var(--card-bg)", borderRadius: "16px", padding: "16px 18px", border: "1px solid var(--border-card)", marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "10px" }}>Curva de Equity</div>
                  <div style={{ height: "160px" }}>
                    <EquityCurve trades={dashTrades} showPct={showPct} baseCapital={dashCapital} accountSizeMap={accountSizeMap} />
                  </div>
                </div>

                {/* Últimos trades */}
                <div style={{ background: "var(--card-bg)", borderRadius: "16px", padding: "16px 18px", border: "1px solid var(--border-card)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-1)" }}>Últimos trades</div>
                    <button onClick={() => setActivePage("TRADES")} style={{ background: "none", border: "none", color: "#10b981", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Ver todos →</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {recentTrades.length === 0 && (
                      <div style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "16px 0" }}>Sin trades aún</div>
                    )}
                    {recentTrades.map(t => {
                      const profit = Number(t.profit || 0)
                      return (
                        <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-row)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{
                              width: "8px", height: "8px", borderRadius: "50%",
                              background: profit >= 0 ? "#10b981" : "#f87171", flexShrink: 0,
                            }} />
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-1)" }}>{t.symbol}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{t.date} · {t.type === "BUY" ? "LONG" : "SHORT"}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: "700", color: profit >= 0 ? "#10b981" : "#f87171" }}>
                            {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )
          }

          return (
            <>
              {/* ── Header ── */}
              <div style={{ marginBottom: "0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
                    Resumen de rendimiento
                  </p>
                  <h1 style={{ margin: "8px 0 6px", fontSize: "36px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
                    Hola, {userName.split(/\d/)[0]}
                  </h1>
                  <p style={{ margin: 0, color: "var(--text-muted)", maxWidth: "600px", fontSize: "14px", lineHeight: "1.6" }}>
                    Monitorea tus resultados en tiempo real y lleva control visual de tus entradas, ganancias y métricas clave.
                  </p>
                </div>

                {/* Filtro de cuentas */}
                <div style={{ display: "flex", gap: "4px", background: "var(--inner-bg)", borderRadius: "14px", padding: "4px", alignSelf: "flex-start", marginTop: "8px" }}>
                  {filterOptions.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setDashboardFilter(f.key)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "10px",
                        border: "none",
                        background: dashboardFilter === f.key ? "var(--card-bg)" : "transparent",
                        color: dashboardFilter === f.key ? "var(--text-1)" : "var(--text-muted)",
                        fontWeight: dashboardFilter === f.key ? "700" : "500",
                        fontSize: "12.5px",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontFamily: "Inter, Arial, sans-serif",
                        boxShadow: dashboardFilter === f.key ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Statistics ── */}
              <Statistics trades={dashTrades} showPct={showPct} baseCapital={dashCapital} accountSizeMap={accountSizeMap} />

              {/* ── Equity Curve ── */}
              <div style={{ background: "var(--card-bg)", borderRadius: "20px", padding: "20px 22px", border: "1px solid var(--border-card)", marginTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      Rendimiento acumulado
                    </div>
                    <h3 style={{ margin: "3px 0 0", color: "var(--text-1)", fontSize: "15px", fontWeight: "700" }}>Curva de Equity</h3>
                  </div>
                  <span style={{ color: equityColor, fontWeight: "800", fontSize: "22px", letterSpacing: "-0.02em" }}>{equityLabel}</span>
                </div>
                <div style={{ height: "260px", display: "flex", flexDirection: "column" }}>
                  <EquityCurve trades={dashTrades} showPct={showPct} baseCapital={dashCapital} accountSizeMap={accountSizeMap} />
                </div>
              </div>

              {/* ── Calendario + Trades recientes ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "16px", marginTop: "16px" }}>
                <CalendarPanel trades={dashTrades} showPct={showPct} accountSizeMap={accountSizeMap} />
                <RecentTradesWidget trades={dashTrades} onNavigate={setActivePage} showPct={showPct} accountSizeMap={accountSizeMap} />
              </div>

              {/* ── ROI + Retiros ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
                <AccountROIWidget accounts={dashAccounts} withdrawals={dashWithdrawals} onNavigate={setActivePage} />
                <LastWithdrawalsWidget withdrawals={dashWithdrawals} onNavigate={setActivePage} />
              </div>
            </>
          )
        })()}
      </main>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: "64px",
          background: "var(--sidebar-bg)", borderTop: "1px solid var(--border-nav)",
          display: "flex", alignItems: "center", justifyContent: "space-around",
          zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)",
        }}>
          {bottomNavItems.map(({ key, label, icon }) => {
            const isActive = activePage === key
            return (
              <button
                key={key}
                onClick={() => setActivePage(key)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                  background: "none", border: "none", cursor: "pointer",
                  color: isActive ? "#10b981" : "var(--text-muted)",
                  padding: "6px 12px", borderRadius: "10px", minWidth: "56px",
                }}
              >
                {icon}
                <span style={{ fontSize: "10px", fontWeight: isActive ? "700" : "500" }}>{label}</span>
              </button>
            )
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", padding: "6px 12px", borderRadius: "10px", minWidth: "56px",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span style={{ fontSize: "10px", fontWeight: "500" }}>Menú</span>
          </button>
        </nav>
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: isMobile ? "76px" : "24px", right: "24px", zIndex: 9999,
          background: toast.type === "error" ? "#ef4444" : "#10b981",
          color: "#fff", padding: "12px 20px", borderRadius: "12px",
          fontWeight: "600", fontSize: "13px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          maxWidth: "340px", lineHeight: "1.4",
        }}>
          {toast.message}
        </div>
      )}
      <ConfirmModal />
    </div>
  )
}

export default App
