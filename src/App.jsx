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
  const [activePage, setActivePage] = useState("DASHBOARD")
  const [isEditing, setIsEditing] = useState(false)
  const [showTradeForm, setShowTradeForm] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark")
  const [showPct, setShowPct] = useState(false)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState(defaultForm)

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
    addTrade, deleteTrade, clearAllTrades, importTrades, replaceAccountTrades,
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
        showPct={showPct}
        onTogglePct={(val) => setShowPct(val)}
      />

      <main style={{ flex: 1, padding: "32px 40px 60px", overflowY: "auto", minWidth: 0, background: "var(--app-bg)" }}>

        {/* ─── ADMIN ─── */}
        {activePage === "ADMIN" && profile.is_admin && <AdminPanel />}

        {/* ─── CONNECT MT5 ─── */}
        {activePage === "CONNECT_MT5" && <ConnectMT5Panel accounts={accounts} />}

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
          const totalPct = showPct
            ? displayedTrades.reduce((s, t) => {
                const size = accountSizeMap[t.account] || baseCapital
                return size > 0 ? s + (Number(t.profit || 0) / size) * 100 : s
              }, 0)
            : null
          const equityLabel = showPct && totalPct !== null
            ? `${totalPct >= 0 ? "+" : ""}${totalPct.toFixed(2)}%`
            : `${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(2)}`
          const equityColor = totalProfit >= 0 ? "#10b981" : "#f87171"

          return (
            <>
              {/* ── Header ── */}
              <div style={{ marginBottom: "0" }}>
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

              {/* ── Statistics ── */}
              <Statistics trades={displayedTrades} showPct={showPct} baseCapital={baseCapital} accountSizeMap={accountSizeMap} />

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
                  <EquityCurve trades={displayedTrades} showPct={showPct} baseCapital={baseCapital} accountSizeMap={accountSizeMap} />
                </div>
              </div>

              {/* ── Calendario + Trades recientes ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "16px", marginTop: "16px" }}>
                <CalendarPanel trades={displayedTrades} showPct={showPct} accountSizeMap={accountSizeMap} />
                <RecentTradesWidget trades={displayedTrades} onNavigate={setActivePage} showPct={showPct} accountSizeMap={accountSizeMap} />
              </div>

              {/* ── ROI + Retiros ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
                <AccountROIWidget accounts={accounts} withdrawals={displayedWithdrawals} onNavigate={setActivePage} />
                <LastWithdrawalsWidget withdrawals={displayedWithdrawals} onNavigate={setActivePage} />
              </div>
            </>
          )
        })()}
      </main>

      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
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
