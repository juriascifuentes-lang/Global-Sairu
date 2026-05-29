// Obtiene fills (ejecuciones) de Tradovate para una cuenta específica
// POST /api/tradovate/sync  { userId, tradovateAccountId }
const LIVE_API = "https://live.tradovateapi.com"

export async function onRequestPost(context) {
  const { env, request } = context
  const jsonHeaders = { "Content-Type": "application/json" }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: jsonHeaders }
    )
  }

  const { userId, tradovateAccountId } = body
  if (!userId || tradovateAccountId == null) {
    return new Response(
      JSON.stringify({ error: "Missing userId or tradovateAccountId" }),
      { status: 400, headers: jsonHeaders }
    )
  }

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    TRADOVATE_CLIENT_ID,
    TRADOVATE_CLIENT_SECRET,
  } = env

  const sbHeaders = {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  }

  // Cargar conexión del usuario
  const connRes = await fetch(
    `${SUPABASE_URL}/rest/v1/tradovate_connections?user_id=eq.${userId}&select=*`,
    { headers: sbHeaders }
  )
  const connections = await connRes.json()
  if (!connections.length) {
    return new Response(
      JSON.stringify({ error: "Connection not found" }),
      { status: 404, headers: jsonHeaders }
    )
  }

  let { id: connId, access_token, refresh_token, token_expires_at } = connections[0]

  // Refrescar token si vence en menos de 5 minutos
  if (new Date(token_expires_at) < new Date(Date.now() + 300_000)) {
    try {
      const refreshRes = await fetch(`${LIVE_API}/auth/oauthtoken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token,
          client_id: TRADOVATE_CLIENT_ID,
          client_secret: TRADOVATE_CLIENT_SECRET,
        }),
      })
      if (refreshRes.ok) {
        const rd = await refreshRes.json()
        access_token   = rd.access_token
        refresh_token  = rd.refresh_token || refresh_token
        token_expires_at = new Date(
          Date.now() + (rd.expires_in || 3600) * 1000
        ).toISOString()
        await fetch(
          `${SUPABASE_URL}/rest/v1/tradovate_connections?id=eq.${connId}`,
          {
            method: "PATCH",
            headers: sbHeaders,
            body: JSON.stringify({ access_token, refresh_token, token_expires_at }),
          }
        )
      }
    } catch (e) {
      console.warn("Token refresh warning:", e)
    }
  }

  const apiHeaders = { Authorization: `Bearer ${access_token}` }

  // Obtener fills de la cuenta
  const fillsRes = await fetch(
    `${LIVE_API}/v1/fill/list?accountId=${tradovateAccountId}`,
    { headers: apiHeaders }
  )
  const fills = fillsRes.ok ? await fillsRes.json() : []
  const fillsArr = Array.isArray(fills) ? fills : []

  // Obtener contratos únicos necesarios (para mapear contractId → símbolo)
  const uniqueIds = [...new Set(fillsArr.map((f) => f.contractId).filter(Boolean))]
  const contracts = await Promise.all(
    uniqueIds.map((id) =>
      fetch(`${LIVE_API}/v1/contract/item?id=${id}`, { headers: apiHeaders })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    )
  ).then((results) => results.filter(Boolean))

  // Actualizar last_sync_at
  await fetch(
    `${SUPABASE_URL}/rest/v1/tradovate_connections?id=eq.${connId}`,
    {
      method: "PATCH",
      headers: sbHeaders,
      body: JSON.stringify({ last_sync_at: new Date().toISOString() }),
    }
  )

  return new Response(
    JSON.stringify({ fills: fillsArr, contracts }),
    { headers: jsonHeaders }
  )
}
