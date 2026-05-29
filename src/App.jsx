import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "./lib/supabase"
import { useJournalData } from "./hooks/useJournalData"
import { useReviewData } from "./hooks/useReviewData"
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
import { ReviewComparative } from "./components/ReviewComparative"
import { ConfirmModal } from "./components/ConfirmModal"
import {
  RecentTradesWidget,
  AccountROIWidget,
  LastWithdrawalsWidget,
} from "./components/DashboardWidgets"

const SESSIONS_KEY = "gs_saved_sessions"

const saveSessionToStorage = (session) => {
  if (!session?.user?.email || !session?.refresh_token) return
  try {
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]")
    const email = session.user.email
    const displayName = email.split("@")[0]
    const entry = { email, displayName, accessToken: session.access_token, refreshToken: session.refresh_token, userId: session.user.id }
    const idx = sessions.findIndex((s) => s.email === email)
    if (idx >= 0) sessions[idx] = entry
    else sessions.push(entry)
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  } catch (e) {
    console.warn("[saveSession]", e)
  }
}

const removeSavedSession = (email) => {
  try {
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]")
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.filter((s) => s.email !== email)))
  } catch {}
}

const defaultForm = {
  symbol: "", type: "BUY", profit: "", note: "",
  date: new Date().toISOString().split("T")[0],
  openTime: "", strategy: "", account: "",
  setupQuality: "", psychology: "",
  images: [], entryNote: "", entryImages: [],
  stopLoss: "", takeProfit: "", maxRR: "", maxFavorableRR: "",
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
  const [addingAccount, setAddingAccount] = useState(false)
  const addingAccountRef = useRef(false)
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
  const [marketFilter, setMarketFilter] = useState("all")
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

  // Detectar retorno del OAuth de Tradovate (?tradovate=success|error)
  const [pendingTvNotif, setPendingTvNotif] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get("tradovate") || null
  })

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
      if (session?.user?.email && session?.refresh_token) {
        saveSessionToStorage(session)
      }
      // If we were adding a second account and a new login arrived, close the add-account screen
      if (event === "SIGNED_IN" && addingAccountRef.current) {
        addingAccountRef.current = false
        setAddingAccount(false)
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

  useEffect(() => {
    if (!pendingTvNotif) return
    window.history.replaceState(null, "", window.location.pathname)
    setPendingTvNotif(null)
    if (pendingTvNotif === "success") {
      setActivePage("CONNECT_MT5")
      showToast("Tradovate conectado exitosamente", "success")
    } else {
      showToast("Error al conectar con Tradovate — intenta de nuevo")
    }
  }, [pendingTvNotif]) // eslint-disable-line react-hooks/exhaustive-deps

  const userId = session?.user?.id ?? ""

  const {
    trades, accounts, withdrawals, strategies,
    selectedAccountId, setSelectedAccountId,
    loadData,
    addTrade, deleteTrade, deleteManyTrades, clearAllTrades, importTrades, replaceAccountTrades, appendAccountTrades,
    createAccount, deleteAccount, updateAccount,
    addWithdrawal, deleteWithdrawal,
    createStrategy, deleteStrategy,
  } = useJournalData(userId, showToast)

  const {
    trades: reviewTrades, accounts: reviewAccounts, strategies: reviewStrategies,
    selectedAccountId: selectedReviewAccountId, setSelectedAccountId: setSelectedReviewAccountId,
    addTrade: reviewAddTrade, deleteTrade: reviewDeleteTrade, deleteManyTrades: reviewDeleteManyTrades,
    clearAllTrades: reviewClearAllTrades, importTrades: reviewImportTrades,
    replaceAccountTrades: reviewReplaceAccountTrades, appendAccountTrades: reviewAppendAccountTrades,
    createAccount: reviewCreateAccount, deleteAccount: reviewDeleteAccount, updateAccount: reviewUpdateAccount,
    createStrategy: reviewCreateStrategy, deleteStrategy: reviewDeleteStrategy,
  } = useReviewData(userId, showToast)

  const [reviewForm, setReviewForm] = useState(defaultForm)
  const [showReviewTradeForm, setShowReviewTradeForm] = useState(false)
  const [isReviewEditing, setIsReviewEditing] = useState(false)
  const now = new Date()
  const [reviewCalendarMonth, setReviewCalendarMonth] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [reviewCalendarFilterAccounts, setReviewCalendarFilterAccounts] = useState([])
  const [reviewMetricsFilterAccounts, setReviewMetricsFilterAccounts] = useState([])

  const resetReviewForm = () => {
    setReviewForm({ ...defaultForm, date: new Date().toISOString().split("T")[0] })
    setIsReviewEditing(false)
  }

  const handleReviewAddTrade = async () => {
    await reviewAddTrade(reviewForm, isReviewEditing)
    resetReviewForm()
    setShowReviewTradeForm(false)
  }

  const editReviewTrade = (trade) => {
    setReviewForm({ ...trade })
    setIsReviewEditing(true)
    setShowReviewTradeForm(true)
    setActivePage("REVIEW_TRADES")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const REVIEW_PAGES = ["REVIEW_TRADES", "REVIEW_METRICS", "REVIEW_CALENDAR", "REVIEW_STRATEGIES", "REVIEW_ACCOUNTS", "REVIEW_COMPARATIVE"]
  const isReviewPage = REVIEW_PAGES.includes(activePage)

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

  if (addingAccount) return <LoginScreen />

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
    // Real logout: revoke tokens server-side and remove from saved sessions
    if (session?.user?.email) removeSavedSession(session.user.email)
    await supabase.auth.signOut({ scope: "global" })
    setProfile(null)
  }

  // Add a second account: save current session then show login WITHOUT signing out.
  // signOut (any scope) revokes the current refresh token server-side, so we never call it here.
  const handleAddAccount = async () => {
    const { data: { session: current } } = await supabase.auth.getSession()
    if (current) saveSessionToStorage(current)
    addingAccountRef.current = true
    setAddingAccount(true)
  }

  const handleSwitchAccount = async (entry) => {
    try {
      // setSession handles expired access tokens automatically using the refresh token
      setProfile(null)
      const { error } = await supabase.auth.setSession({
        access_token: entry.accessToken || "",
        refresh_token: entry.refreshToken,
      })
      if (error) {
        removeSavedSession(entry.email)
        showToast(`La sesión de ${entry.email} expiró. Vuelve a iniciar sesión.`)
      }
    } catch (err) {
      console.error("[switchAccount]", err)
      showToast("No se pudo cambiar de cuenta.")
    }
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
    { key: "CALENDAR", label: "Calendario", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
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
        onAddAccount={handleAddAccount}
        onSwitchAccount={handleSwitchAccount}
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

        {/* ─── BANNER REVISIÓN ─── */}
        {isReviewPage && (
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            marginBottom: "24px", padding: "10px 16px",
            background: "rgba(168,85,247,0.08)", borderRadius: "12px",
            border: "1px solid rgba(168,85,247,0.25)",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#a855f7" }}>Modo Revisión</span>
            <span style={{ fontSize: "12px", color: "rgba(168,85,247,0.7)" }}>— Los datos de esta sección son independientes al journal principal.</span>
          </div>
        )}

        {/* ─── ADMIN ─── */}
        {activePage === "ADMIN" && profile.is_admin && <AdminPanel />}

        {/* ─── CONNECT MT5 ─── */}
        {activePage === "CONNECT_MT5" && <ConnectMT5Panel accounts={accounts} userId={userId} onImportTrades={importTrades} />}

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
            onAppendAccountTrades={appendAccountTrades}
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
            <CalendarPanel trades={displayedTrades} showPct={showPct} accountSizeMap={accountSizeMap} isMobile={isMobile} />
          </div>
        )}

        {/* ─── DASHBOARD ─── */}
        {activePage === "DASHBOARD" && (() => {
          const dashFilterNames = (dashboardFilter === "all" && marketFilter === "all") ? null
            : accounts
                .filter(a => {
                  const phaseMatch = dashboardFilter === "all" ? true
                    : dashboardFilter === "challenge"
                      ? (a.phase === "Fase 1" || a.phase === "Fase 2")
                      : a.phase === "Fondeada"
                  const marketMatch = marketFilter === "all" ? true
                    : marketFilter === "futuros"
                      ? a.capitalType === "Empresa de Fondeo Futuros"
                      : a.capitalType === "Empresa de Fondeo CFDS"
                  return phaseMatch && marketMatch
                })
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
            const recentTrades = [...dashTrades].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6)

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
                <div style={{ background: "var(--card-bg)", borderRadius: "16px", padding: "16px 18px 20px", border: "1px solid var(--border-card)", marginBottom: "16px", overflow: "hidden" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "10px" }}>Curva de Equity</div>
                  <div style={{ height: "200px" }}>
                    <EquityCurve trades={dashTrades} showPct={showPct} baseCapital={dashCapital} accountSizeMap={accountSizeMap} hideXAxis />
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

                {/* Filtros */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignSelf: "flex-start", marginTop: "8px" }}>
                  {/* Filtro mercado */}
                  <div style={{ display: "flex", gap: "4px", background: "var(--inner-bg)", borderRadius: "14px", padding: "4px" }}>
                    {[{ key: "all", label: "Todos" }, { key: "futuros", label: "Futuros" }, { key: "forex", label: "Forex" }].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setMarketFilter(f.key)}
                        style={{
                          padding: "7px 14px",
                          borderRadius: "10px",
                          border: "none",
                          background: marketFilter === f.key ? "var(--card-bg)" : "transparent",
                          color: marketFilter === f.key ? "var(--text-1)" : "var(--text-muted)",
                          fontWeight: marketFilter === f.key ? "700" : "500",
                          fontSize: "12px",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          fontFamily: "Inter, Arial, sans-serif",
                          boxShadow: marketFilter === f.key ? "0 1px 4px rgba(0,0,0,0.18)" : "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {/* Filtro fase */}
                  <div style={{ display: "flex", gap: "4px", background: "var(--inner-bg)", borderRadius: "14px", padding: "4px" }}>
                    {filterOptions.map(f => (
                      <button
                        key={f.key}
                        onClick={() => setDashboardFilter(f.key)}
                        style={{
                          padding: "7px 14px",
                          borderRadius: "10px",
                          border: "none",
                          background: dashboardFilter === f.key ? "var(--card-bg)" : "transparent",
                          color: dashboardFilter === f.key ? "var(--text-1)" : "var(--text-muted)",
                          fontWeight: dashboardFilter === f.key ? "700" : "500",
                          fontSize: "12px",
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

        {/* ─── REVIEW: CUENTAS ─── */}
        {activePage === "REVIEW_ACCOUNTS" && (
          <AccountsPanel
            accounts={reviewAccounts}
            trades={reviewTrades}
            onCreateAccount={reviewCreateAccount}
            onDeleteAccount={reviewDeleteAccount}
            onUpdateAccount={reviewUpdateAccount}
            onReplaceAccountTrades={reviewReplaceAccountTrades}
            onAppendAccountTrades={reviewAppendAccountTrades}
            showPct={showPct}
          />
        )}

        {/* ─── REVIEW: TRADES ─── */}
        {activePage === "REVIEW_TRADES" && (() => {
          const reviewActiveAccount = selectedReviewAccountId
            ? reviewAccounts.find((a) => String(a.id) === selectedReviewAccountId)
            : null
          const displayedReviewTrades = reviewActiveAccount
            ? reviewTrades.filter((t) => t.account === reviewActiveAccount.name)
            : reviewTrades
          const reviewAccountSizeMap = Object.fromEntries(reviewAccounts.map((a) => [a.name, parseAccountSize(a.size)]))
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
                    Revisión · Registro
                  </p>
                  <h1 style={{ margin: "8px 0 4px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
                    Trades
                  </h1>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>Operaciones de revisión y backtesting</p>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
                  {displayedReviewTrades.length > 0 && (
                    <button
                      onClick={() => reviewClearAllTrades(reviewActiveAccount?.name)}
                      style={{ padding: "11px 18px", borderRadius: "12px", border: "1px solid rgba(248,113,113,0.28)", background: "rgba(248,113,113,0.08)", color: "#f87171", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                    >
                      {reviewActiveAccount ? `Limpiar "${reviewActiveAccount.name}"` : "Limpiar historial"}
                    </button>
                  )}
                  <button
                    onClick={() => { resetReviewForm(); setShowReviewTradeForm(true) }}
                    style={{ padding: "11px 18px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #a855f7, #7c3aed)", color: "#fff", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                  >
                    + Nuevo trade
                  </button>
                </div>
              </div>
              {(showReviewTradeForm || isReviewEditing) && (
                <TradeForm
                  form={reviewForm}
                  setForm={setReviewForm}
                  onAddTrade={handleReviewAddTrade}
                  isEditing={isReviewEditing}
                  accounts={reviewAccounts}
                  strategies={reviewStrategies}
                  onCancel={() => { resetReviewForm(); setShowReviewTradeForm(false) }}
                  isReview={true}
                />
              )}
              <TradeList
                trades={displayedReviewTrades}
                onEditTrade={editReviewTrade}
                onDeleteTrade={reviewDeleteTrade}
                onDeleteManyTrades={reviewDeleteManyTrades}
                activeAccountName={reviewActiveAccount ? reviewActiveAccount.name : null}
                showPct={showPct}
                accountSizeMap={reviewAccountSizeMap}
                isReview={true}
              />
            </div>
          )
        })()}

        {/* ─── REVIEW: MÉTRICAS ─── */}
        {activePage === "REVIEW_METRICS" && (() => {
          const reviewActiveAccount = selectedReviewAccountId ? reviewAccounts.find((a) => String(a.id) === selectedReviewAccountId) : null
          const baseTrades = reviewActiveAccount ? reviewTrades.filter((t) => t.account === reviewActiveAccount.name) : reviewTrades
          const metricsAccountOptions = [...new Set(baseTrades.map((t) => t.account).filter(Boolean))]
          const toggleMetricsAccount = (name) =>
            setReviewMetricsFilterAccounts((prev) =>
              prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
            )
          const displayedReviewTrades = reviewMetricsFilterAccounts.length === 0
            ? baseTrades
            : baseTrades.filter((t) => reviewMetricsFilterAccounts.includes(t.account))
          const reviewAccountSizeMap = Object.fromEntries(reviewAccounts.map((a) => [a.name, parseAccountSize(a.size)]))
          const reviewAccountsWithTrades = reviewMetricsFilterAccounts.length > 0
            ? reviewAccounts.filter((a) => reviewMetricsFilterAccounts.includes(a.name))
            : reviewActiveAccount ? [reviewActiveAccount] : reviewAccounts.filter((a) => reviewTrades.some((t) => t.account === a.name))
          const reviewBaseCapital = reviewAccountsWithTrades.length === 1
            ? parseAccountSize(reviewAccountsWithTrades[0].size)
            : reviewAccountsWithTrades.reduce((sum, a) => sum + parseAccountSize(a.size), 0)
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>Revisión · Análisis</p>
                  <h1 style={{ margin: "8px 0 4px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>Métricas</h1>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>Métricas de tus operaciones de revisión</p>
                </div>
                {metricsAccountOptions.length > 1 && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", paddingTop: "10px" }}>
                    <button
                      onClick={() => setReviewMetricsFilterAccounts([])}
                      style={{
                        padding: "5px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", cursor: "pointer", border: "1px solid",
                        background: reviewMetricsFilterAccounts.length === 0 ? "rgba(168,85,247,0.18)" : "transparent",
                        borderColor: reviewMetricsFilterAccounts.length === 0 ? "rgba(168,85,247,0.5)" : "var(--border-card)",
                        color: reviewMetricsFilterAccounts.length === 0 ? "#a855f7" : "var(--text-muted)",
                        transition: "all 0.15s",
                      }}
                    >
                      Todas
                    </button>
                    {metricsAccountOptions.map((name) => {
                      const active = reviewMetricsFilterAccounts.includes(name)
                      return (
                        <button
                          key={name}
                          onClick={() => toggleMetricsAccount(name)}
                          style={{
                            padding: "5px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", cursor: "pointer", border: "1px solid",
                            background: active ? "rgba(16,185,129,0.15)" : "transparent",
                            borderColor: active ? "rgba(16,185,129,0.45)" : "var(--border-card)",
                            color: active ? "#10b981" : "var(--text-muted)",
                            transition: "all 0.15s",
                          }}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <MetricsPanel trades={displayedReviewTrades} showPct={showPct} baseCapital={reviewBaseCapital} accountSizeMap={reviewAccountSizeMap} />
            </div>
          )
        })()}

        {/* ─── REVIEW: CALENDARIO ─── */}
        {activePage === "REVIEW_CALENDAR" && (() => {
          const reviewActiveAccount = selectedReviewAccountId ? reviewAccounts.find((a) => String(a.id) === selectedReviewAccountId) : null
          const baseReviewTrades = reviewActiveAccount ? reviewTrades.filter((t) => t.account === reviewActiveAccount.name) : reviewTrades
          const displayedReviewTrades = reviewCalendarFilterAccounts.length === 0
            ? baseReviewTrades
            : baseReviewTrades.filter((t) => reviewCalendarFilterAccounts.includes(t.account))
          const reviewAccountSizeMap = Object.fromEntries(reviewAccounts.map((a) => [a.name, parseAccountSize(a.size)]))
          const calendarAccountOptions = [...new Set(baseReviewTrades.map((t) => t.account).filter(Boolean))]
          const toggleCalendarAccount = (name) => {
            setReviewCalendarFilterAccounts((prev) =>
              prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
            )
          }

          // Stats por cuenta para el mes visible
          const { year: calYear, month: calMonth } = reviewCalendarMonth
          const monthName = new Date(calYear, calMonth, 1).toLocaleString("es-ES", { month: "long", year: "numeric" })
          const tradesInMonth = displayedReviewTrades.filter((t) => {
            if (!t.date) return false
            const [y, m] = t.date.split("-").map(Number)
            return y === calYear && m - 1 === calMonth
          })
          const accountNames = [...new Set(tradesInMonth.map((t) => t.account).filter(Boolean))]

          // Helper: lunes de la semana de una fecha
          const getWeekMonday = (dateStr) => {
            const [y, m, d] = dateStr.split("-").map(Number)
            const date = new Date(y, m - 1, d)
            const day = date.getDay()
            const diff = day === 0 ? -6 : 1 - day
            return new Date(y, m - 1, d + diff)
          }
          const fmtWeekRange = (monday) => {
            const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
            const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]
            const sd = monday.getDate(), ed = sunday.getDate()
            return monday.getMonth() === sunday.getMonth()
              ? `${sd} – ${ed} ${meses[monday.getMonth()]}`
              : `${sd} ${meses[monday.getMonth()]} – ${ed} ${meses[sunday.getMonth()]}`
          }

          // Agrupar por semana
          const weekMap = {}
          for (const t of tradesInMonth) {
            if (!t.date) continue
            const monday = getWeekMonday(t.date)
            const wk = monday.toISOString().slice(0, 10)
            if (!weekMap[wk]) weekMap[wk] = { monday, accounts: {} }
            const acct = t.account || "Sin cuenta"
            if (!weekMap[wk].accounts[acct]) weekMap[wk].accounts[acct] = { total: 0, count: 0, wins: 0 }
            const p = Number(t.profit || 0)
            weekMap[wk].accounts[acct].total += p
            weekMap[wk].accounts[acct].count++
            if (p > 0) weekMap[wk].accounts[acct].wins++
          }
          const weekKeys = Object.keys(weekMap).sort()

          // Totales por cuenta
          const accountStats = accountNames.map((name) => {
            const ts = tradesInMonth.filter((t) => t.account === name)
            const total = ts.reduce((s, t) => s + Number(t.profit || 0), 0)
            const wins = ts.filter((t) => Number(t.profit) > 0).length
            return { name, total, wins, count: ts.length, winRate: ts.length > 0 ? (wins / ts.length) * 100 : 0 }
          })

          const reviewAccountsWithTrades = reviewActiveAccount ? [reviewActiveAccount] : reviewAccounts.filter((a) => displayedReviewTrades.some((t) => t.account === a.name))
          const reviewBaseCapital = reviewAccountsWithTrades.length === 1
            ? parseAccountSize(reviewAccountsWithTrades[0].size)
            : reviewAccountsWithTrades.reduce((sum, a) => sum + parseAccountSize(a.size), 0)
          const reviewTotalProfit = displayedReviewTrades.reduce((s, t) => s + Number(t.profit || 0), 0)
          const reviewEquityLabel = `${reviewTotalProfit >= 0 ? "+" : ""}$${reviewTotalProfit.toFixed(2)}`
          const reviewEquityColor = reviewTotalProfit >= 0 ? "#10b981" : "#f87171"

          return (
            <div style={{ display: "grid", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>Revisión · Calendario</p>
                  <h1 style={{ margin: "8px 0 4px", fontSize: "34px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>Calendario</h1>
                </div>
                {calendarAccountOptions.length > 1 && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", paddingBottom: "6px" }}>
                    <button
                      onClick={() => setReviewCalendarFilterAccounts([])}
                      style={{
                        padding: "5px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", cursor: "pointer", border: "1px solid",
                        background: reviewCalendarFilterAccounts.length === 0 ? "rgba(168,85,247,0.18)" : "transparent",
                        borderColor: reviewCalendarFilterAccounts.length === 0 ? "rgba(168,85,247,0.5)" : "var(--border-card)",
                        color: reviewCalendarFilterAccounts.length === 0 ? "#a855f7" : "var(--text-muted)",
                        transition: "all 0.15s",
                      }}
                    >
                      Todas
                    </button>
                    {calendarAccountOptions.map((name) => {
                      const active = reviewCalendarFilterAccounts.includes(name)
                      return (
                        <button
                          key={name}
                          onClick={() => toggleCalendarAccount(name)}
                          style={{
                            padding: "5px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", cursor: "pointer", border: "1px solid",
                            background: active ? "rgba(16,185,129,0.15)" : "transparent",
                            borderColor: active ? "rgba(16,185,129,0.45)" : "var(--border-card)",
                            color: active ? "#10b981" : "var(--text-muted)",
                            transition: "all 0.15s",
                          }}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Métricas de revisión */}
              {displayedReviewTrades.length > 0 && (
                <>
                  <Statistics trades={displayedReviewTrades} showPct={showPct} baseCapital={reviewBaseCapital} accountSizeMap={reviewAccountSizeMap} />
                  <div style={{ background: "var(--card-bg)", borderRadius: "20px", padding: "20px 22px", border: "1px solid var(--border-card)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em" }}>Rendimiento acumulado · Revisión</div>
                        <h3 style={{ margin: "3px 0 0", color: "var(--text-1)", fontSize: "15px", fontWeight: "700" }}>Curva de Equity</h3>
                      </div>
                      <span style={{ color: reviewEquityColor, fontWeight: "800", fontSize: "22px", letterSpacing: "-0.02em" }}>{reviewEquityLabel}</span>
                    </div>
                    <div style={{ height: "220px", display: "flex", flexDirection: "column" }}>
                      <EquityCurve trades={displayedReviewTrades} showPct={showPct} baseCapital={reviewBaseCapital} accountSizeMap={reviewAccountSizeMap} />
                    </div>
                  </div>
                </>
              )}

              <CalendarPanel
                trades={displayedReviewTrades}
                showPct={showPct}
                accountSizeMap={reviewAccountSizeMap}
                isMobile={isMobile}
                onMonthChange={setReviewCalendarMonth}
              />

              {/* Resumen semanal + total por cuenta */}
              {accountNames.length > 0 && weekKeys.length > 0 && (
                <div style={{ background: "var(--card-bg)", borderRadius: "20px", border: "1px solid rgba(168,85,247,0.2)", overflow: "hidden" }}>
                  {/* Título */}
                  <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid rgba(168,85,247,0.1)" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "4px" }}>Revisión · Desglose mensual</div>
                    <div style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-1)" }}>{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</div>
                  </div>

                  {/* Tabla */}
                  <div style={{ overflowX: "auto" }}>
                    {/* Header de cuentas */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: `180px repeat(${accountNames.length}, 1fr)`,
                      padding: "12px 28px",
                      borderBottom: "1px solid rgba(148,163,184,0.07)",
                      background: "rgba(168,85,247,0.03)",
                    }}>
                      <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em" }}>Semana</div>
                      {accountNames.map((name) => (
                        <div key={name} style={{ fontSize: "12px", fontWeight: "700", color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.08em" }}>{name}</div>
                      ))}
                    </div>

                    {/* Filas por semana */}
                    {weekKeys.map((wk) => (
                      <div key={wk} style={{
                        display: "grid",
                        gridTemplateColumns: `180px repeat(${accountNames.length}, 1fr)`,
                        padding: "18px 28px",
                        borderBottom: "1px solid rgba(148,163,184,0.05)",
                        alignItems: "center",
                      }}>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600" }}>
                          {fmtWeekRange(weekMap[wk].monday)}
                        </div>
                        {accountNames.map((name) => {
                          const s = weekMap[wk].accounts[name]
                          if (!s) return <div key={name} style={{ color: "rgba(148,163,184,0.25)", fontSize: "16px" }}>—</div>
                          const wr = s.count > 0 ? (s.wins / s.count) * 100 : 0
                          return (
                            <div key={name}>
                              <div style={{ fontSize: "18px", fontWeight: "800", color: s.total >= 0 ? "#10b981" : "#f87171", letterSpacing: "-0.01em" }}>
                                {s.total >= 0 ? "+" : ""}${Math.abs(s.total).toFixed(0)}
                              </div>
                              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                                {s.count} trade{s.count !== 1 ? "s" : ""} · <span style={{ color: wr >= 50 ? "#10b981" : "#f87171", fontWeight: "600" }}>{wr.toFixed(0)}% WR</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}

                    {/* Fila total del mes */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: `180px repeat(${accountNames.length}, 1fr)`,
                      padding: "20px 28px",
                      borderTop: "1px solid rgba(168,85,247,0.2)",
                      background: "rgba(168,85,247,0.05)",
                      alignItems: "center",
                    }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.1em" }}>Total mes</div>
                      {accountStats.map(({ name, total, count, winRate }) => (
                        <div key={name}>
                          <div style={{ fontSize: "22px", fontWeight: "800", color: total >= 0 ? "#10b981" : "#f87171", letterSpacing: "-0.02em" }}>
                            {total >= 0 ? "+" : ""}${Math.abs(total).toFixed(0)}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                            {count} trade{count !== 1 ? "s" : ""} · <span style={{ color: winRate >= 50 ? "#10b981" : "#f87171", fontWeight: "600" }}>{winRate.toFixed(0)}% WR</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ─── REVIEW: COMPARATIVA ─── */}
        {activePage === "REVIEW_COMPARATIVE" && (
          <ReviewComparative
            trades={trades}
            reviewTrades={reviewTrades}
          />
        )}

        {/* ─── REVIEW: ESTRATEGIAS ─── */}
        {activePage === "REVIEW_STRATEGIES" && (
          <StrategiesPanel
            strategies={reviewStrategies}
            onCreateStrategy={reviewCreateStrategy}
            onDeleteStrategy={reviewDeleteStrategy}
          />
        )}

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
