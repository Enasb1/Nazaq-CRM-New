// Daily activity report by email.
// Activates ONLY when both env vars are set in Railway:
//   RESEND_API_KEY  — API key from resend.com
//   REPORT_EMAIL    — where to send the daily report
// Optional: REPORT_HOUR_UTC (default 4 → 07:00 Israel time in summer)
const supabase = require('../config/supabase');

const TYPE_HE = { login: 'כניסה', logout: 'יציאה', create: 'הוספה', edit: 'עריכה', delete: 'מחיקה', security: 'אבטחה' };
let lastSentDate = null;

function buildHtml(rows, since) {
  const byUser = {};
  rows.forEach((r) => {
    const u = r.username || '?';
    byUser[u] = byUser[u] || { total: 0, types: {}, items: [] };
    byUser[u].total++;
    byUser[u].types[r.type] = (byUser[u].types[r.type] || 0) + 1;
    if (byUser[u].items.length < 60) byUser[u].items.push(r);
  });
  const esc = (x) => String(x || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let html = `<div dir="rtl" style="font-family:Segoe UI,Arial,sans-serif;max-width:700px;margin:0 auto;color:#1A1A1A">
    <h2 style="background:#F5C518;padding:12px 16px;border-radius:10px">📋 NazAQ — דוח פעילות יומי</h2>
    <p style="color:#555">כל הפעולות מאז ${since.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })} · סה"כ ${rows.length} פעולות</p>`;
  if (!rows.length) html += `<p>לא נרשמה פעילות ביממה האחרונה.</p>`;
  for (const [u, d] of Object.entries(byUser)) {
    const summary = Object.entries(d.types).map(([t, n]) => `${TYPE_HE[t] || t}: ${n}`).join(' · ');
    html += `<h3 style="margin:18px 0 6px">👤 ${esc(u)} <span style="font-weight:400;color:#777;font-size:13px">(${summary})</span></h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">`;
    d.items.forEach((r) => {
      html += `<tr style="border-bottom:1px solid #eee">
        <td style="padding:5px 8px;white-space:nowrap;color:#999" dir="ltr">${esc(String(r.created_at || '').substring(5, 16).replace('T', ' '))}</td>
        <td style="padding:5px 8px">${TYPE_HE[r.type] || esc(r.type)} — ${esc(r.action)}</td>
        <td style="padding:5px 8px;color:#777">${esc(r.detail)}</td></tr>`;
    });
    html += `</table>`;
    if (d.total > 60) html += `<p style="color:#999;font-size:12px">…ועוד ${d.total - 60} פעולות (ניתן לצפות בכולן בפאנל הניהול)</p>`;
  }
  html += `<p style="color:#999;font-size:12px;margin-top:20px">נשלח אוטומטית ממערכת NazAQ CRM · הדוח המלא: פאנל הניהול ← יומן פעילות</p></div>`;
  return html;
}

async function sendDailyReport() {
  const key = process.env.RESEND_API_KEY, to = process.env.REPORT_EMAIL;
  if (!key || !to) return;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { data, error } = await supabase.from('audit_log').select('*')
    .gte('created_at', since.toISOString()).order('created_at', { ascending: false }).range(0, 499);
  if (error) { console.error('[DAILY REPORT] read error:', error.message); return; }
  const rows = data || [];
  const dateStr = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'NazAQ CRM <onboarding@resend.dev>',
        to: [to],
        subject: `📋 NazAQ דוח פעילות יומי — ${dateStr} (${rows.length} פעולות)`,
        html: buildHtml(rows, since),
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) console.error('[DAILY REPORT] send failed:', r.status, JSON.stringify(body));
    else console.log(`[DAILY REPORT] sent to ${to} (${rows.length} entries)`);
  } catch (err) {
    console.error('[DAILY REPORT] error:', err.message);
  }
}

function start() {
  if (!process.env.RESEND_API_KEY || !process.env.REPORT_EMAIL) {
    console.log('[DAILY REPORT] inactive (set RESEND_API_KEY + REPORT_EMAIL in Railway to enable)');
    return;
  }
  const targetHour = Number(process.env.REPORT_HOUR_UTC ?? 4); // 4 UTC ≈ 07:00 Israel (summer)
  console.log(`[DAILY REPORT] active — will send daily at ${targetHour}:00 UTC to ${process.env.REPORT_EMAIL}`);
  setInterval(() => {
    const now = new Date();
    const today = now.toISOString().substring(0, 10);
    if (now.getUTCHours() === targetHour && lastSentDate !== today) {
      lastSentDate = today;
      sendDailyReport();
    }
  }, 10 * 60 * 1000); // check every 10 minutes
}

module.exports = { start, sendDailyReport, buildHtml };
