// Minimal email sender via Resend HTTP API.
// Inert unless RESEND_API_KEY is set in Railway.
async function sendEmail({ to, subject, html, attachments }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { skipped: true };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'NazAQ CRM <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
        ...(attachments && attachments.length ? { attachments } : {}),
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { console.error('[MAIL] send failed:', r.status, JSON.stringify(body)); return { error: body }; }
    console.log(`[MAIL] sent "${subject}" to ${to}`);
    return { ok: true };
  } catch (err) {
    console.error('[MAIL] error:', err.message);
    return { error: err.message };
  }
}

module.exports = { sendEmail };
