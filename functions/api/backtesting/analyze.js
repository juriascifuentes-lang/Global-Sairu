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

  const { image, mediaType, filename } = body
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
              text: `This is a FXReplay trading backtesting calendar. The filename is: "${filename || "unknown"}". Extract the daily P&L for each day that has trading activity.

Return ONLY a valid JSON array. No explanation, no markdown, just the raw array:
[{"date": "YYYY-MM-DD", "pnl": number}, ...]

IMPORTANT parsing rules:
- The YEAR and MONTH must come from the calendar header text (e.g. "May 2025", "Julio 2025"). The filename also contains the month and year — use it to confirm.
- Do NOT guess or invent the year. Only use what is clearly visible in the image header or filename.
- Values use European decimal format with comma: "-148,00 US$" means -148.00, "808,00 US$" means 808.00
- Strip currency symbols (US$, $, €) and convert comma decimal separator to dot
- pnl must be a plain JavaScript number (e.g. -148.00 or 808.00)
- Red/dark cells = negative P&L, Green cells = positive P&L
- Skip days with no number shown (empty cells, weekends without trades)
- Each cell shows the day number in the top-right corner — use that for the day
- Output dates as YYYY-MM-DD`,
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
