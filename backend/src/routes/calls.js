const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(requireAuth);

// GET /calls
router.get('/', async (req, res) => {
  try {
    const { search, followup, student_id, page = 1, limit = 200 } = req.query;
    const offset = (page - 1) * limit;
    let q = supabase.from('calls').select('*', { count: 'exact' });
    if (student_id) q = q.eq('student_id', student_id);
    if (followup) q = q.eq('followup', followup);
    if (search) q = q.or(`fname.ilike.%${search}%,lname.ilike.%${search}%,phone.ilike.%${search}%`);
    q = q.order('datetime', { ascending: false }).range(offset, offset + Number(limit) - 1);
    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ data: data || [], total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /calls/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('calls').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Call not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /calls — create (also used by Android app)
router.post('/', async (req, res) => {
  try {
    const cleaned = {};
    for (const [k, v] of Object.entries(req.body)) cleaned[k] = (v === '') ? null : v;
    const callData = {
      ...cleaned,
      created_at: new Date().toISOString(),
      created_by: req.user.id,
      caller: req.body.caller || req.user.username
    };
    const { data, error } = await supabase.from('calls').insert(callData).select().single();
    if (error) {
      console.error('[CREATE CALL] Supabase error:', error.message, '| details:', error.details, '| hint:', error.hint);
      throw error;
    }
    await auditLog(req.user.id, req.user.username, `Logged call: ${req.body.fname||''} ${req.body.lname||''}`, 'create', `Phone: ${req.body.phone}`);
    res.status(201).json(data);
  } catch (err) {
    console.error('Create call error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /calls/:id
router.put('/:id', async (req, res) => {
  try {
    const cleaned = {};
    for (const [k, v] of Object.entries(req.body)) cleaned[k] = (v === '') ? null : v;
    const { data, error } = await supabase.from('calls').update({ ...cleaned, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Call not found' });
    await auditLog(req.user.id, req.user.username, `Updated call record`, 'edit', `ID: ${req.params.id}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /calls/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('calls').delete().eq('id', req.params.id);
    if (error) throw error;
    await auditLog(req.user.id, req.user.username, `Deleted call record`, 'delete', `ID: ${req.params.id}`);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
