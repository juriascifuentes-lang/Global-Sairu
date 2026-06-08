const PROMPT = `Analiza esta imagen. Puede ser un certificado de retiro/payout de una prop trading firm, o un historial/tabla de pagos (billing history, order history, facturación).

Extrae TODAS las transacciones financieras visibles. Para cada una determina:
- amount: el monto numérico (solo el número, sin símbolos)
- date: fecha en formato YYYY-MM-DD (si solo ves mes/año usa día 01; si ves solo año usa 01-01)
- description: descripción breve del producto o movimiento
- status: el estado tal como aparece en la imagen ("Pagado", "Completed", "Failed", "Reembolsado", etc.)
- valid: true SOLO si el estado es exitoso (Pagado, Completed, Paid, Success, Approved); false si es fallido o reembolsado (Failed, Reembolsado, Refunded, Cancelled, Rejected)
- type: "retiro" si es un pago HACIA el trader (payout, withdrawal, retiro); "examen" si es un pago DEL trader a la prop firm (challenge fee, evaluation, reset, subscription)

REGLA CRÍTICA para valid:
- Failed → valid: false
- Reembolsado / Refunded → valid: false
- Cancelled → valid: false
- Pagado / Completed / Paid / Success → valid: true

Calcula total_valid sumando SOLO los amounts donde valid=true.
Detecta el nombre de la empresa (FTMO, Lucid Trading, Topstep, Alpha Futures, etc.) si es visible.

Responde ÚNICAMENTE con JSON válido, sin markdown, sin explicaciones, sin bloques de código:
{"company":"nombre o null","transactions":[{"date":"2024-01-01","amount":123.45,"description":"...","status":"Completed","valid":true,"type":"examen"}],"total_valid":123.45}`

export async function onRequestPost(context) {
  const { request, env } = context

  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY no configurado en Cloudflare" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Body inválido" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const { imageBase64, mimeType } = body
  if (!imageBase64 || !mimeType) {
    return new Response(
      JSON.stringify({ error: "Faltan imageBase64 o mimeType" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: imageBase64 },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  })

  if (!claudeRes.ok) {
    const errText = await claudeRes.text()
    return new Response(
      JSON.stringify({ error: "Error Claude API", detail: errText }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    )
  }

  const claudeData = await claudeRes.json()
  const rawText = claudeData.content?.[0]?.text?.trim() ?? ""

  // Strip possible markdown fences
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()

  try {
    const parsed = JSON.parse(cleaned)
    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" },
    })
  } catch {
    return new Response(
      JSON.stringify({ error: "No se pudo parsear la respuesta", raw: rawText }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
