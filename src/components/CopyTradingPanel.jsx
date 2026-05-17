import { useState, useEffect, useRef, Fragment } from "react"
import { supabase } from "../lib/supabase"
import { showConfirm } from "../lib/confirm"

const RISK_TYPES = [
  { value: "multiplier",    label: "Multiplicador fijo de lotes" },
  { value: "balance_ratio", label: "Ratio por balance de cuenta" },
  { value: "fixed_lots",    label: "Lotes fijos" },
]

const RISK_SHORT = {
  multiplier:    "Mult. fijo",
  balance_ratio: "Ratio bal.",
  fixed_lots:    "Lotes fijos",
}

const defaultForm = {
  master_name:      "",
  slave_selections: [],
  risk_type:        "multiplier",
  symbol_suffix:    "",
  copy_existing:    false,
}

const defaultEditForm = {
  master_name:   "",
  slave_name:    "",
  slave_number:  "",
  risk_type:     "multiplier",
  multiplier:    1.0,
  symbol_suffix: "",
  copy_existing: false,
}

const defaultAccountForm = { account_number: "", server: "", type: "master" }

function Toggle({ on, onChange }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: "38px", height: "20px", borderRadius: "10px", cursor: "pointer",
        background: on ? "#10b981" : "rgba(148,163,184,0.15)",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
        border: on ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(148,163,184,0.1)",
      }}
    >
      <div style={{
        position: "absolute", top: "2px",
        left: on ? "18px" : "2px",
        width: "14px", height: "14px", borderRadius: "50%",
        background: on ? "#fff" : "rgba(148,163,184,0.4)",
        transition: "left 0.18s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
      }} />
    </div>
  )
}

const inputSt = {
  background: "var(--inner-bg)",
  border: "1px solid var(--border-input)",
  color: "var(--text-1)",
  padding: "8px 12px",
  borderRadius: "8px",
  fontSize: "13px",
  outline: "none",
  fontFamily: "Inter, Arial, sans-serif",
  width: "100%",
  boxSizing: "border-box",
}

const thSt = {
  padding: "9px 16px",
  fontSize: "10px",
  fontWeight: "600",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.09em",
  textAlign: "left",
  borderBottom: "1px solid var(--border-sub)",
  background: "var(--inner-bg)",
  whiteSpace: "nowrap",
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "5px" }}>
      {children}
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handle = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handle}
      title="Copiar número"
      style={{
        background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
        color: copied ? "#10b981" : "var(--text-muted)", flexShrink: 0,
        display: "flex", alignItems: "center", opacity: copied ? 1 : 0.5,
        transition: "color 0.2s, opacity 0.2s",
      }}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )}
    </button>
  )
}

function ErrorBanner({ msg, onClose }) {
  if (!msg) return null
  return (
    <div style={{
      padding: "9px 14px", borderRadius: "8px",
      background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
      color: "#f87171", fontSize: "12px", fontWeight: "500",
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px",
    }}>
      <span>⚠ {msg}</span>
      {onClose && (
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "15px", lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
      )}
    </div>
  )
}

function AccountAvatar({ name, type }) {
  const isMaster = type === "master"
  const letter = name ? name.charAt(0).toUpperCase() : "?"
  return (
    <div style={{
      width: "28px", height: "28px", borderRadius: "7px", flexShrink: 0,
      background: isMaster ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(59,130,246,0.12)",
      display: "grid", placeItems: "center",
      fontSize: "11px", fontWeight: "800",
      color: isMaster ? "#fff" : "#60a5fa",
    }}>
      {letter}
    </div>
  )
}

export function CopyTradingPanel({ accounts, userId }) {
  const [copiers, setCopiers]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [showForm, setShowForm]           = useState(false)
  const [form, setForm]                   = useState(defaultForm)
  const [saving, setSaving]               = useState(false)
  const [deleting, setDeleting]           = useState(null)
  const [activeSignals, setActiveSignals] = useState({})
  const [balances, setBalances]           = useState({})
  const [expanded, setExpanded]           = useState(new Set())
  const [editingId, setEditingId]         = useState(null)
  const [editForm, setEditForm]           = useState(defaultEditForm)
  const [activeTab, setActiveTab]         = useState("all")
  const [pausingAll, setPausingAll]       = useState(false)
  const [createError, setCreateError]     = useState("")
  const [updateError, setUpdateError]     = useState("")
  const [canEdit, setCanEdit]             = useState(false)

  // Cuentas MT5
  const [copyAccounts, setCopyAccounts]         = useState([])
  const [showAccountForm, setShowAccountForm]   = useState(false)
  const [accountForm, setAccountForm]           = useState(defaultAccountForm)
  const [savingAccount, setSavingAccount]       = useState(false)
  const [deletingAccount, setDeletingAccount]   = useState(null)
  const [accountsCollapsed, setAccountsCollapsed] = useState(false)
  const [accountError, setAccountError]         = useState("")
  const [editingAccountId, setEditingAccountId] = useState(null)
  const [editingAccountName, setEditingAccountName] = useState("")

  // Ref para evitar closure stale en el canal realtime
  const copiersRef = useRef([])
  useEffect(() => { copiersRef.current = copiers }, [copiers])

  useEffect(() => {
    checkEditorStatus()
    loadCopiers()
    loadCopyAccounts()
    loadBalances()
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`copy_signals_rt_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "copy_signals" },
        () => { loadActiveSignals(copiersRef.current) }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "copy_balances" },
        () => { loadBalances() }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const loadBalances = async () => {
    if (!userId) return
    const { data } = await supabase.from("copy_balances").select("*")
    if (!data) return
    const ownedNames = new Set(copyAccounts.map((a) => a.name))
    const map = {}
    data.forEach((b) => {
      if (ownedNames.size === 0 || ownedNames.has(b.account_name)) map[b.account_name] = b
    })
    setBalances(map)
  }

  const loadCopyAccounts = async () => {
    if (!userId) return
    const { data } = await supabase
      .from("copy_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
    if (data) setCopyAccounts(data)
  }

  const handleCreateAccount = async () => {
    const acctNum = accountForm.account_number.trim()
    const server  = accountForm.server.trim()

    if (!acctNum) { setAccountError("El número de cuenta es obligatorio."); return }
    if (!/^\d+$/.test(acctNum)) { setAccountError("El número de cuenta debe contener solo dígitos."); return }
    if (acctNum.length < 4 || acctNum.length > 15) { setAccountError("El número de cuenta debe tener entre 4 y 15 dígitos."); return }
    if (!server)  { setAccountError("El servidor es obligatorio."); return }

    const duplicate = copyAccounts.some((a) => a.name === acctNum && a.server === server)
    if (duplicate) {
      setAccountError("Ya existe una cuenta con ese número en ese servidor.")
      return
    }

    setAccountError("")
    setSavingAccount(true)
    const { error } = await supabase.from("copy_accounts").insert({
      user_id: userId,
      name:    acctNum,
      type:    accountForm.type,
      server:  server,
    })
    if (!error) {
      setAccountForm(defaultAccountForm)
      setShowAccountForm(false)
      await loadCopyAccounts()
    } else {
      console.error("copy_accounts insert error:", error)
      setAccountError(
        error.code === "42P01"
          ? "La tabla copy_accounts no existe. Ejecutá el SQL indicado primero."
          : error.message || "Error al guardar la cuenta."
      )
    }
    setSavingAccount(false)
  }

  const handleSaveAccountName = async (id) => {
    const trimmed = editingAccountName.trim()
    if (!trimmed) return
    // FIX: validar nombre duplicado al editar
    const nameExists = copyAccounts.some(
      (a) => a.id !== id && a.name.toLowerCase() === trimmed.toLowerCase()
    )
    if (nameExists) {
      setAccountError("Ya existe una cuenta con ese nombre.")
      return
    }
    setAccountError("")
    setSavingAccount(true)
    const { error } = await supabase.from("copy_accounts").update({ name: trimmed }).eq("id", id)
    if (!error) {
      setCopyAccounts((prev) => prev.map((a) => a.id === id ? { ...a, name: trimmed } : a))
      setEditingAccountId(null)
    } else {
      setAccountError("Error al guardar el nombre.")
    }
    setSavingAccount(false)
  }

  const handleDeleteAccount = async (id) => {
    // FIX: avisar si tiene copiadores activos
    const acc = copyAccounts.find((a) => a.id === id)
    if (acc) {
      const usados = copiers.filter((c) => c.master_name === acc.name || c.slave_name === acc.name)
      if (usados.length > 0) {
        const ok = await showConfirm(
          `"${acc.name}" está siendo usada en ${usados.length} copiador${usados.length > 1 ? "es" : ""}. ¿Eliminar la cuenta igual? Los copiadores NO se borrarán.`,
          { title: "Eliminar cuenta", confirmLabel: "Eliminar", danger: true }
        )
        if (!ok) return
      } else {
        if (!await showConfirm(`¿Eliminar la cuenta "${acc.name}"?`, { title: "Eliminar cuenta", confirmLabel: "Eliminar", danger: true })) return
      }
    }
    setDeletingAccount(id)
    const { error } = await supabase.from("copy_accounts").delete().eq("id", id)
    // FIX: solo actualiza UI si el delete fue exitoso
    if (!error) {
      setCopyAccounts((prev) => prev.filter((a) => a.id !== id))
    } else {
      setAccountError("Error al eliminar la cuenta. Intentá de nuevo.")
    }
    setDeletingAccount(null)
  }

  const checkEditorStatus = async () => {
    if (!userId) return
    const { data } = await supabase
      .from("copy_editors")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()
    setCanEdit(!!data)
  }

  const loadCopiers = async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from("copy_copiers")
      .select("*")
      .order("created_at", { ascending: false })
    if (data) {
      setCopiers(data)
      loadActiveSignals(data)
    }
    setLoading(false)
  }

  const loadActiveSignals = async (copiersList) => {
    const names = copiersList.map((c) => c.master_name)
    if (!names.length) return
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from("copy_signals")
      .select("*")
      .in("master_name", names)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
    if (!data) return
    const closes = new Set(
      data.filter((s) => s.signal_type === "CLOSE").map((s) => s.master_ticket)
    )
    const active = data.filter(
      (s) => s.signal_type === "OPEN" && !closes.has(s.master_ticket)
    )
    const grouped = {}
    active.forEach((s) => {
      if (!grouped[s.master_name]) grouped[s.master_name] = []
      grouped[s.master_name].push(s)
    })
    setActiveSignals(grouped)
  }

  const toggleSlaveSelection = (name) => {
    setForm((f) => {
      const exists = f.slave_selections.find((s) => s.name === name)
      if (exists) {
        return { ...f, slave_selections: f.slave_selections.filter((s) => s.name !== name) }
      }
      if (f.slave_selections.length >= 40) {
        alert("Máximo 40 cuentas esclavas por copiador.")
        return f
      }
      return { ...f, slave_selections: [...f.slave_selections, { name, multiplier: 1.0 }] }
    })
  }

  const updateSlaveMultiplier = (name, value) => {
    setForm((f) => ({
      ...f,
      slave_selections: f.slave_selections.map((s) =>
        s.name === name ? { ...s, multiplier: value } : s
      ),
    }))
  }

  const handleCreate = async () => {
    if (!form.master_name || form.slave_selections.length === 0) return
    // FIX: validar combinaciones duplicadas
    const duplicates = form.slave_selections.filter(({ name }) =>
      copiers.some((c) => c.master_name === form.master_name && c.slave_name === name)
    )
    if (duplicates.length > 0) {
      setCreateError(
        `Ya existe un copiador para: ${duplicates.map((d) => d.name).join(", ")}. Deseleccionálos antes de continuar.`
      )
      return
    }
    setCreateError("")
    setSaving(true)
    const inserts = form.slave_selections.map(({ name, multiplier }) => ({
      user_id:       userId,
      master_name:   form.master_name,
      slave_name:    name,
      slave_number:  "",
      risk_type:     form.risk_type,
      multiplier:    Math.max(0.01, Number(multiplier) || 1.0),
      symbol_suffix: form.symbol_suffix.trim(),
      copy_existing: form.copy_existing,
      is_active:     true,
    }))
    const { error } = await supabase.from("copy_copiers").insert(inserts)
    if (!error) {
      setForm(defaultForm)
      setShowForm(false)
      await loadCopiers()
    } else {
      setCreateError(error.message || "Error al crear el copiador. Intentá de nuevo.")
    }
    setSaving(false)
  }

  // FIX: pausar todos correctamente con Promise.all y feedback de error
  const pauseAll = async () => {
    const activos = copiers.filter((c) => c.is_active)
    if (!activos.length) return
    if (!await showConfirm(`¿Pausar todos los copiadores activos (${activos.length})? Dejarán de copiar trades hasta que los reactives.`, { title: "Pausar copiadores", confirmLabel: "Pausar todo", danger: true })) return
    setPausingAll(true)
    setCopiers((prev) => prev.map((c) => ({ ...c, is_active: false })))
    const results = await Promise.all(
      activos.map((c) => supabase.from("copy_copiers").update({ is_active: false }).eq("id", c.id))
    )
    if (results.some((r) => r.error)) {
      await loadCopiers()
    }
    setPausingAll(false)
  }

  const toggleActive = async (copier) => {
    const newVal = !copier.is_active
    setCopiers((prev) => prev.map((c) => c.id === copier.id ? { ...c, is_active: newVal } : c))
    const { error } = await supabase.from("copy_copiers").update({ is_active: newVal }).eq("id", copier.id)
    if (error) {
      setCopiers((prev) => prev.map((c) => c.id === copier.id ? { ...c, is_active: !newVal } : c))
    }
  }

  const startEdit = (copier) => {
    setEditingId(copier.id)
    setUpdateError("")
    setEditForm({
      master_name:   copier.master_name,
      slave_name:    copier.slave_name,
      slave_number:  copier.slave_number || "",
      risk_type:     copier.risk_type,
      multiplier:    copier.multiplier,
      symbol_suffix: copier.symbol_suffix || "",
      copy_existing: copier.copy_existing,
    })
  }

  const handleUpdate = async () => {
    if (!editForm.master_name || !editForm.slave_name) return
    // FIX: validar combinación duplicada al editar (excluyendo el registro actual)
    const isDuplicate = copiers.some(
      (c) => c.id !== editingId &&
             c.master_name === editForm.master_name.trim() &&
             c.slave_name  === editForm.slave_name.trim()
    )
    if (isDuplicate) {
      setUpdateError("Ya existe un copiador con esa combinación maestra → esclava.")
      return
    }
    setUpdateError("")
    setSaving(true)
    const { error } = await supabase.from("copy_copiers").update({
      master_name:   editForm.master_name.trim(),
      slave_name:    editForm.slave_name.trim(),
      slave_number:  editForm.slave_number.trim(),
      risk_type:     editForm.risk_type,
      multiplier:    Math.max(0.01, Number(editForm.multiplier) || 1.0),
      symbol_suffix: editForm.symbol_suffix.trim(),
      copy_existing: editForm.copy_existing,
    }).eq("id", editingId)
    if (!error) {
      setEditingId(null)
      await loadCopiers()
    } else {
      setUpdateError(error.message || "Error al guardar. Intentá de nuevo.")
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!await showConfirm("¿Eliminar este copiador?", { title: "Eliminar copiador", confirmLabel: "Eliminar", danger: true })) return
    setDeleting(id)
    const { error } = await supabase.from("copy_copiers").delete().eq("id", id)
    // FIX: solo actualiza UI si el delete fue exitoso
    if (!error) {
      setCopiers((prev) => prev.filter((c) => c.id !== id))
    } else {
      alert("Error al eliminar el copiador. Intentá de nuevo.")
    }
    setDeleting(null)
  }

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const masterAccounts = copyAccounts.filter((a) => a.type === "master")
  const slaveAccounts  = copyAccounts.filter((a) => a.type === "slave")

  const filteredCopiers = copiers.filter((c) => {
    if (activeTab === "active") return c.is_active
    if (activeTab === "paused") return !c.is_active
    return true
  })

  const activeCount = copiers.filter((c) => c.is_active).length
  const pausedCount = copiers.filter((c) => !c.is_active).length

  // FIX: formato consistente del multiplicador
  const multValue = (copier) => {
    const val = Number(copier.multiplier)
    return copier.risk_type === "fixed_lots"
      ? `${val % 1 === 0 ? val.toFixed(2) : val} lots`
      : `×${val % 1 === 0 ? val.toFixed(2) : val}`
  }

  const canCreate = form.master_name && form.slave_selections.length > 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <p style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "10px" }}>
            Automatización
          </p>
          <h1 style={{ margin: "6px 0 4px", fontSize: "32px", fontWeight: "800", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            Copiadores
          </h1>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px" }}>
            Copia operaciones en tiempo real desde cuentas maestras a cuentas esclavas.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {!canEdit && (
            <span style={{
              fontSize: "11px", fontWeight: "600", padding: "5px 10px", borderRadius: "6px",
              background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.15)",
              color: "var(--text-muted)",
            }}>
              Solo lectura
            </span>
          )}
          {canEdit && activeCount > 0 && (
            <button
              onClick={pauseAll}
              disabled={pausingAll}
              style={{
                padding: "9px 16px", borderRadius: "8px",
                border: "1px solid rgba(248,113,113,0.22)",
                background: "rgba(248,113,113,0.06)",
                color: "#f87171", fontWeight: "600", fontSize: "12px",
                cursor: pausingAll ? "not-allowed" : "pointer",
                opacity: pausingAll ? 0.6 : 1,
              }}
            >
              {pausingAll ? "Pausando..." : "Pausar todos"}
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: "9px 18px", borderRadius: "8px", border: "none",
                background: "linear-gradient(135deg,#10b981,#059669)",
                color: "#fff", fontWeight: "700", fontSize: "13px", cursor: "pointer",
              }}
            >
              + Nuevo copiador
            </button>
          )}
        </div>
      </div>

      {/* ── Cuentas MT5 ── */}
      <div style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-card)",
        borderRadius: "16px", overflow: "hidden",
      }}>
        <div style={{
          padding: "14px 20px",
          borderBottom: accountsCollapsed ? "none" : "1px solid var(--border-sub)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "var(--inner-bg)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => setAccountsCollapsed((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "0", display: "flex", alignItems: "center" }}
            >
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"
                style={{ transition: "transform 0.2s", transform: accountsCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-1)" }}>Cuentas MT5</span>
            <span style={{
              fontSize: "10px", fontWeight: "700", padding: "1px 7px", borderRadius: "10px",
              background: "rgba(16,185,129,0.09)", color: "#10b981",
            }}>
              {masterAccounts.length} maestras · {slaveAccounts.length} esclavas
            </span>
          </div>
          {canEdit && (
            <button
              onClick={() => { setShowAccountForm(true); setAccountsCollapsed(false); setAccountError("") }}
              style={{
                padding: "6px 13px", borderRadius: "7px", border: "none",
                background: "linear-gradient(135deg,#10b981,#059669)",
                color: "#fff", fontWeight: "700", fontSize: "12px", cursor: "pointer",
              }}
            >
              + Agregar cuenta
            </button>
          )}
        </div>

        {!accountsCollapsed && (
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Formulario inline de nueva cuenta */}
            {showAccountForm && (
              <div style={{
                padding: "14px 16px", borderRadius: "10px",
                border: "1px solid rgba(16,185,129,0.2)",
                background: "rgba(16,185,129,0.03)",
                display: "flex", flexDirection: "column", gap: "10px",
              }}>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <div style={{ minWidth: "140px" }}>
                    <FieldLabel>Número de cuenta</FieldLabel>
                    <input
                      value={accountForm.account_number}
                      onChange={(e) => setAccountForm((f) => ({ ...f, account_number: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateAccount()}
                      placeholder="Ej: 135496"
                      inputMode="numeric"
                      style={inputSt}
                      autoFocus
                    />
                  </div>
                  <div style={{ flex: "1", minWidth: "160px" }}>
                    <FieldLabel>Servidor</FieldLabel>
                    <input
                      value={accountForm.server}
                      onChange={(e) => setAccountForm((f) => ({ ...f, server: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateAccount()}
                      placeholder="Ej: ICMarkets-Live01"
                      style={inputSt}
                    />
                  </div>
                  <div style={{ minWidth: "120px" }}>
                    <FieldLabel>Tipo</FieldLabel>
                    <select
                      value={accountForm.type}
                      onChange={(e) => setAccountForm((f) => ({ ...f, type: e.target.value }))}
                      style={inputSt}
                    >
                      <option value="master">Maestra</option>
                      <option value="slave">Esclava</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {(() => {
                    const canSave = accountForm.account_number.trim() && accountForm.server.trim()
                    return (
                      <button
                        onClick={handleCreateAccount}
                        disabled={savingAccount || !canSave}
                        style={{
                          padding: "8px 16px", borderRadius: "7px", border: "none",
                          background: canSave ? "linear-gradient(135deg,#10b981,#059669)" : "var(--hover-row)",
                          color: canSave ? "#fff" : "var(--text-muted)",
                          fontWeight: "700", fontSize: "12px",
                          cursor: canSave ? "pointer" : "not-allowed",
                        }}
                      >
                        {savingAccount ? "Verificando..." : "Agregar cuenta"}
                      </button>
                    )
                  })()}
                  <button
                    onClick={() => { setShowAccountForm(false); setAccountForm(defaultAccountForm); setAccountError("") }}
                    style={{
                      padding: "8px 12px", borderRadius: "7px",
                      border: "1px solid var(--border-input)", background: "transparent",
                      color: "var(--text-muted)", fontWeight: "600", fontSize: "12px", cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
                {accountError && (
                  <ErrorBanner msg={accountError} onClose={() => setAccountError("")} />
                )}
              </div>
            )}

            {copyAccounts.length === 0 && !showAccountForm ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-dim)", fontSize: "12px" }}>
                Agregá cuentas MT5 para usarlas en los copiadores.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

                {/* Maestras */}
                <div>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                    Maestras ({masterAccounts.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {masterAccounts.length === 0 ? (
                      <div style={{ fontSize: "12px", color: "var(--text-dim)", padding: "10px 0" }}>Sin cuentas maestras aún.</div>
                    ) : masterAccounts.map((acc) => (
                      <div key={acc.id} style={{
                        display: "flex", alignItems: "center", gap: "9px",
                        padding: "8px 12px", borderRadius: "8px",
                        background: "var(--hover-row)", border: "1px solid var(--border-card)",
                      }}>
                        <AccountAvatar name={acc.name} type={acc.type} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-1)" }}>{acc.name}</span>
                            <CopyButton text={acc.name} />
                          </div>
                          {acc.server && (
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.server}</div>
                          )}
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => handleDeleteAccount(acc.id)}
                            disabled={deletingAccount === acc.id}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "17px", lineHeight: 1, padding: "0 2px", opacity: 0.5 }}
                            title="Eliminar"
                          >×</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Esclavas */}
                <div>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                    Esclavas ({slaveAccounts.length} / 40)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {slaveAccounts.length === 0 ? (
                      <div style={{ fontSize: "12px", color: "var(--text-dim)", padding: "10px 0" }}>Sin cuentas esclavas aún.</div>
                    ) : slaveAccounts.map((acc) => (
                      <div key={acc.id} style={{
                        display: "flex", alignItems: "center", gap: "9px",
                        padding: "8px 12px", borderRadius: "8px",
                        background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.1)",
                      }}>
                        <AccountAvatar name={acc.name} type={acc.type} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-1)" }}>{acc.name}</span>
                            <CopyButton text={acc.name} />
                          </div>
                          {acc.server && (
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.server}</div>
                          )}
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => handleDeleteAccount(acc.id)}
                            disabled={deletingAccount === acc.id}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "17px", lineHeight: 1, padding: "0 2px", opacity: 0.5 }}
                            title="Eliminar"
                          >×</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Error global de cuentas (edición/eliminación) */}
            {accountError && !showAccountForm && (
              <ErrorBanner msg={accountError} onClose={() => setAccountError("")} />
            )}
          </div>
        )}
      </div>

      {/* ── Formulario de creación de copiador ── */}
      {canEdit && showForm && (
        <div style={{
          background: "var(--card-bg)",
          border: "1px solid var(--border-card)",
          borderRadius: "16px", overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-sub)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-1)" }}>Nuevo copiador</span>
            <button
              onClick={() => { setShowForm(false); setForm(defaultForm); setCreateError("") }}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "0 2px" }}
            >
              ×
            </button>
          </div>

          {/* Copy From + Send To */}
          <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

            {/* Copy from — cards visuales */}
            <div>
              <FieldLabel>Copy from (cuenta maestra)</FieldLabel>
              {masterAccounts.length > 0 ? (
                <div style={{
                  border: "1px solid var(--border-input)", borderRadius: "8px",
                  background: "var(--inner-bg)", overflow: "hidden",
                }}>
                  {masterAccounts.map((acc) => {
                    const selected = form.master_name === acc.name
                    return (
                      <div
                        key={acc.id}
                        onClick={() => setForm((f) => ({ ...f, master_name: acc.name }))}
                        style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "10px 14px", cursor: "pointer",
                          background: selected ? "rgba(16,185,129,0.07)" : "transparent",
                          borderLeft: `3px solid ${selected ? "#10b981" : "transparent"}`,
                          borderBottom: "1px solid var(--border-card)",
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{
                          width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
                          border: selected ? "3px solid #10b981" : "2px solid rgba(148,163,184,0.3)",
                          background: selected ? "#10b981" : "transparent",
                          transition: "all 0.15s",
                        }} />
                        <AccountAvatar name={acc.name} type={acc.type} />
                        <span style={{
                          fontSize: "13px", fontWeight: selected ? "700" : "400",
                          color: selected ? "var(--text-1)" : "var(--text-muted)", flex: 1,
                        }}>
                          {acc.name}
                        </span>
                        {selected && (
                          <span style={{
                            fontSize: "9px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px",
                            background: "rgba(16,185,129,0.12)", color: "#10b981",
                          }}>
                            SELEC.
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{
                  padding: "10px 14px", borderRadius: "8px",
                  border: "1px dashed var(--border-input)", background: "var(--inner-bg)",
                  fontSize: "12px", color: "var(--text-dim)",
                }}>
                  Primero agregá una cuenta maestra arriba.
                </div>
              )}
            </div>

            {/* Send to — checkboxes con multiplicador individual */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <FieldLabel>
                  Send to — {form.risk_type === "fixed_lots" ? "lotes" : "multiplicador"} por cuenta
                </FieldLabel>
                {form.slave_selections.length > 0 && (
                  <span style={{ fontSize: "10px", color: "#10b981", fontWeight: "700" }}>
                    {form.slave_selections.length} / 40 seleccionadas
                  </span>
                )}
              </div>
              {slaveAccounts.length > 0 ? (
                <div style={{
                  maxHeight: "220px", overflowY: "auto",
                  border: "1px solid var(--border-input)", borderRadius: "8px",
                  background: "var(--inner-bg)",
                }}>
                  {slaveAccounts.map((acc) => {
                    const sel     = form.slave_selections.find((s) => s.name === acc.name)
                    const checked = !!sel
                    // FIX: marcar si ya existe copiador activo con esa combinación
                    const alreadyExists = copiers.some(
                      (c) => c.master_name === form.master_name && c.slave_name === acc.name
                    )
                    return (
                      <div
                        key={acc.id}
                        style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "9px 12px",
                          background: checked ? "rgba(59,130,246,0.06)" : alreadyExists ? "rgba(248,113,113,0.03)" : "transparent",
                          borderBottom: "1px solid var(--border-card)",
                          transition: "background 0.15s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={alreadyExists && !checked}
                          onChange={() => !alreadyExists && toggleSlaveSelection(acc.name)}
                          style={{ accentColor: "#10b981", width: "14px", height: "14px", cursor: alreadyExists && !checked ? "not-allowed" : "pointer", flexShrink: 0 }}
                        />
                        <AccountAvatar name={acc.name} type={acc.type} />
                        <span style={{
                          fontSize: "13px", fontWeight: checked ? "600" : "400",
                          color: alreadyExists && !checked ? "var(--text-muted)" : checked ? "var(--text-1)" : "var(--text-muted)",
                          flex: 1, opacity: alreadyExists && !checked ? 0.5 : 1,
                        }}>
                          {acc.name}
                        </span>
                        {alreadyExists && !checked ? (
                          <span style={{ fontSize: "9px", color: "#f87171", fontWeight: "700", padding: "2px 6px", borderRadius: "4px", background: "rgba(248,113,113,0.08)" }}>
                            YA EXISTE
                          </span>
                        ) : checked ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>
                              {form.risk_type === "fixed_lots" ? "lots" : "×"}
                            </span>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={sel.multiplier}
                              onChange={(e) => updateSlaveMultiplier(acc.name, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ ...inputSt, width: "68px", padding: "4px 8px", fontSize: "12px", textAlign: "center" }}
                            />
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{
                  padding: "10px 14px", borderRadius: "8px",
                  border: "1px dashed var(--border-input)", background: "var(--inner-bg)",
                  fontSize: "12px", color: "var(--text-dim)",
                }}>
                  Primero agregá cuentas esclavas arriba.
                </div>
              )}
            </div>
          </div>

          {/* Opciones globales */}
          <div style={{ padding: "0 20px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
            <div>
              <FieldLabel>Risk Type</FieldLabel>
              <select value={form.risk_type} onChange={(e) => setForm((f) => ({ ...f, risk_type: e.target.value }))} style={inputSt}>
                {RISK_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Sufijo símbolo</FieldLabel>
              <input
                value={form.symbol_suffix}
                onChange={(e) => setForm((f) => ({ ...f, symbol_suffix: e.target.value }))}
                placeholder='Ej: "m" → EURUSDm'
                style={inputSt}
              />
            </div>
            <div>
              <FieldLabel>Copy existing trades</FieldLabel>
              <select value={form.copy_existing ? "yes" : "no"} onChange={(e) => setForm((f) => ({ ...f, copy_existing: e.target.value === "yes" }))} style={inputSt}>
                <option value="no">No</option>
                <option value="yes">Sí</option>
              </select>
            </div>
          </div>

          {/* Chips resumen */}
          {form.slave_selections.length > 0 && (
            <div style={{ padding: "0 20px 14px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Se crearán {form.slave_selections.length} copiador{form.slave_selections.length > 1 ? "es" : ""}:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {form.slave_selections.map(({ name, multiplier }) => (
                  <span key={name} style={{
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    padding: "3px 10px", borderRadius: "20px",
                    background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.18)",
                    fontSize: "11px", fontWeight: "600", color: "#60a5fa",
                  }}>
                    {form.master_name && <span style={{ color: "var(--text-dim)" }}>{form.master_name} →</span>}
                    {name}
                    <span style={{ color: "rgba(96,165,250,0.6)", fontSize: "10px" }}>
                      {form.risk_type === "fixed_lots" ? ` ${multiplier}lots` : ` ×${multiplier}`}
                    </span>
                    <button
                      onClick={() => toggleSlaveSelection(name)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#60a5fa", fontSize: "13px", lineHeight: 1, padding: 0, marginLeft: "2px" }}
                    >×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* FIX: error visible al crear */}
          {createError && (
            <div style={{ padding: "0 20px 12px" }}>
              <ErrorBanner msg={createError} onClose={() => setCreateError("")} />
            </div>
          )}

          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border-sub)", display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={handleCreate}
              disabled={saving || !canCreate}
              style={{
                padding: "9px 20px", borderRadius: "8px", border: "none",
                background: !canCreate ? "var(--hover-row)" : "linear-gradient(135deg,#10b981,#059669)",
                color: !canCreate ? "var(--text-muted)" : "#fff",
                fontWeight: "700", fontSize: "13px",
                cursor: !canCreate ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Creando..." : `Crear copiador${form.slave_selections.length > 1 ? "es" : ""}`}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(defaultForm); setCreateError("") }}
              style={{
                padding: "9px 16px", borderRadius: "8px",
                border: "1px solid var(--border-input)", background: "transparent",
                color: "var(--text-muted)", fontWeight: "600", fontSize: "13px", cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            {!canCreate && (
              <span style={{ fontSize: "11px", color: "var(--text-dim)", marginLeft: "4px" }}>
                {!form.master_name ? "Seleccioná una cuenta maestra." : "Seleccioná al menos una esclava."}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Tabla principal ── */}
      <div style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-card)",
        borderRadius: "16px", overflow: "hidden",
      }}>
        <div style={{
          padding: "0 20px", borderBottom: "1px solid var(--border-sub)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--inner-bg)",
        }}>
          <div style={{ display: "flex" }}>
            {[
              { key: "all",    label: "Todos",    count: copiers.length },
              { key: "active", label: "Activos",  count: activeCount },
              { key: "paused", label: "Pausados", count: pausedCount },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: "13px 15px", border: "none", background: "none", cursor: "pointer",
                fontSize: "13px", fontWeight: activeTab === tab.key ? "700" : "500",
                color: activeTab === tab.key ? "var(--text-1)" : "var(--text-muted)",
                borderBottom: activeTab === tab.key ? "2px solid #10b981" : "2px solid transparent",
                marginBottom: "-1px", display: "flex", alignItems: "center", gap: "6px",
              }}>
                {tab.label}
                <span style={{
                  fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "10px",
                  background: activeTab === tab.key ? "rgba(16,185,129,0.12)" : "var(--border-card)",
                  color: activeTab === tab.key ? "#10b981" : "var(--text-muted)",
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          <button onClick={() => { loadCopiers(); loadBalances(); }} style={{
            padding: "6px 12px", borderRadius: "7px",
            border: "1px solid var(--border-input)", background: "transparent",
            color: "var(--text-muted)", fontSize: "12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
            Cargando...
          </div>
        ) : filteredCopiers.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: "var(--text-dim)", marginBottom: "16px" }}>
              {activeTab === "all"
                ? "No tenés copiadores configurados todavía."
                : `No hay copiadores ${activeTab === "active" ? "activos" : "pausados"}.`}
            </div>
            {activeTab === "all" && (
              <button onClick={() => setShowForm(true)} style={{
                padding: "9px 20px", borderRadius: "8px", border: "none",
                background: "linear-gradient(135deg,#10b981,#059669)",
                color: "#fff", fontWeight: "700", fontSize: "13px", cursor: "pointer",
              }}>
                + Crear tu primer copiador
              </button>
            )}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thSt}>Follow</th>
                <th style={thSt}>Esclava</th>
                <th style={thSt}>Risk</th>
                <th style={thSt}>Mult. / Lotes</th>
                <th style={thSt}>Sufijo</th>
                <th style={thSt}>Day PnL</th>
                <th style={{ ...thSt, textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const groups = {}
                filteredCopiers.forEach((c) => {
                  if (!groups[c.master_name]) groups[c.master_name] = []
                  groups[c.master_name].push(c)
                })
                return Object.entries(groups).map(([masterName, masterCopiers]) => {
                  const positions      = activeSignals[masterName] || []
                  const masterExpKey   = `master_${masterName}`
                  const masterExpanded = expanded.has(masterExpKey)
                  return (
                    <Fragment key={masterName}>
                      {/* ── Fila cabecera Maestra ── */}
                      <tr style={{ background: "rgba(16,185,129,0.04)", borderTop: "2px solid rgba(16,185,129,0.12)" }}>
                        <td colSpan={5} style={{ padding: "10px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{
                              width: "32px", height: "32px", borderRadius: "9px", flexShrink: 0,
                              background: "linear-gradient(135deg,#10b981,#059669)",
                              display: "grid", placeItems: "center",
                              fontSize: "13px", fontWeight: "800", color: "#fff",
                            }}>
                              {masterName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-1)" }}>{masterName}</div>
                              <div style={{ fontSize: "10px", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "600" }}>
                                Cuenta Maestra · {masterCopiers.length} esclava{masterCopiers.length !== 1 ? "s" : ""}
                              </div>
                            </div>
                            <div style={{ marginLeft: "auto" }}>
                              <button
                                onClick={() => toggleExpand(masterExpKey)}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: "6px",
                                  padding: "5px 12px", borderRadius: "6px", cursor: "pointer",
                                  border: `1px solid ${positions.length > 0 ? "rgba(16,185,129,0.25)" : "var(--border-card)"}`,
                                  background: positions.length > 0 ? "rgba(16,185,129,0.07)" : "transparent",
                                  color: positions.length > 0 ? "#10b981" : "var(--text-muted)",
                                  fontWeight: "600", fontSize: "12px",
                                }}
                              >
                                {positions.length > 0 ? (
                                  <>
                                    <span style={{
                                      width: "17px", height: "17px", borderRadius: "50%",
                                      background: "#10b981", color: "#fff",
                                      fontSize: "9px", fontWeight: "800",
                                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    }}>{positions.length}</span>
                                    posicion{positions.length !== 1 ? "es" : ""}
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      {masterExpanded ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                                    </svg>
                                  </>
                                ) : <span style={{ opacity: 0.4 }}>Sin posiciones</span>}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                          {balances[masterName] ? (
                            <span style={{
                              fontSize: "13px", fontWeight: "700", fontFamily: "monospace",
                              color: balances[masterName].day_profit >= 0 ? "#10b981" : "#f87171",
                            }}>
                              {balances[masterName].day_profit >= 0 ? "+" : ""}{Number(balances[masterName].day_profit).toFixed(2)}
                            </span>
                          ) : <span style={{ opacity: 0.3, fontSize: "13px" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 16px" }} />
                      </tr>

                      {/* ── Posiciones expandidas (nivel maestra) ── */}
                      {masterExpanded && positions.length > 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: "10px 24px 14px 64px", background: "rgba(16,185,129,0.02)", borderBottom: "1px solid var(--border-sub)" }}>
                            <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                              Posiciones activas
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              {positions.map((pos) => (
                                <div key={pos.id} style={{
                                  display: "grid", gridTemplateColumns: "90px 58px 80px 110px 1fr",
                                  gap: "12px", alignItems: "center",
                                  padding: "7px 12px", borderRadius: "8px",
                                  background: "var(--hover-row)", border: "1px solid var(--border-card)", fontSize: "12px",
                                }}>
                                  <span style={{ fontWeight: "700", color: "var(--text-1)", fontFamily: "monospace" }}>{pos.symbol}</span>
                                  <span style={{
                                    fontWeight: "700", fontSize: "10px", padding: "2px 7px", borderRadius: "4px",
                                    background: pos.direction === "BUY" ? "rgba(16,185,129,0.12)" : "rgba(248,113,113,0.12)",
                                    color: pos.direction === "BUY" ? "#10b981" : "#f87171",
                                  }}>{pos.direction}</span>
                                  <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>{pos.lots} lots</span>
                                  <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>@ {Number(pos.open_price).toFixed(5)}</span>
                                  <span style={{ color: "var(--text-dim)", fontSize: "11px", textAlign: "right", fontFamily: "monospace" }}>
                                    #{pos.master_ticket}{pos.exec_ticket ? ` → #${pos.exec_ticket}` : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* ── Filas esclavas ── */}
                      {masterCopiers.map((copier, idx) => {
                        const isEditing = editingId === copier.id
                        const rowBg = idx % 2 !== 0 ? "var(--hover-row)" : "transparent"
                        return (
                          <Fragment key={copier.id}>
                            <tr style={{ background: rowBg, transition: "background 0.15s" }}>
                              <td style={{ padding: "11px 16px 11px 28px", verticalAlign: "middle" }}>
                                <Toggle on={copier.is_active} onChange={canEdit ? () => toggleActive(copier) : () => {}} />
                              </td>
                              <td style={{ padding: "11px 16px", verticalAlign: "middle" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <div style={{ width: "2px", height: "28px", background: "rgba(59,130,246,0.2)", borderRadius: "1px", flexShrink: 0 }} />
                                  <div style={{
                                    width: "28px", height: "28px", borderRadius: "7px", flexShrink: 0,
                                    background: "rgba(59,130,246,0.12)",
                                    display: "grid", placeItems: "center",
                                    fontSize: "11px", fontWeight: "800", color: "#60a5fa",
                                  }}>
                                    {copier.slave_name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-1)" }}>
                                      {copier.slave_name}
                                      {copier.slave_number && (
                                        <span style={{ color: "var(--text-muted)", fontWeight: "400", fontSize: "11px", marginLeft: "5px" }}>#{copier.slave_number}</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Esclava</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: "11px 16px", verticalAlign: "middle" }}>
                                <span style={{
                                  fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "5px",
                                  background: "rgba(59,130,246,0.09)", color: "#60a5fa",
                                  border: "1px solid rgba(59,130,246,0.18)",
                                  textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
                                }}>
                                  {RISK_SHORT[copier.risk_type] || copier.risk_type}
                                </span>
                              </td>
                              <td style={{ padding: "11px 16px", verticalAlign: "middle", fontSize: "13px", fontWeight: "700", color: "var(--text-1)", fontFamily: "monospace" }}>
                                {multValue(copier)}
                              </td>
                              <td style={{ padding: "11px 16px", verticalAlign: "middle", fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                                {copier.symbol_suffix ? `"${copier.symbol_suffix}"` : <span style={{ opacity: 0.4 }}>—</span>}
                              </td>
                              <td style={{ padding: "11px 16px", verticalAlign: "middle" }}>
                                {balances[copier.slave_name] ? (
                                  <span style={{
                                    fontSize: "13px", fontWeight: "700", fontFamily: "monospace",
                                    color: balances[copier.slave_name].day_profit >= 0 ? "#10b981" : "#f87171",
                                  }}>
                                    {balances[copier.slave_name].day_profit >= 0 ? "+" : ""}{Number(balances[copier.slave_name].day_profit).toFixed(2)}
                                  </span>
                                ) : <span style={{ opacity: 0.3, fontSize: "13px" }}>—</span>}
                              </td>
                              <td style={{ padding: "11px 16px", verticalAlign: "middle", textAlign: "right" }}>
                                {canEdit && (
                                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                    <button onClick={() => startEdit(copier)} style={{
                                      padding: "5px 12px", borderRadius: "6px",
                                      border: "1px solid var(--border-input)", background: "transparent",
                                      color: "var(--text-muted)", fontWeight: "600", fontSize: "11px", cursor: "pointer",
                                    }}>Editar</button>
                                    <button onClick={() => handleDelete(copier.id)} disabled={deleting === copier.id} style={{
                                      padding: "5px 12px", borderRadius: "6px",
                                      border: "1px solid rgba(248,113,113,0.18)", background: "transparent",
                                      color: "#f87171", fontWeight: "600", fontSize: "11px", cursor: "pointer",
                                    }}>{deleting === copier.id ? "..." : "Eliminar"}</button>
                                  </div>
                                )}
                              </td>
                            </tr>

                            {/* ── Fila de edición ── */}
                            {canEdit && isEditing && (
                              <tr>
                                <td colSpan={7} style={{
                                  padding: "16px 20px",
                                  borderTop: "1px solid rgba(59,130,246,0.1)",
                                  borderBottom: "1px solid rgba(59,130,246,0.1)",
                                  background: "rgba(59,130,246,0.025)",
                                }}>
                                  <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "12px" }}>
                                    Editar copiador
                                  </div>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "10px", marginBottom: "12px" }}>
                                    <div>
                                      <FieldLabel>Copy from</FieldLabel>
                                      {masterAccounts.length > 0 ? (
                                        <select value={editForm.master_name} onChange={(e) => setEditForm((f) => ({ ...f, master_name: e.target.value }))} style={inputSt}>
                                          <option value="">— Maestra —</option>
                                          {masterAccounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                                        </select>
                                      ) : (
                                        <input value={editForm.master_name} onChange={(e) => setEditForm((f) => ({ ...f, master_name: e.target.value }))} style={inputSt} />
                                      )}
                                    </div>
                                    <div>
                                      <FieldLabel>Send to</FieldLabel>
                                      {slaveAccounts.length > 0 ? (
                                        <select value={editForm.slave_name} onChange={(e) => setEditForm((f) => ({ ...f, slave_name: e.target.value }))} style={inputSt}>
                                          <option value="">— Esclava —</option>
                                          {slaveAccounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                                        </select>
                                      ) : (
                                        <input value={editForm.slave_name} onChange={(e) => setEditForm((f) => ({ ...f, slave_name: e.target.value }))} style={inputSt} />
                                      )}
                                    </div>
                                    <div>
                                      <FieldLabel>Nº cuenta</FieldLabel>
                                      <input value={editForm.slave_number} onChange={(e) => setEditForm((f) => ({ ...f, slave_number: e.target.value }))} placeholder="Opcional" style={inputSt} />
                                    </div>
                                    <div>
                                      <FieldLabel>Risk Type</FieldLabel>
                                      <select value={editForm.risk_type} onChange={(e) => setEditForm((f) => ({ ...f, risk_type: e.target.value }))} style={inputSt}>
                                        {RISK_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <FieldLabel>{editForm.risk_type === "fixed_lots" ? "Lotes fijos" : "Multiplicador"}</FieldLabel>
                                      <input type="number" min="0.01" step="0.01" value={editForm.multiplier} onChange={(e) => setEditForm((f) => ({ ...f, multiplier: e.target.value }))} style={inputSt} />
                                    </div>
                                    <div>
                                      <FieldLabel>Sufijo símbolo</FieldLabel>
                                      <input value={editForm.symbol_suffix} onChange={(e) => setEditForm((f) => ({ ...f, symbol_suffix: e.target.value }))} placeholder='Ej: "m"' style={inputSt} />
                                    </div>
                                    <div>
                                      <FieldLabel>Copy existing trades</FieldLabel>
                                      <select value={editForm.copy_existing ? "yes" : "no"} onChange={(e) => setEditForm((f) => ({ ...f, copy_existing: e.target.value === "yes" }))} style={inputSt}>
                                        <option value="no">No</option>
                                        <option value="yes">Sí</option>
                                      </select>
                                    </div>
                                  </div>
                                  {updateError && (
                                    <div style={{ marginBottom: "10px" }}>
                                      <ErrorBanner msg={updateError} onClose={() => setUpdateError("")} />
                                    </div>
                                  )}
                                  <div style={{ display: "flex", gap: "8px" }}>
                                    <button onClick={handleUpdate} disabled={saving || !editForm.master_name || !editForm.slave_name} style={{
                                      padding: "8px 18px", borderRadius: "7px", border: "none",
                                      background: "linear-gradient(135deg,#10b981,#059669)",
                                      color: "#fff", fontWeight: "700", fontSize: "12px", cursor: "pointer",
                                    }}>
                                      {saving ? "Guardando..." : "Guardar cambios"}
                                    </button>
                                    <button onClick={() => { setEditingId(null); setUpdateError("") }} style={{
                                      padding: "8px 14px", borderRadius: "7px",
                                      border: "1px solid var(--border-input)", background: "transparent",
                                      color: "var(--text-muted)", fontWeight: "600", fontSize: "12px", cursor: "pointer",
                                    }}>
                                      Cancelar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </Fragment>
                  )
                })
              })()}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Expert Advisors ── */}
      <div style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-card)",
        borderRadius: "16px", overflow: "hidden",
      }}>
        <div style={{ padding: "15px 20px", borderBottom: "1px solid var(--border-sub)", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-1)" }}>Expert Advisors para MT5</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Instalá el EA correspondiente en cada terminal de MetaTrader 5.
            </div>
          </div>
        </div>
        <div style={{ padding: "14px 20px", display: "flex", gap: "10px", flexWrap: "wrap", borderBottom: "1px solid var(--border-sub)" }}>
          <a href="/ea/GlobalSairu_CopyMaster.ex5" download="GlobalSairu_CopyMaster.ex5" style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 18px", borderRadius: "8px", textDecoration: "none",
            background: "linear-gradient(135deg,#10b981,#059669)",
            color: "#fff", fontWeight: "700", fontSize: "13px",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            EA Maestro
          </a>
          <a href="/ea/GlobalSairu_CopySlave.ex5" download="GlobalSairu_CopySlave.ex5" style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 18px", borderRadius: "8px", textDecoration: "none",
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.18)",
            color: "#60a5fa", fontWeight: "700", fontSize: "13px",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            EA Esclavo
          </a>
        </div>
        <div style={{ padding: "14px 20px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "12px" }}>
          {[
            { n: "1", title: "Descargá el EA", desc: '"EA Maestro" va en la cuenta que envía operaciones, "EA Esclavo" en cada receptora.' },
            { n: "2", title: "Copialo a MT5", desc: "Archivo → Abrir carpeta de datos → MQL5 → Experts → Advisors. Pegá el .ex5 ahí." },
            { n: "3", title: "Habilitá WebRequest", desc: "Herramientas → Opciones → Asesores Expertos → activar WebRequest → agregar la URL de Supabase → OK." },
            { n: "4", title: "Adjuntá al gráfico", desc: "Buscá el EA en el Navigator y arrastralo al gráfico de la cuenta correspondiente." },
            { n: "5", title: "Configurá el nombre", desc: "En los parámetros del EA colocá el nombre exacto de la cuenta tal como aparece en el journal." },
          ].map((step) => (
            <div key={step.n} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{
                width: "22px", height: "22px", borderRadius: "6px", flexShrink: 0,
                background: "rgba(16,185,129,0.09)", border: "1px solid rgba(16,185,129,0.18)",
                display: "grid", placeItems: "center",
                fontSize: "10px", fontWeight: "800", color: "#10b981",
              }}>
                {step.n}
              </div>
              <div>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-1)", marginBottom: "2px" }}>{step.title}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.5" }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
