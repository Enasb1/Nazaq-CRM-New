const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { decryptStudent, encryptStudent } = require('../utils/encryption');
const { renderContractHtml } = require('../utils/contractTemplate');
const { diffFields } = require('../utils/auditDiff');
const { sendEmail } = require('../utils/mailer');

// ── CRM side (authenticated) ──────────────────────────
const regRouter = express.Router();
regRouter.use(requireAuth);

// POST /api/registrations  { student_id } → create signing link
regRouter.post('/', async (req, res) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'student_id is required' });
    const token = crypto.randomBytes(24).toString('hex');
    const { data, error } = await supabase
      .from('registrations')
      .insert({ student_id, token, status: 'pending', created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    const { data: st } = await supabase.from('students').select('fname,lname').eq('id', student_id).single();
    await auditLog(req.user.id, req.user.username, `Created signing link: ${((st?.fname||'')+' '+(st?.lname||'')).trim()}`, 'create', `Registration ${data.id}`);
    res.status(201).json({ id: data.id, token, status: data.status, created_at: data.created_at });
  } catch (err) {
    console.error('[REG] create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/registrations?student_id= → list (without heavy signature data)
regRouter.get('/', async (req, res) => {
  try {
    const { student_id } = req.query;
    if (!student_id) return res.status(400).json({ error: 'student_id is required' });
    const { data, error } = await supabase
      .from('registrations')
      .select('id, token, status, signed_name, signed_at, created_at')
      .eq('student_id', student_id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/registrations/:id/signature → the signature image (base64)
regRouter.get('/:id/signature', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('signature_data, signed_name, signed_at, status')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/registrations/:id/document → the full signed document
regRouter.get('/:id/document', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('contract_text, signature_data, signed_name, signed_at, status')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/registrations/:id → cancel an unsigned link
regRouter.delete('/:id', async (req, res) => {
  try {
    const { data: reg } = await supabase.from('registrations').select('status').eq('id', req.params.id).single();
    if (reg && reg.status === 'signed') return res.status(400).json({ error: 'לא ניתן למחוק טופס חתום' });
    const { error } = await supabase.from('registrations').delete().eq('id', req.params.id);
    if (error) throw error;
    await auditLog(req.user.id, req.user.username, 'Deleted signing link', 'delete', `Registration ${req.params.id}`);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Public signing side (token-based, rate-limited) ───
const regPublicRouter = express.Router();
const signLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'יותר מדי בקשות, נסה שוב מאוחר יותר' } });
regPublicRouter.use(signLimiter);

// GET /api/sign/:token → contract data for the signing page
regPublicRouter.get('/:token', async (req, res) => {
  try {
    const { data: reg, error } = await supabase.from('registrations').select('*').eq('token', req.params.token).single();
    if (error || !reg) return res.status(404).json({ error: 'קישור לא תקין' });
    const { data: stRaw } = await supabase.from('students').select('*').eq('id', reg.student_id).single();
    if (!stRaw) return res.status(404).json({ error: 'קישור לא תקין' });
    const st = decryptStudent(stRaw);
    const isParentLead = (st.lead_type === 'parent');
    res.json({
      status: reg.status,
      signed_at: reg.signed_at,
      lead_type: st.lead_type || 'student',
      student: isParentLead
        ? { fname: '', lname: '', id_number: '', phone1: '' } // CRM holds the PARENT's details — student fills their own
        : { fname: st.fname || '', lname: st.lname || '', id_number: st.id_number || '', phone1: st.phone1 || '' },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sign/:token → submit the signature (+ corrected details, + full document snapshot)
regPublicRouter.post('/:token', async (req, res) => {
  try {
    const { signature, agree, details } = req.body;
    const d = details || {};
    const fullName = String(d.full_name || '').trim().substring(0, 120);
    const idNum = String(d.id_number || '').replace(/\D/g, '');
    const phone = String(d.phone || '').replace(/\D/g, '');
    if (!agree) return res.status(400).json({ error: 'يجب الموافقة على شروط الاتفاقية' });
    if (fullName.length < 2) return res.status(400).json({ error: 'يرجى كتابة الاسم الكامل' });
    if (idNum && idNum.length !== 9) return res.status(400).json({ error: 'رقم الهوية يجب أن يتكون من 9 أرقام' });
    if (phone && (phone.length < 9 || phone.length > 10)) return res.status(400).json({ error: 'يرجى إدخال رقم هاتف صحيح' });
    if (!signature || !String(signature).startsWith('data:image/png;base64,') || String(signature).length < 2000) {
      return res.status(400).json({ error: 'يرجى التوقيع في المكان المخصص' });
    }
    if (String(signature).length > 300000) return res.status(400).json({ error: 'التوقيع كبير جدًا' });

    const { data: reg } = await supabase.from('registrations').select('*').eq('token', req.params.token).single();
    if (!reg) return res.status(404).json({ error: 'קישור לא תקין' });
    if (reg.status === 'signed') return res.status(400).json({ error: 'הטופס כבר נחתם' });

    const signedAt = new Date().toISOString();
    const signedAtIL = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
    const contractText = renderContractHtml({ full_name: fullName, id_number: idNum, phone, signed_name: fullName, signed_at_il: signedAtIL });

    const baseUpdate = {
      status: 'signed',
      signed_name: fullName,
      signature_data: signature,
      signed_at: signedAt,
    };
    // Try storing the full document; fall back gracefully if the columns don't exist yet
    let upd = await supabase.from('registrations').update({ ...baseUpdate, contract_text: contractText, student_details: { full_name: fullName, id_number: idNum ? 'עודכן' : '', phone } }).eq('id', reg.id).select('id, signed_at').single();
    if (upd.error) upd = await supabase.from('registrations').update(baseUpdate).eq('id', reg.id).select('id, signed_at').single();
    if (upd.error) throw upd.error;

    // Sync corrections back to the student record + move status to 'signed'
    try {
      const { data: stRaw } = await supabase.from('students').select('*').eq('id', reg.student_id).single();
      if (stRaw) {
        const st = decryptStudent(stRaw);
        if (st.lead_type === 'parent') {
          // Keep the parent's contact details intact; just move the status forward
          if (st.status !== 'registered') {
            let su = await supabase.from('students').update({ status: 'signed', updated_at: new Date().toISOString() }).eq('id', reg.student_id).select('id').single();
            if (su.error) console.error('[REG] parent-lead status update error:', su.error.message);
          }
          await auditLog(null, 'student-signature', `Contract signed (parent lead): ${fullName}`, 'create', `פרטי התלמיד בטופס בלבד — פרטי ההורה בכרטיס נשמרו`);
        } else {
        const parts = fullName.split(/\s+/);
        const newFname = parts[0] || st.fname;
        const newLname = parts.slice(1).join(' ');
        const changes = {};
        if (newFname && newFname !== (st.fname || '')) changes.fname = newFname;
        if (newLname !== (st.lname || '')) changes.lname = newLname;
        if (idNum && idNum !== (st.id_number || '')) changes.id_number = idNum;
        if (phone && phone !== (st.phone1 || '')) changes.phone1 = phone;
        if (st.status !== 'registered') changes.status = 'signed';
        if (Object.keys(changes).length) {
          const diff = diffFields(st, changes);
          const enc = encryptStudent({ ...changes, updated_at: new Date().toISOString() });
          let stUpd = await supabase.from('students').update(enc).eq('id', reg.student_id).select('id').single();
          if (stUpd.error) {
            console.error('[REG] student update error:', stUpd.error.message);
            const { status, ...rest } = changes; // retry without status if the value is rejected
            if (Object.keys(rest).length) await supabase.from('students').update(encryptStudent({ ...rest, updated_at: new Date().toISOString() })).eq('id', reg.student_id).select('id').single();
          }
          if (diff) await auditLog(null, 'student-signature', `Student updated own details: ${fullName}`, 'edit', diff);
        }
        }
      }
    } catch (e) { console.error('[REG] student sync error:', e.message); }

    await auditLog(null, 'student-signature', `Contract signed: ${fullName}`, 'create', `Registration ${reg.id} · ${signedAtIL}`);

    // Email the signed contract to the company inbox (inert until RESEND_API_KEY + CONTRACT_EMAIL are set)
    const contractEmail = process.env.CONTRACT_EMAIL || process.env.REPORT_EMAIL;
    if (process.env.RESEND_API_KEY && contractEmail) {
      const filledHtml = contractText
        .replaceAll('__ORIGIN__', 'https://nazaq.org')
        .replaceAll('__SIGNATURE_IMG__', signature);
      const esc = (x) => String(x || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      sendEmail({
        to: contractEmail,
        subject: `✍️ חוזה נחתם — ${fullName}`,
        html: `<div dir="rtl" style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A1A1A">
          <h2 style="background:#EEBE50;padding:12px 16px;border-radius:10px">✍️ נחתם טופס הרשמה חדש</h2>
          <table style="font-size:14px;border-collapse:collapse">
            <tr><td style="padding:4px 8px;font-weight:700">שם:</td><td style="padding:4px 8px">${esc(fullName)}</td></tr>
            <tr><td style="padding:4px 8px;font-weight:700">ת.ז:</td><td style="padding:4px 8px" dir="ltr">${esc(idNum) || '—'}</td></tr>
            <tr><td style="padding:4px 8px;font-weight:700">טלפון:</td><td style="padding:4px 8px" dir="ltr">${esc(phone) || '—'}</td></tr>
            <tr><td style="padding:4px 8px;font-weight:700">מועד חתימה:</td><td style="padding:4px 8px">${esc(signedAtIL)}</td></tr>
          </table>
          <p style="color:#555;font-size:13px">המסמך החתום המלא מצורף כקובץ (נפתח בדפדפן). הוא שמור גם במערכת ה-CRM בכרטיס התלמיד.</p>
        </div>`,
        attachments: [{
          filename: `contract-signed-${fullName.replace(/[^\p{L}\p{N} _-]/gu, '').substring(0, 40) || 'student'}.html`,
          content: Buffer.from(filledHtml, 'utf8').toString('base64'),
        }],
      }).catch(() => {});
    }

    res.json({ success: true, signed_at: signedAt });
  } catch (err) {
    console.error('[REG] sign error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { regRouter, regPublicRouter };
