const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// ── SEMESTERS ──────────────────────────────────────────
const semRouter = express.Router();
semRouter.use(requireAuth);

semRouter.get('/', async (req, res) => {
  const { data, error } = await supabase.from('semesters').select('*').order('start_date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

semRouter.post('/', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('semesters').insert({ ...req.body, created_by: req.user.id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await auditLog(req.user.id, req.user.username, `Created semester: ${req.body.name}`, 'create');
  res.status(201).json(data);
});

semRouter.put('/:id', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('semesters').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await auditLog(req.user.id, req.user.username, `Updated semester: ${data.name}`, 'edit');
  res.json(data);
});

semRouter.delete('/:id', requireAdmin, async (req, res) => {
  // Unlink students first
  await supabase.from('students').update({ semester_id: null }).eq('semester_id', req.params.id);
  const { error } = await supabase.from('semesters').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  await auditLog(req.user.id, req.user.username, `Deleted semester`, 'delete', `ID: ${req.params.id}`);
  res.json({ message: 'Deleted' });
});

// ── USERS ──────────────────────────────────────────────
const userRouter = express.Router();
userRouter.use(requireAuth, requireAdmin);

userRouter.get('/', async (req, res) => {
  const { data, error } = await supabase.from('users').select('id,username,fname,lname,email,role,active,permissions,last_login,created_at').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

userRouter.post('/', async (req, res) => {
  const { password, ...rest } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase.from('users').insert({ ...rest, password_hash, username: rest.username.toLowerCase(), created_at: new Date().toISOString() }).select('id,username,fname,lname,role,active').single();
  if (error) return res.status(500).json({ error: error.message });
  await auditLog(req.user.id, req.user.username, `Created user: ${rest.username}`, 'create', `Role: ${rest.role}`);
  res.status(201).json(data);
});

userRouter.put('/:id', async (req, res) => {
  const { password, ...rest } = req.body;
  const updates = { ...rest };
  if (password) updates.password_hash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase.from('users').update(updates).eq('id', req.params.id).select('id,username,fname,lname,role,active').single();
  if (error) return res.status(500).json({ error: error.message });
  await auditLog(req.user.id, req.user.username, `Updated user: ${data.username}`, 'edit');
  res.json(data);
});

userRouter.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  const { data: user } = await supabase.from('users').select('username').eq('id', req.params.id).single();
  const { error } = await supabase.from('users').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  await auditLog(req.user.id, req.user.username, `Deleted user: ${user?.username}`, 'delete');
  res.json({ message: 'Deleted' });
});

// ── CONFIG ─────────────────────────────────────────────
const configRouter = express.Router();
configRouter.use(requireAuth);

configRouter.get('/', async (req, res) => {
  const { data } = await supabase.from('config').select('*').eq('key', 'field_config').single();
  res.json(data?.value || {});
});

configRouter.put('/', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('config').upsert({ key: 'field_config', value: req.body, updated_at: new Date().toISOString() });
  if (error) return res.status(500).json({ error: error.message });
  await auditLog(req.user.id, req.user.username, 'Updated field configuration', 'permission');
  res.json({ message: 'Config saved' });
});

// ── AUDIT LOG ──────────────────────────────────────────
const auditRouter = express.Router();
auditRouter.use(requireAuth, requireAdmin);

auditRouter.get('/', async (req, res) => {
  const { type, username, page = 1, limit = 100 } = req.query;
  const offset = (page - 1) * limit;
  let q = supabase.from('audit_log').select('*', { count: 'exact' });
  if (type) q = q.eq('type', type);
  if (username) q = q.eq('username', username);
  q = q.order('created_at', { ascending: false }).range(offset, offset + Number(limit) - 1);
  const { data, error, count } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data || [], total: count });
});

module.exports = { semRouter, userRouter, configRouter, auditRouter };
