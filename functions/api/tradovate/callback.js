// Maneja el redirect de Tradovate tras autorizar el OAuth
// GET /api/tradovate/callback?code=XXX&state=<userId>
const LIVE_API = "https://live.tradovateapi.com"

export async function onRequestGet(context) {
  const { env, request } = context
  const url = new URL(request.url)

  const code   = url.searchParams.get("code")
  const userId = url.searchParams.get("state")
  const error  = url.searchParams.get("error")

  const appBase = env.TRADOVATE_REDIRECT_URI
    ? env.TRADOVATE_REDIRECT_URI.replace("/api/tradovate/callback", "")
    : "https://global-sairu.pages.dev"
  const redirectUri =
    env.TRADOVATE_REDIRECT_URI ||
    `${appBase}/api/tradovate/callback`

  const fail = (reason) =>
    Response.redirect(
      `${appBase}/?tradovate=error&reason=${encodeURIComponent(reason)}`,
      302
    )

  if (error || !code || !userId) {
    return fail(error || "missing_params")
  }

  const {
    TRADOVATE_CLIENT_ID,
    TRADOVATE_CLIENT_SECRET,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = env

  try {
    // 1. Intercambiar código por tokens
    const tokenRes = await fetch(`${LIVE_API}/auth/oauthtoken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: TRADOVATE_CLIENT_ID,
        client_secret: TRADOVATE_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", await tokenRes.text())
      return fail("token_exchange_failed")
    }

    const { access_token, refresh_token, expires_in } = await tokenRes.json()
    const expiresAt = new Date(
      Date.now() + (expires_in || 3600) * 1000
    ).toISOString()

    // 2. Obtener cuentas del usuario en Tradovate
    const accountsRes = await fetch(`${LIVE_API}/v1/account/list`, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    const rawAccounts = accountsRes.ok ? await accountsRes.json() : []
    const accounts = Array.isArray(rawAccounts)
      ? rawAccounts.map((a) => ({ id: a.id, name: a.name, active: !!a.active }))
      : []

    // 3. Upsert en Supabase (una fila por usuario — UNIQUE user_id)
    const sbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/tradovate_connections`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          user_id: userId,
          access_token,
          refresh_token: refresh_token || null,
          token_expires_at: expiresAt,
          tradovate_accounts: accounts,
        }),
      }
    )

    if (!sbRes.ok) {
      console.error("Supabase upsert error:", await sbRes.text())
      return fail("db_error")
    }

    return Response.redirect(`${appBase}/?tradovate=success`, 302)
  } catch (e) {
    console.error("Callback exception:", e)
    return fail("server_error")
  }
}
