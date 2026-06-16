const express = require('express');
const { body, query, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { encryptStudent, decryptStudent } = require('../utils/encryption');

const router = express.Router();
router.use(requireAuth);

// GET /students — list with search & filters
router.get('/', async (req, res) => {
  try {
    const { search, status, semester_id, page = 1, limit = 200 } = req.query;
    const offset = (page - 1) * limit;

    let q = supabase.from('students').select('*', { count: 'exact' });

    if (status) q = q.eq('status', status);
    if (semester_id) q = q.eq('semester_id', semester_id);
    if (search) {
      q = q.or(`fname.ilike.%${search}%,lname.ilike.%${search}%,phone1.ilike.%${search}%,phone2.ilike.%${search}%,email.ilike.%${search}%`);
    }

    q = q.order('created_at', { ascending: false }).range(offset, offset + Number(limit) - 1);

    const { data, error, count } = await q;
    if (error) throw error;

    // Decrypt sensitive fields before sending
    const decrypted = (data || []).map(decryptStudent);
    res.json({ data: decrypted, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /students/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('students').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Student not found' });
    res.json(decryptStudent(data));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /students — create
router.post('/',
  body('fname').notEmpty().withMessage('First name required'),
  body('phone1').notEmpty().withMessage('Phone required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const studentData = {
        ...req.body,
        created_at: new Date().toISOString(),
        created_by: req.user.id
      };
      const encrypted = encryptStudent(studentData);
      const { data, error } = await supabase.from('students').insert(encrypted).select().single();
      if (error) throw error;
      await auditLog(req.user.id, req.user.username, `Created student: ${req.body.fname} ${req.body.lname||''}`, 'create', `Phone: ${req.body.phone1}`);
      res.status(201).json(decryptStudent(data));
    } catch (err) {
      console.error('Create student error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /students/:id — update
router.put('/:id', async (req, res) => {
  try {
    const encrypted = encryptStudent({ ...req.body, updated_at: new Date().toISOString() });
    const { data, error } = await supabase.from('students').update(encrypted).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Student not found' });
    await auditLog(req.user.id, req.user.username, `Updated student: ${data.fname} ${data.lname||''}`, 'edit', `Status: ${data.status}`);
    res.json(decryptStudent(data));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /students/:id
router.delete('/:id', async (req, res) => {
  try {
    const { data: student } = await supabase.from('students').select('fname,lname').eq('id', req.params.id).single();
    const { error } = await supabase.from('students').delete().eq('id', req.params.id);
    if (error) throw error;
    // Also delete related calls
    await supabase.from('calls').delete().eq('student_id', req.params.id);
    await auditLog(req.user.id, req.user.username, `Deleted student: ${student?.fname} ${student?.lname||''}`, 'delete');
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
