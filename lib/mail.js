'use strict';

/** Email notification through Resend's HTTP API (no SDK). Skipped when RESEND_API_KEY is empty. */
async function notify(mail, { subject, text, replyTo }) {
  if (!mail.apiKey) return { skipped: true };
  const res = await fetch(mail.apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${mail.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: mail.from, to: [mail.to], subject, text, reply_to: replyTo }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Mail API responded ${res.status}`);
  return { sent: true };
}

module.exports = { notify };
