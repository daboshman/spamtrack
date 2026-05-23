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

  if (!env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.GMAIL_REFRESH_TOKEN) {
    return json({ error: "Gmail credentials not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN in Cloudflare secrets." }, 500);
  }

  try {
    // Exchange refresh token for a fresh access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GMAIL_CLIENT_ID,
        client_secret: env.GMAIL_CLIENT_SECRET,
        refresh_token: env.GMAIL_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return json({ error: `Failed to get access token: ${tokenData.error_description ?? JSON.stringify(tokenData)}` }, 500);
    }

    const raw = buildMimeMessage({ to, subject, body, attachment });

    // Create a Gmail draft (not send)
    const draftRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: { raw } }),
    });

    if (!draftRes.ok) {
      const errText = await draftRes.text();
      return json({ error: `Gmail API error: ${errText}` }, 500);
    }

    const draft = await draftRes.json();
    return json({ success: true, draftId: draft.id });
  } catch (err) {
    return json({ error: err.message || "Internal server error" }, 500);
  }
}

// Build a base64url-encoded RFC 2822 MIME message for the Gmail API `raw` field.
function buildMimeMessage({ to, subject, body, attachment }) {
  const boundary = `boundary_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

  const encodeB64 = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  };

  const subjectEncoded = `=?UTF-8?B?${encodeB64(subject)}?=`;

  let mime =
    `To: ${to}\r\n` +
    `Subject: ${subjectEncoded}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: multipart/mixed; boundary="${boundary}"\r\n` +
    `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n` +
    `Content-Transfer-Encoding: base64\r\n` +
    `\r\n` +
    // wrap at 76 chars per RFC 2045
    (encodeB64(body).match(/.{1,76}/g) ?? []).join("\r\n") +
    `\r\n`;

  if (attachment) {
    const filenameEncoded = `=?UTF-8?B?${encodeB64(attachment.filename)}?=`;
    const wrappedData = (attachment.data.match(/.{1,76}/g) ?? []).join("\r\n");
    mime +=
      `--${boundary}\r\n` +
      `Content-Type: ${attachment.mimeType}\r\n` +
      `Content-Disposition: attachment; filename="${filenameEncoded}"\r\n` +
      `Content-Transfer-Encoding: base64\r\n` +
      `\r\n` +
      wrappedData +
      `\r\n`;
  }

  mime += `--${boundary}--`;

  // base64url-encode the complete MIME message
  const mimeBytes = new TextEncoder().encode(mime);
  let mimeBin = "";
  mimeBytes.forEach((b) => (mimeBin += String.fromCharCode(b)));
  return btoa(mimeBin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
