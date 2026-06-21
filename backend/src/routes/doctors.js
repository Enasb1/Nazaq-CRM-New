const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(requireAuth);

const clean = (body) => {
  const o = {};
  for (const [k, v] of Object.entries(body)) o[k] = (v === '') ? null : v;
  return o;
};

// ── COURSES ───────────────────────────────────────────
router.get('/courses', async (req, res) => {
  const { data, error } = await supabase.from('doctor_courses').select('*').order('start_date', { ascending: false });
  if (error) { console.error('[DR COURSES]', error.message); return res.status(500).json({ error: error.message }); }
  res.json(data || []);
});

router.post('/courses', async (req, res) => {
  const c = clean(req.body);
  const { data, error } = await supabase.from('doctor_courses').insert({ ...c, created_by: req.user.id }).select().single();
  if (error) { console.error('[DR COURSE CREATE]', error.message); return res.status(500).json({ error: error.message }); }
  await auditLog(req.user.id, req.user.username, `Created doctor course: ${req.body.name}`, 'create');
  res.status(201).json(data);
});

router.put('/courses/:id', async (req, res) => {
  const c = clean(req.body);
  const { data, error } = await supabase.from('doctor_courses').update(c).eq('id', req.params.id).select().single();
  if (error || !data) return res.status(404).json({ error: 'Course not found' });
  res.json(data);
});

router.delete('/courses/:id', async (req, res) => {
  const { error } = await supabase.from('doctor_courses').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── DOCTORS ───────────────────────────────────────────
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('doctors').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[DOCTORS]', error.message); return res.status(500).json({ error: error.message }); }
  res.json(data || []);
});

router.post('/', async (req, res) => {
  const c = clean(req.body);
  const doctorData = { ...c, reg_date: c.reg_date || new Date().toISOString(), created_by: req.user.id };
  const { data, error } = await supabase.from('doctors').insert(doctorData).select().single();
  if (error) { console.error('[DOCTOR CREATE]', error.message, error.details); return res.status(500).json({ error: error.message }); }
  // Auto-create a payments record for this doctor
  await supabase.from('doctor_payments').insert({ doctor_id: data.id, reg_fee_paid: 'no', payments: [] });
  await auditLog(req.user.id, req.user.username, `Added doctor: ${req.body.fname} ${req.body.lname}`, 'create');
  res.status(201).json(data);
});

router.put('/:id', async (req, res) => {
  const c = clean(req.body);
  const { data, error } = await supabase.from('doctors').update(c).eq('id', req.params.id).select().single();
  if (error || !data) return res.status(404).json({ error: 'Doctor not found' });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('doctors').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── PAYMENTS ──────────────────────────────────────────
router.get('/payments', async (req, res) => {
  const { data, error } = await supabase.from('doctor_payments').select('*');
  if (error) { console.error('[DR PAYMENTS]', error.message); return res.status(500).json({ error: error.message }); }
  res.json(data || []);
});

router.put('/payments/:doctorId', async (req, res) => {
  const c = clean(req.body);
  // Ensure payments is an array
  if (c.payments && typeof c.payments === 'string') {
    try { c.payments = JSON.parse(c.payments); } catch { c.payments = []; }
  }
  c.updated_at = new Date().toISOString();
  // Upsert by doctor_id
  const { data: existing } = await supabase.from('doctor_payments').select('id').eq('doctor_id', req.params.doctorId).limit(1);
  let result;
  if (existing && existing.length) {
    result = await supabase.from('doctor_payments').update(c).eq('doctor_id', req.params.doctorId).select().single();
  } else {
    result = await supabase.from('doctor_payments').insert({ ...c, doctor_id: req.params.doctorId }).select().single();
  }
  if (result.error) { console.error('[DR PAYMENT SAVE]', result.error.message); return res.status(500).json({ error: result.error.message }); }
  res.json(result.data);
});

module.exports = router;
