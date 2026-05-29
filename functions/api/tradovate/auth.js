// Inicia el flujo OAuth con Tradovate
// GET /api/tradovate/auth?userId=<supabase_user_id>
export async function onRequestGet(context) {
  const { env, request } = context
  const url = new URL(request.url)
  const userId = url.searchParams.get("userId")

  if (!userId) {
    return new Response("Missing userId", { status: 400 })
  }

  const clientId = env.TRADOVATE_CLIENT_ID
  if (!clientId) {
    return new Response("TRADOVATE_CLIENT_ID not configured", { status: 500 })
  }

  const redirectUri =
    env.TRADOVATE_REDIRECT_URI ||
    `https://global-sairu.pages.dev/api/tradovate/callback`

  const authUrl =
    `https://trader.tradovate.com/oauth` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(userId)}`

  return Response.redirect(authUrl, 302)
}
