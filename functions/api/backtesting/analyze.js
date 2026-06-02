export async function onRequestPost(context) {
  const { request, env } = context

  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { image, mediaType } = body
  if (!image) {
    return new Response(JSON.stringify({ error: "Missing image" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
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
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: image,
              },
            },
            {
              type: "text",
              text: `This is a trading backtesting calendar. Extract the daily P&L (profit and loss) for each trading day shown.

Return ONLY a valid JSON array. No explanation, no markdown, just the raw array:
[{"date": "YYYY-MM-DD", "pnl": number}, ...]

Rules:
- Include every day that has a numeric value (positive or negative)
- pnl must be a plain number without currency symbols (e.g. 250.50 or -180.00)
- If values appear as percentages (e.g. +1.5%), return them as decimals (e.g. 1.5)
- Skip empty cells or days with no trading activity
- Infer the year and month from the calendar header; if not visible use the most recent logical date
- Output dates in YYYY-MM-DD format`,
            },
          ],
        },
      ],
    }),
  })

  if (!claudeRes.ok) {
    const errText = await claudeRes.text()
    return new Response(JSON.stringify({ error: `Claude API error: ${errText}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    })
  }

  const claudeData = await claudeRes.json()
  const rawText = claudeData.content?.[0]?.text || "[]"

  const match = rawText.match(/\[[\s\S]*\]/)
  let days = []
  if (match) {
    try {
      days = JSON.parse(match[0])
    } catch {
      days = []
    }
  }

  return new Response(JSON.stringify({ days }), {
    headers: { "Content-Type": "application/json" },
  })
}
