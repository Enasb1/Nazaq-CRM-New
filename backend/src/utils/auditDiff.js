// Builds a human-readable, Hebrew "what changed" string for audit logs.
const HEB = {
  fname:'שם פרטי', lname:'שם משפחה', phone1:'טלפון 1', phone2:'טלפון 2', email:'אימייל',
  parent_email:'אימייל הורה', parent_name:'שם הורה', parent_phone:'טלפון הורה', id_number:'ת.ז',
  birthdate:'תאריך לידה', age:'גיל', city:'עיר', address:'כתובת', status:'סטטוס', semester_id:'סמסטר',
  how_heard:'איך שמעו עלינו', school:'בית ספר', bagrut:'בגרות', comments:'הערות',
  appointment_at:'מועד פגישה', lead_type:'סוג פנייה', source:'מקור', lead_date:'תאריך פנייה',
  details:'פרטי השיחה', followup:'מעקב', followup_date:'תאריך מעקב', followup_done:'מעקב בוצע',
  datetime:'תאריך ושעה', direction:'כיוון שיחה', caller:'מבצע השיחה', phone:'טלפון',
  meeting_at:'מועד פגישה', summary:'סיכום פגישה',
};
const SENSITIVE = new Set(['id_number']); // never write these values into the log
const SKIP = new Set(['updated_at', 'created_at', 'id', 'student_id']);

function diffFields(oldObj, newObj) {
  const parts = [];
  const trunc = (x) => { const s = String(x ?? '—'); return s.length > 40 ? s.substring(0, 40) + '…' : s; };
  for (const [k, v] of Object.entries(newObj || {})) {
    if (SKIP.has(k)) continue;
    const nv = v === '' ? null : v;
    const ov = oldObj ? (oldObj[k] === '' ? null : oldObj[k]) : undefined;
    if (String(ov ?? '') === String(nv ?? '')) continue;
    const label = HEB[k] || k;
    if (SENSITIVE.has(k)) { parts.push(`${label}: עודכן`); continue; }
    parts.push(`${label}: "${trunc(ov)}" → "${trunc(nv)}"`);
  }
  let out = parts.join('  |  ');
  if (out.length > 450) out = out.substring(0, 450) + '…';
  return out;
}

module.exports = { diffFields };
