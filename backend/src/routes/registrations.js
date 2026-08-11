const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { decryptStudent } = require('../utils/encryption');

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
    res.json({
      status: reg.status,
      signed_at: reg.signed_at,
      student: {
        fname: st.fname || '', lname: st.lname || '',
        id_number: st.id_number || '', phone1: st.phone1 || '',
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/sign/:token → submit the signature
regPublicRouter.post('/:token', async (req, res) => {
  try {
    const { signed_name, signature, agree } = req.body;
    if (!agree) return res.status(400).json({ error: 'يجب الموافقة على شروط الاتفاقية' });
    if (!signed_name || String(signed_name).trim().length < 2) return res.status(400).json({ error: 'يرجى كتابة الاسم الكامل' });
    if (!signature || !String(signature).startsWith('data:image/png;base64,') || String(signature).length < 2000) {
      return res.status(400).json({ error: 'يرجى التوقيع في المكان المخصص' });
    }
    if (String(signature).length > 300000) return res.status(400).json({ error: 'التوقيع كبير جدًا' });
    const { data: reg } = await supabase.from('registrations').select('*').eq('token', req.params.token).single();
    if (!reg) return res.status(404).json({ error: 'קישור לא תקין' });
    if (reg.status === 'signed') return res.status(400).json({ error: 'הטופס כבר נחתם' });
    const { data, error } = await supabase.from('registrations').update({
      status: 'signed',
      signed_name: String(signed_name).trim().substring(0, 120),
      signature_data: signature,
      signed_at: new Date().toISOString(),
    }).eq('id', reg.id).select('id, status, signed_at').single();
    if (error) throw error;
    const { data: st } = await supabase.from('students').select('fname,lname').eq('id', reg.student_id).single();
    await auditLog(null, 'student-signature', `Contract signed: ${((st?.fname||'')+' '+(st?.lname||'')).trim()}`, 'create', `Registration ${reg.id} · ${String(signed_name).trim().substring(0, 60)}`);
    res.json({ success: true, signed_at: data.signed_at });
  } catch (err) {
    console.error('[REG] sign error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { regRouter, regPublicRouter };
