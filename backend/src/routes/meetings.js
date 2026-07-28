const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(requireAuth);

async function studentName(id) {
  if (!id) return '?';
  const { data } = await supabase.from('students').select('fname,lname').eq('id', id).single();
  return data ? `${data.fname || ''} ${data.lname || ''}`.trim() : String(id);
}
const fmtAt = (at) => String(at || '').substring(0, 16).replace('T', ' ');

// GET /meetings — all meetings (frontend joins student by student_id)
router.get('/', async (req, res) => {
  try {
    const { student_id, limit = 500 } = req.query;
    let q = supabase.from('meetings').select('*');
    if (student_id) q = q.eq('student_id', student_id);
    q = q.order('meeting_at', { ascending: false }).range(0, Number(limit) - 1);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /meetings — schedule a meeting
router.post('/', async (req, res) => {
  try {
    const { student_id, meeting_at, summary } = req.body;
    if (!student_id || !meeting_at) return res.status(400).json({ error: 'student_id and meeting_at are required' });
    const { data, error } = await supabase
      .from('meetings')
      .insert({ student_id, meeting_at, summary: summary || null, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    await auditLog(req.user.id, req.user.username, `Created meeting: ${await studentName(student_id)}`, 'create', `מועד הפגישה: ${fmtAt(meeting_at)}`);
    res.status(201).json(data);
  } catch (err) {
    console.error('[MEETINGS] create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /meetings/:id — update time and/or summary
router.put('/:id', async (req, res) => {
  try {
    const upd = {};
    if (req.body.meeting_at !== undefined) upd.meeting_at = req.body.meeting_at;
    if (req.body.summary !== undefined) upd.summary = req.body.summary;
    const { data, error } = await supabase.from('meetings').update(upd).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Meeting not found' });
    const what = [];
    if (req.body.meeting_at !== undefined) what.push(`מועד: ${fmtAt(req.body.meeting_at)}`);
    if (req.body.summary !== undefined) what.push(`סיכום: "${String(req.body.summary||'').substring(0,60)}${String(req.body.summary||'').length>60?'…':''}"`);
    await auditLog(req.user.id, req.user.username, `Updated meeting: ${await studentName(data.student_id)}`, 'edit', what.join('  |  ') || `Meeting ${req.params.id}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /meetings/:id
router.delete('/:id', async (req, res) => {
  try {
    const { data: m } = await supabase.from('meetings').select('student_id,meeting_at').eq('id', req.params.id).single();
    const { error } = await supabase.from('meetings').delete().eq('id', req.params.id);
    if (error) throw error;
    await auditLog(req.user.id, req.user.username, `Deleted meeting: ${await studentName(m?.student_id)}`, 'delete', m?`מועד הפגישה: ${fmtAt(m.meeting_at)}`:`Meeting ${req.params.id}`);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
