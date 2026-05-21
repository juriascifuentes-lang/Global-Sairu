import { useState, useEffect, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { showConfirm } from "../lib/confirm"

const toTrade = (r) => ({
  id: Number(r.id), symbol: r.symbol, type: r.type, profit: r.profit,
  note: r.note, date: r.date, openTime: r.open_time, strategy: r.strategy,
  account: r.account, setupQuality: r.setup_quality || "", psychology: r.psychology || "",
  images: r.images || [], entryNote: r.entry_note || "", entryImages: r.entry_images || [],
  stopLoss: r.stop_loss ?? null, takeProfit: r.take_profit ?? null,
  maxRR: r.max_rr ?? null,
})
const toAccount = (r) => ({
  id: Number(r.id), name: r.name, capitalType: r.capital_type, size: r.size,
  cost: r.cost, idNumber: r.id_number, broker: r.broker, brokerCustom: r.broker_custom,
  notes: r.notes, status: r.status, phase: r.phase || "",
})
const toStrategy = (r) => ({ id: Number(r.id), name: r.name, description: r.description || "", rules: r.rules || [] })

const fromTrade = (t, uid) => ({
  id: t.id, user_id: uid, symbol: t.symbol, type: t.type, profit: Number(t.profit),
  note: t.note, date: t.date, open_time: t.openTime, strategy: t.strategy, account: t.account,
  setup_quality: t.setupQuality || null, psychology: t.psychology || null,
  images: t.images || [], entry_note: t.entryNote || null, entry_images: t.entryImages || [],
  stop_loss: t.stopLoss !== "" && t.stopLoss != null ? Number(t.stopLoss) : null,
  take_profit: t.takeProfit !== "" && t.takeProfit != null ? Number(t.takeProfit) : null,
  max_rr: t.maxRR !== "" && t.maxRR != null ? Number(t.maxRR) : null,
})
const fromAccount = (a, uid) => ({
  id: a.id, user_id: uid, name: a.name, capital_type: a.capitalType, size: a.size,
  cost: a.cost, id_number: a.idNumber, broker: a.broker, broker_custom: a.brokerCustom,
  notes: a.notes, status: a.status, phase: a.phase || null,
})
const fromStrategy = (s, uid) => ({ id: s.id, user_id: uid, name: s.name, description: s.description, rules: s.rules })

export function useReviewData(userId, showToast) {
  const [trades, setTrades]       = useState([])
  const [accounts, setAccounts]   = useState([])
  const [strategies, setStrategies] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState("")

  const loadData = useCallback(async () => {
    if (!userId) return
    const [tradesRes, accountsRes, strategiesRes] = await Promise.all([
      supabase.from("review_trades").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("review_accounts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("review_strategies").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ])
    if (tradesRes.data)    setTrades(tradesRes.data.map(toTrade))
    if (accountsRes.data)  setAccounts(accountsRes.data.map(toAccount))
    if (strategiesRes.data) setStrategies(strategiesRes.data.map(toStrategy))
    if ([tradesRes, accountsRes, strategiesRes].some((r) => r.error))
      showToast("Error al cargar datos de revisión.", "error")
  }, [userId])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!userId) { setTrades([]); setAccounts([]); setStrategies([]); setSelectedAccountId("") }
  }, [userId])

  // ── Trades ──────────────────────────────────────────────────────

  const addTrade = async (form, isEditing) => {
    if (!form.symbol || form.profit === "") return
    if (isEditing) {
      const updated = { ...form }
      setTrades((prev) => prev.map((t) => t.id === form.id ? updated : t))
      const { id: _id, ...updatePayload } = fromTrade(updated, userId)
      const { error } = await supabase.from("review_trades").update(updatePayload).eq("id", form.id)
      if (error) { console.error("[review addTrade update]", error); showToast("No se pudo actualizar el trade.") }
    } else {
      const tempId = crypto.randomUUID()
      const newTrade = { id: tempId, ...form }
      setTrades((prev) => [newTrade, ...prev])
      const { id: _tid, ...payload } = fromTrade(newTrade, userId)
      const { data, error } = await supabase.from("review_trades").insert(payload).select().single()
      if (error) {
        console.error("[review addTrade insert]", error)
        setTrades((prev) => prev.filter((t) => t.id !== tempId))
        showToast("No se pudo guardar el trade.")
      } else if (data) {
        setTrades((prev) => prev.map((t) => t.id === tempId ? toTrade(data) : t))
      }
    }
  }

  const deleteTrade = async (id) => {
    if (!await showConfirm("¿Eliminar este trade de revisión?", { title: "Eliminar trade", confirmLabel: "Eliminar", danger: true })) return
    setTrades((prev) => prev.filter((t) => t.id !== id))
    await supabase.from("review_trades").delete().eq("id", id)
  }

  const deleteManyTrades = async (ids) => {
    if (ids.length === 0) return
    if (!await showConfirm(`¿Eliminar ${ids.length} trades de revisión?`, { title: "Eliminar trades", confirmLabel: "Eliminar", danger: true })) return
    setTrades((prev) => prev.filter((t) => !ids.includes(t.id)))
    await supabase.from("review_trades").delete().in("id", ids).eq("user_id", userId)
  }

  const clearAllTrades = async (accountName) => {
    const label = accountName ? `de la cuenta "${accountName}"` : "de TODAS las cuentas de revisión"
    if (!await showConfirm(`¿Eliminar todos los trades ${label}?`, { title: "Eliminar trades", confirmLabel: "Eliminar todo", danger: true })) return
    if (accountName) {
      setTrades((prev) => prev.filter((t) => t.account !== accountName))
      await supabase.from("review_trades").delete().eq("user_id", userId).eq("account", accountName)
    } else {
      setTrades([])
      await supabase.from("review_trades").delete().eq("user_id", userId)
    }
  }

  const importTrades = async (newTrades) => {
    const ts = crypto.randomUUID()
    const mapped = newTrades.map((t, i) => ({ id: ts + i, ...t }))
    setTrades((prev) => [...mapped, ...prev])
    const payloads = mapped.map((t) => { const { id: _tid, ...p } = fromTrade(t, userId); return p })
    const { data, error } = await supabase.from("review_trades").insert(payloads).select()
    if (error) {
      console.error("[review importTrades]", error)
      const tempIds = new Set(mapped.map((t) => t.id))
      setTrades((prev) => prev.filter((t) => !tempIds.has(t.id)))
      showToast("No se pudo importar los trades.")
    } else if (data) {
      const tempIds = new Set(mapped.map((t) => t.id))
      setTrades((prev) => [...data.map(toTrade), ...prev.filter((t) => !tempIds.has(t.id))])
    }
  }

  const replaceAccountTrades = async (accountName, newTrades) => {
    const ts = crypto.randomUUID()
    const mapped = newTrades.map((t, i) => ({ id: ts + i, ...t, account: accountName }))
    setTrades((prev) => [...mapped, ...prev.filter((t) => t.account !== accountName)])
    await supabase.from("review_trades").delete().eq("user_id", userId).eq("account", accountName)
    const payloads = mapped.map((t) => { const { id: _tid, ...p } = fromTrade(t, userId); return p })
    const { data, error } = await supabase.from("review_trades").insert(payloads).select()
    if (error) {
      console.error("[review replaceAccountTrades]", error)
      showToast("No se pudo actualizar el historial.")
      return { ok: false, error }
    } else if (data) {
      const tempIds = new Set(mapped.map((t) => t.id))
      setTrades((prev) => [...data.map(toTrade), ...prev.filter((t) => !tempIds.has(t.id))])
    }
    return { ok: true }
  }

  const appendAccountTrades = async (accountName, newTrades) => {
    const existing = trades.filter((t) => t.account === accountName)
    const existingKeys = new Set(existing.map((t) => `${t.date}|${t.openTime}|${t.symbol}|${t.type}|${t.profit}`))
    const toInsert = newTrades.filter((t) => !existingKeys.has(`${t.date}|${t.openTime}|${t.symbol}|${t.type}|${t.profit}`))
    const duplicates = newTrades.length - toInsert.length
    if (toInsert.length === 0) return { ok: true, inserted: 0, duplicates }
    const ts = crypto.randomUUID()
    const mapped = toInsert.map((t, i) => ({ id: ts + i, ...t, account: accountName }))
    setTrades((prev) => [...mapped, ...prev])
    const payloads = mapped.map((t) => { const { id: _tid, ...p } = fromTrade(t, userId); return p })
    const { data, error } = await supabase.from("review_trades").insert(payloads).select()
    if (error) {
      console.error("[review appendAccountTrades]", error)
      showToast("No se pudo agregar los trades.")
      setTrades((prev) => prev.filter((t) => !mapped.some((m) => m.id === t.id)))
      return { ok: false, error }
    } else if (data) {
      const tempIds = new Set(mapped.map((t) => t.id))
      setTrades((prev) => [...data.map(toTrade), ...prev.filter((t) => !tempIds.has(t.id))])
    }
    return { ok: true, inserted: toInsert.length, duplicates }
  }

  // ── Accounts ────────────────────────────────────────────────────

  const createAccount = async (account) => {
    const tempId = account.id
    setAccounts((prev) => [account, ...prev])
    const { id: _id, ...payload } = fromAccount(account, userId)
    const { data, error } = await supabase.from("review_accounts").insert(payload).select().single()
    if (error) {
      console.error("[review createAccount]", error)
      setAccounts((prev) => prev.filter((a) => a.id !== tempId))
      showToast("No se pudo crear la cuenta.")
    } else if (data) {
      setAccounts((prev) => prev.map((a) => a.id === tempId ? toAccount(data) : a))
    }
  }

  const deleteAccount = async (id) => {
    const account = accounts.find((a) => a.id === id)
    const tradeCount = account ? trades.filter((t) => t.account === account.name).length : 0
    const msg = tradeCount > 0
      ? `¿Eliminar la cuenta "${account?.name}" y sus ${tradeCount} trades de revisión?`
      : `¿Eliminar la cuenta de revisión "${account?.name}"?`
    if (!await showConfirm(msg, { title: "Eliminar cuenta", confirmLabel: "Eliminar", danger: true })) return
    setAccounts((prev) => prev.filter((a) => a.id !== id))
    if (selectedAccountId && String(id) === selectedAccountId) setSelectedAccountId("")
    if (account && tradeCount > 0) {
      setTrades((prev) => prev.filter((t) => t.account !== account.name))
      await supabase.from("review_trades").delete().eq("user_id", userId).eq("account", account.name)
    }
    await supabase.from("review_accounts").delete().eq("id", id)
  }

  const updateAccount = async (updated) => {
    const backup = accounts.find((a) => a.id === updated.id)
    const nameChanged = backup && backup.name !== updated.name

    setAccounts((prev) => prev.map((a) => a.id === updated.id ? updated : a))
    if (nameChanged) setTrades((prev) => prev.map((t) => t.account === backup.name ? { ...t, account: updated.name } : t))

    const { id: _id, ...updatePayload } = fromAccount(updated, userId)
    const { error } = await supabase.from("review_accounts").update(updatePayload).eq("id", updated.id)
    if (error) {
      console.error("[review updateAccount]", error)
      if (backup) {
        setAccounts((prev) => prev.map((a) => a.id === updated.id ? backup : a))
        if (nameChanged) setTrades((prev) => prev.map((t) => t.account === updated.name ? { ...t, account: backup.name } : t))
      }
      showToast("No se pudo actualizar la cuenta.")
      return
    }

    if (nameChanged) {
      const { error: tradesErr } = await supabase
        .from("review_trades")
        .update({ account: updated.name })
        .eq("user_id", userId)
        .eq("account", backup.name)
      if (tradesErr) {
        console.error("[review updateAccount trades rename]", tradesErr)
        setTrades((prev) => prev.map((t) => t.account === updated.name ? { ...t, account: backup.name } : t))
        showToast("Cuenta actualizada pero no se pudieron renombrar los trades.")
      }
    }
  }

  // ── Strategies ──────────────────────────────────────────────────

  const createStrategy = async (s) => {
    const tempId = crypto.randomUUID()
    const newStrategy = { id: tempId, ...s }
    setStrategies((prev) => [newStrategy, ...prev])
    const { id: _id, ...payload } = fromStrategy(newStrategy, userId)
    const { data, error } = await supabase.from("review_strategies").insert(payload).select().single()
    if (error) {
      console.error("[review createStrategy]", error)
      setStrategies((prev) => prev.filter((x) => x.id !== tempId))
      showToast("No se pudo crear la estrategia.")
    } else if (data) {
      setStrategies((prev) => prev.map((x) => x.id === tempId ? toStrategy(data) : x))
    }
  }

  const deleteStrategy = async (id) => {
    if (!await showConfirm("¿Eliminar esta estrategia de revisión?", { title: "Eliminar estrategia", confirmLabel: "Eliminar", danger: true })) return
    const backup = strategies.find((s) => s.id === id)
    setStrategies((prev) => prev.filter((s) => s.id !== id))
    const { error } = await supabase.from("review_strategies").delete().eq("id", id)
    if (error) {
      console.error("[review deleteStrategy]", error)
      if (backup) setStrategies((prev) => [backup, ...prev])
      showToast("No se pudo eliminar la estrategia.")
    }
  }

  return {
    trades, accounts, strategies,
    selectedAccountId, setSelectedAccountId,
    loadData,
    addTrade, deleteTrade, deleteManyTrades, clearAllTrades, importTrades, replaceAccountTrades, appendAccountTrades,
    createAccount, deleteAccount, updateAccount,
    createStrategy, deleteStrategy,
  }
}
