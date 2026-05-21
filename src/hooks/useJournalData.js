import { useState, useEffect, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { uploadBase64Image, isBase64 } from "../lib/storage"
import { showConfirm } from "../lib/confirm"

const toTrade = (r) => ({ id: Number(r.id), symbol: r.symbol, type: r.type, profit: r.profit, note: r.note, date: r.date, openTime: r.open_time, strategy: r.strategy, account: r.account, setupQuality: r.setup_quality || "", psychology: r.psychology || "", images: r.images || [], entryNote: r.entry_note || "", entryImages: r.entry_images || [], stopLoss: r.stop_loss ?? null, takeProfit: r.take_profit ?? null, copiedFromId: r.copied_from_id ?? null })
const toAccount = (r) => ({ id: Number(r.id), name: r.name, capitalType: r.capital_type, size: r.size, cost: r.cost, idNumber: r.id_number, broker: r.broker, brokerCustom: r.broker_custom, notes: r.notes, status: r.status, phase: r.phase || "", masterAccountId: r.master_account_id ?? null, copyRatio: r.copy_ratio ?? 1.0 })
const toWithdrawal = (r) => ({ id: Number(r.id), account: r.account, amount: r.amount, date: r.date, notes: r.notes })
const toStrategy = (r) => ({ id: Number(r.id), name: r.name, description: r.description || "", rules: r.rules || [] })

const fromTrade = (t, uid) => ({ id: t.id, user_id: uid, symbol: t.symbol, type: t.type, profit: Number(t.profit), note: t.note, date: t.date, open_time: t.openTime, strategy: t.strategy, account: t.account, setup_quality: t.setupQuality || null, psychology: t.psychology || null, images: t.images || [], entry_note: t.entryNote || null, entry_images: t.entryImages || [], stop_loss: t.stopLoss !== "" && t.stopLoss != null ? Number(t.stopLoss) : null, take_profit: t.takeProfit !== "" && t.takeProfit != null ? Number(t.takeProfit) : null, copied_from_id: t.copiedFromId ?? null })
const fromAccount = (a, uid) => ({ id: a.id, user_id: uid, name: a.name, capital_type: a.capitalType, size: a.size, cost: a.cost, id_number: a.idNumber, broker: a.broker, broker_custom: a.brokerCustom, notes: a.notes, status: a.status, phase: a.phase || null, master_account_id: a.masterAccountId ?? null, copy_ratio: a.copyRatio ?? 1.0 })
const fromWithdrawal = (w, uid) => ({ id: w.id, user_id: uid, account: w.account, amount: w.amount, date: w.date, notes: w.notes })
const fromStrategy = (s, uid) => ({ id: s.id, user_id: uid, name: s.name, description: s.description, rules: s.rules })

async function migrateImages(trades, setTrades) {
  const toMigrate = trades.filter((t) =>
    (t.images || []).some(isBase64) || (t.entryImages || []).some(isBase64)
  )
  if (toMigrate.length === 0) return

  async function migrateArray(arr) {
    return Promise.all((arr || []).map((img) => isBase64(img) ? uploadBase64Image(img).catch(() => img) : img))
  }

  for (const trade of toMigrate) {
    const newImages = await migrateArray(trade.images)
    const newEntryImages = await migrateArray(trade.entryImages)
    await supabase.from("trades").update({ images: newImages, entry_images: newEntryImages }).eq("id", trade.id)
    setTrades((prev) => prev.map((t) => t.id === trade.id ? { ...t, images: newImages, entryImages: newEntryImages } : t))
  }
}

export function useJournalData(userId, showToast) {
  const [trades, setTrades] = useState([])
  const [accounts, setAccounts] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [strategies, setStrategies] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState("")

  const loadData = useCallback(async () => {
    if (!userId) return
    const [tradesRes, accountsRes, withdrawalsRes, strategiesRes] = await Promise.all([
      supabase.from("trades").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("accounts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("strategies").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ])
    const anyError = [tradesRes, accountsRes, withdrawalsRes, strategiesRes].some((r) => r.error)
    if (anyError) showToast("Error al cargar los datos. Verifica tu conexión.", "error")
    if (tradesRes.data) {
      const mapped = tradesRes.data.map(toTrade)
      setTrades(mapped)
      await migrateImages(mapped, setTrades)
    }
    if (accountsRes.data) setAccounts(accountsRes.data.map(toAccount))
    if (withdrawalsRes.data) setWithdrawals(withdrawalsRes.data.map(toWithdrawal))
    if (strategiesRes.data) setStrategies(strategiesRes.data.map(toStrategy))
  }, [userId])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!userId) {
      setTrades([])
      setAccounts([])
      setWithdrawals([])
      setStrategies([])
      setSelectedAccountId("")
    }
  }, [userId])

  // ── Trades ──────────────────────────────────────────────────────

  const addTrade = async (form, isEditing) => {
    if (!form.symbol || form.profit === "") return

    if (isEditing) {
      const updated = { ...form }
      setTrades((prev) => prev.map((t) => t.id === form.id ? updated : t))
      const { error } = await supabase.from("trades").update(fromTrade(updated, userId)).eq("id", form.id)
      if (error) { console.error("[addTrade update]", error); showToast("No se pudo actualizar el trade.") }

      // Cascade update a las copias (solo si este trade es el original, no una copia)
      if (!updated.copiedFromId) {
        const masterAccount = accounts.find((a) => a.name === updated.account)
        if (masterAccount) {
          const slaveAccounts = accounts.filter((a) => a.masterAccountId === masterAccount.id)
          for (const slave of slaveAccounts) {
            const scaledProfit = Number(updated.profit) * (slave.copyRatio ?? 1)
            setTrades((prev) => prev.map((t) =>
              t.copiedFromId === form.id && t.account === slave.name
                ? { ...t, ...updated, profit: scaledProfit, account: slave.name, copiedFromId: form.id }
                : t
            ))
            const { id: _id, ...updatePayload } = fromTrade(
              { ...updated, profit: scaledProfit, account: slave.name, copiedFromId: form.id },
              userId
            )
            await supabase.from("trades").update(updatePayload)
              .eq("copied_from_id", form.id)
              .eq("account", slave.name)
              .eq("user_id", userId)
          }
        }
      }
    } else {
      const tempId = crypto.randomUUID()
      const newTrade = { id: tempId, ...form, copiedFromId: null }
      setTrades((prev) => [newTrade, ...prev])
      const { id: _tid, ...payload } = fromTrade(newTrade, userId)
      const { data, error } = await supabase.from("trades").insert(payload).select().single()
      if (error) {
        console.error("[addTrade insert]", error)
        setTrades((prev) => prev.filter((t) => t.id !== tempId))
        showToast("No se pudo guardar el trade.")
      } else if (data) {
        const realTrade = toTrade(data)
        setTrades((prev) => prev.map((t) => t.id === tempId ? realTrade : t))

        // Cascade insert a todas las cuentas esclavas
        const masterAccount = accounts.find((a) => a.name === form.account)
        if (masterAccount) {
          const slaveAccounts = accounts.filter((a) => a.masterAccountId === masterAccount.id)
          for (const slave of slaveAccounts) {
            const scaledProfit = Number(form.profit) * (slave.copyRatio ?? 1)
            const { id: _id, ...copyPayload } = fromTrade(
              { ...realTrade, account: slave.name, profit: scaledProfit, copiedFromId: realTrade.id },
              userId
            )
            const { data: copyData } = await supabase.from("trades").insert(copyPayload).select().single()
            if (copyData) setTrades((prev) => [toTrade(copyData), ...prev])
          }
        }
      }
    }
  }

  const deleteTrade = async (id) => {
    const isMaster = !trades.find((t) => t.id === id)?.copiedFromId
    const msg = isMaster
      ? "¿Eliminar este trade? Las copias en cuentas esclavas también se eliminarán."
      : "¿Eliminar esta copia?"
    if (await showConfirm(msg, { title: "Eliminar trade", confirmLabel: "Eliminar", danger: true })) {
      setTrades((prev) => {
        let filtered = prev.filter((t) => t.id !== id)
        if (isMaster) filtered = filtered.filter((t) => t.copiedFromId !== id)
        return filtered
      })
      await supabase.from("trades").delete().eq("id", id)
      if (isMaster) {
        await supabase.from("trades").delete().eq("copied_from_id", id).eq("user_id", userId)
      }
    }
  }

  const deleteManyTrades = async (ids) => {
    if (ids.length === 0) return
    if (await showConfirm(`¿Eliminar ${ids.length} trades seleccionados? Esta acción no se puede deshacer.`, { title: "Eliminar trades", confirmLabel: "Eliminar", danger: true })) {
      const idsSet = new Set(ids)
      trades.forEach((t) => { if (t.copiedFromId && idsSet.has(t.copiedFromId)) idsSet.add(t.id) })
      setTrades((prev) => prev.filter((t) => !idsSet.has(t.id)))
      await supabase.from("trades").delete().in("id", [...idsSet]).eq("user_id", userId)
    }
  }

  const clearAllTrades = async (accountName) => {
    const label = accountName ? `de la cuenta "${accountName}"` : "de TODAS las cuentas"
    if (await showConfirm(`¿Eliminar todos los trades ${label}? Esta acción no se puede deshacer.`, { title: "Eliminar trades", confirmLabel: "Eliminar todo", danger: true })) {
      if (accountName) {
        setTrades((prev) => prev.filter((t) => t.account !== accountName))
        await supabase.from("trades").delete().eq("user_id", userId).eq("account", accountName)
      } else {
        setTrades([])
        await supabase.from("trades").delete().eq("user_id", userId)
      }
    }
  }

  const importTrades = async (newTrades) => {
    const ts = crypto.randomUUID()
    const mapped = newTrades.map((t, i) => ({ id: ts + i, ...t }))
    setTrades((prev) => [...mapped, ...prev])
    const payloads = mapped.map((t) => { const { id: _tid, ...p } = fromTrade(t, userId); return p })
    const { data, error } = await supabase.from("trades").insert(payloads).select()
    if (error) {
      console.error("[importTrades insert]", error)
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
    await supabase.from("trades").delete().eq("user_id", userId).eq("account", accountName)
    const payloads = mapped.map((t) => { const { id: _tid, ...p } = fromTrade(t, userId); return p })
    const { data, error } = await supabase.from("trades").insert(payloads).select()
    if (error) {
      console.error("[replaceAccountTrades]", error)
      showToast("No se pudo actualizar el historial de la cuenta.")
      return { ok: false, error }
    } else if (data) {
      const tempIds = new Set(mapped.map((t) => t.id))
      setTrades((prev) => [...data.map(toTrade), ...prev.filter((t) => !tempIds.has(t.id))])
    }
    return { ok: true }
  }

  const appendAccountTrades = async (accountName, newTrades) => {
    const existing = trades.filter((t) => t.account === accountName)
    const existingKeys = new Set(
      existing.map((t) => `${t.date}|${t.openTime}|${t.symbol}|${t.type}|${t.profit}`)
    )
    const toInsert = newTrades.filter(
      (t) => !existingKeys.has(`${t.date}|${t.openTime}|${t.symbol}|${t.type}|${t.profit}`)
    )
    const duplicates = newTrades.length - toInsert.length
    if (toInsert.length === 0) return { ok: true, inserted: 0, duplicates }
    const ts = crypto.randomUUID()
    const mapped = toInsert.map((t, i) => ({ id: ts + i, ...t, account: accountName }))
    setTrades((prev) => [...mapped, ...prev])
    const payloads = mapped.map((t) => { const { id: _tid, ...p } = fromTrade(t, userId); return p })
    const { data, error } = await supabase.from("trades").insert(payloads).select()
    if (error) {
      console.error("[appendAccountTrades]", error)
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
    const { data, error } = await supabase.from("accounts").insert(payload).select().single()
    if (error) {
      console.error("[createAccount]", error)
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
      ? `¿Eliminar la cuenta "${account?.name}" y sus ${tradeCount} trades asociados? Esta acción no se puede deshacer.`
      : `¿Eliminar la cuenta "${account?.name}"? Esta acción no se puede deshacer.`
    if (!await showConfirm(msg, { title: "Eliminar cuenta", confirmLabel: "Eliminar", danger: true })) return
    setAccounts((prev) => prev.filter((a) => a.id !== id))
    if (selectedAccountId && String(id) === selectedAccountId) setSelectedAccountId("")
    if (account && tradeCount > 0) {
      setTrades((prev) => prev.filter((t) => t.account !== account.name))
      await supabase.from("trades").delete().eq("user_id", userId).eq("account", account.name)
    }
    await supabase.from("accounts").delete().eq("id", id)
  }

  const updateAccount = async (updated) => {
    const backup = accounts.find((a) => a.id === updated.id)
    setAccounts((prev) => prev.map((a) => a.id === updated.id ? updated : a))
    const { error } = await supabase.from("accounts").update(fromAccount(updated, userId)).eq("id", updated.id)
    if (error) {
      console.error("[updateAccount]", error)
      if (backup) setAccounts((prev) => prev.map((a) => a.id === updated.id ? backup : a))
      showToast("No se pudo actualizar la cuenta.")
    }
  }

  // ── Withdrawals ─────────────────────────────────────────────────

  const addWithdrawal = async (w) => {
    const tempId = w.id
    setWithdrawals((prev) => [w, ...prev])
    const { id: _id, ...payload } = fromWithdrawal(w, userId)
    const { data, error } = await supabase.from("withdrawals").insert(payload).select().single()
    if (error) {
      console.error("[addWithdrawal]", error)
      setWithdrawals((prev) => prev.filter((x) => x.id !== tempId))
      showToast("No se pudo guardar el retiro.")
    } else if (data) {
      setWithdrawals((prev) => prev.map((x) => x.id === tempId ? toWithdrawal(data) : x))
    }
  }

  const deleteWithdrawal = async (id) => {
    if (!await showConfirm("¿Eliminar este retiro? Esta acción no se puede deshacer.", { title: "Eliminar retiro", confirmLabel: "Eliminar", danger: true })) return
    const backup = withdrawals.find((w) => w.id === id)
    setWithdrawals((prev) => prev.filter((w) => w.id !== id))
    const { error } = await supabase.from("withdrawals").delete().eq("id", id)
    if (error) {
      console.error("[deleteWithdrawal]", error)
      if (backup) setWithdrawals((prev) => [backup, ...prev])
      showToast("No se pudo eliminar el retiro.")
    }
  }

  // ── Strategies ──────────────────────────────────────────────────

  const createStrategy = async (s) => {
    const tempId = crypto.randomUUID()
    const newStrategy = { id: tempId, ...s }
    setStrategies((prev) => [newStrategy, ...prev])
    const { id: _id, ...payload } = fromStrategy(newStrategy, userId)
    const { data, error } = await supabase.from("strategies").insert(payload).select().single()
    if (error) {
      console.error("[createStrategy]", error)
      setStrategies((prev) => prev.filter((x) => x.id !== tempId))
      showToast("No se pudo crear la estrategia.")
    } else if (data) {
      setStrategies((prev) => prev.map((x) => x.id === tempId ? toStrategy(data) : x))
    }
  }

  const deleteStrategy = async (id) => {
    if (!await showConfirm("¿Eliminar esta estrategia? Esta acción no se puede deshacer.", { title: "Eliminar estrategia", confirmLabel: "Eliminar", danger: true })) return
    const backup = strategies.find((s) => s.id === id)
    setStrategies((prev) => prev.filter((s) => s.id !== id))
    const { error } = await supabase.from("strategies").delete().eq("id", id)
    if (error) {
      console.error("[deleteStrategy]", error)
      if (backup) setStrategies((prev) => [backup, ...prev])
      showToast("No se pudo eliminar la estrategia.")
    }
  }

  return {
    trades, accounts, withdrawals, strategies,
    selectedAccountId, setSelectedAccountId,
    loadData,
    addTrade, deleteTrade, deleteManyTrades, clearAllTrades, importTrades, replaceAccountTrades, appendAccountTrades,
    createAccount, deleteAccount, updateAccount,
    addWithdrawal, deleteWithdrawal,
    createStrategy, deleteStrategy,
  }
}
