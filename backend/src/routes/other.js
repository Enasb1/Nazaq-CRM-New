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
  if (error) {
    console.error('[SEMESTERS] Supabase error:', error.message, '| details:', error.details, '| hint:', error.hint);
    return res.status(500).json({ error: error.message });
  }
  res.json(data || []);
});

semRouter.post('/', requireAdmin, async (req, res) => {
  const cleaned = {};
  for (const [k, v] of Object.entries(req.body)) cleaned[k] = (v === '') ? null : v;
  const { data, error } = await supabase.from('semesters').insert({ ...cleaned, created_by: req.user.id }).select().single();
  if (error) {
    console.error('[SEMESTER CREATE] error:', error.message, '| details:', error.details);
    return res.status(500).json({ error: error.message });
  }
  await auditLog(req.user.id, req.user.username, `Created semester: ${req.body.name}`, 'create');
  res.status(201).json(data);
});

semRouter.put('/:id', requireAdmin, async (req, res) => {
  const cleaned = {};
  for (const [k, v] of Object.entries(req.body)) cleaned[k] = (v === '') ? null : v;
  const { data, error } = await supabase.from('semesters').update(cleaned).eq('id', req.params.id).select().single();
  if (error) {
    console.error('[SEMESTER UPDATE] error:', error.message, '| details:', error.details);
    return res.status(500).json({ error: error.message });
  }
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

// ── WELCOME FORM STATS (admin only) ────────────────────
const welcomeStatsRouter = express.Router();
welcomeStatsRouter.use(requireAuth, requireAdmin);

welcomeStatsRouter.get('/', async (req, res) => {
  const { data, error } = await supabase.from('welcome_stats').select('event, created_at');
  if (error) {
    console.error('[WELCOME STATS] read error:', error.message);
    return res.status(500).json({ error: error.message });
  }
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  // Known non-human visitors: link-preview fetchers, crawlers, scripts, monitors
  const BOT_RE = /bot|crawl|spider|preview|whatsapp|facebookexternalhit|telegram|twitterbot|slack|discord|linkedin|curl|wget|python|go-http|axios|okhttp|headless|monitor|pingdom|uptime|scan|lighthouse|^none$/i;
  const empty = () => ({ visit: 0, visit_human: 0, visit_bot: 0, visit_unknown: 0, success: 0, invalid: 0, blocked: 0 });
  const agg = { total: empty(), week: empty() };
  const bump = (b, r) => {
    if (b[r.event] === undefined) return;
    b[r.event]++;
    if (r.event === 'visit') {
      if (!r.detail) b.visit_unknown++;            // rows from before UA logging existed
      else if (BOT_RE.test(r.detail)) b.visit_bot++;
      else b.visit_human++;
    }
  };
  (data || []).forEach((r) => {
    bump(agg.total, r);
    if (new Date(r.created_at).getTime() >= weekAgo) bump(agg.week, r);
  });
  res.json(agg);
});

module.exports = { semRouter, userRouter, configRouter, auditRouter, welcomeStatsRouter };
