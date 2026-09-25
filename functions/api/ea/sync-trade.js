// Recibe trades del EA de MT5 / Strategy de NinjaTrader y los inserta en Supabase.
// El EA/Strategy ya NO conoce la service_role key: solo un token de sync de bajo
// privilegio (EA_SYNC_TOKEN). La service_role key vive únicamente en las env vars
// de Cloudflare Pages y se usa aquí, server-side.
// POST /api/ea/sync-trade
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function onRequestPost(context) {
  const { env, request } = context
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EA_SYNC_TOKEN } = env

  if (!EA_SYNC_TOKEN) {
    return json({ error: "server_not_configured" }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: "invalid_json" }, 400)
  }

  const { token, id, userId, symbol, type, profit, date, openTime, account, note, entryImages } = body || {}

  if (token !== EA_SYNC_TOKEN) {
    return json({ error: "invalid_token" }, 401)
  }
  if (!userId || !UUID_RE.test(userId)) {
    return json({ error: "invalid_user_id" }, 400)
  }
  if (!symbol || !type || !account) {
    return json({ error: "missing_fields" }, 400)
  }
  if (typeof profit !== "number" || !Number.isFinite(profit)) {
    return json({ error: "invalid_profit" }, 400)
  }

  const row = {
    user_id: String(userId),
    symbol: String(symbol).slice(0, 64),
    type: String(type).slice(0, 16),
    profit,
    date: date ? String(date).slice(0, 32) : null,
    open_time: openTime ? String(openTime).slice(0, 32) : null,
    account: String(account).slice(0, 128),
    note: note ? String(note).slice(0, 256) : null,
    strategy: "",
    setup_quality: null,
    images: [],
    entry_note: null,
    entry_images: Array.isArray(entryImages) ? entryImages : [],
  }
  if (Number.isFinite(id)) row.id = id

  const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/trades`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify(row),
  })

  if (!sbRes.ok) {
    console.error("sync-trade insert error:", await sbRes.text())
    return json({ error: "db_error" }, 502)
  }

  return json({ ok: true })
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
