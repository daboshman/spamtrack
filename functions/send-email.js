import Anthropic from "@anthropic-ai/sdk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { to, subject, body, attachment } = payload;
  if (!to || !subject || !body) {
    return json({ error: "Missing required fields: to, subject, body" }, 400);
  }

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);
  }
  if (!env.GMAIL_MCP_URL || !env.GMAIL_OAUTH_TOKEN) {
    return json({ error: "GMAIL_MCP_URL or GMAIL_OAUTH_TOKEN not configured" }, 500);
  }

  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    // Build the instruction for Claude to draft via Gmail MCP
    let prompt = `Create a Gmail draft email with the following details.

To: ${to}
Subject: ${subject}
Body (Hebrew, direction right-to-left):
${body}`;

    if (attachment) {
      // Pass filename and first 200 chars of base64 as hint; the MCP tool receives full data via tool input
      prompt += `\n\nAttach the file "${attachment.filename}" (MIME type: ${attachment.mimeType}, base64-encoded content provided separately as tool input).`;
    }

    prompt += "\n\nUse the Gmail create_draft tool to create this draft now. Do not send — draft only.";

    const mcpCall = await client.beta.messages.create(
      {
        model: "claude-opus-4-7",
        max_tokens: 1024,
        mcp_servers: [
          {
            type: "url",
            url: env.GMAIL_MCP_URL,
            name: "gmail",
            authorization_token: env.GMAIL_OAUTH_TOKEN,
          },
        ],
        messages: [
          {
            role: "user",
            content: attachment
              ? [
                  { type: "text", text: prompt },
                  {
                    type: "text",
                    text: `Attachment base64 data for "${attachment.filename}": ${attachment.data}`,
                  },
                ]
              : [{ type: "text", text: prompt }],
          },
        ],
      },
      { headers: { "anthropic-beta": "mcp-client-2025-04-04" } }
    );

    const usedTool = mcpCall.content.some((b) => b.type === "tool_use");
    const text = mcpCall.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ");

    return json({ success: true, toolUsed: usedTool, message: text });
  } catch (err) {
    return json({ error: err.message || "Internal server error" }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
