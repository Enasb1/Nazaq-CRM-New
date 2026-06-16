const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const { generateToken, requireAuth } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// POST /auth/login
router.post('/login',
  body('username').trim().notEmpty().withMessage('Username required'),
  body('password').notEmpty().withMessage('Password required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, password } = req.body;

    console.log(`[LOGIN] Attempt for username: "${username}"`);

    try {
      // Check users table
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username.toLowerCase())
        .eq('active', true)
        .limit(1);

      if (error) {
        console.error('[LOGIN] Supabase query error:', error.message);
        throw error;
      }

      console.log(`[LOGIN] Users found: ${users?.length || 0}`);

      const user = users?.[0];
      if (!user) {
        console.log(`[LOGIN] No active user found for "${username}"`);
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      console.log(`[LOGIN] Password valid: ${validPassword}`);
      if (!validPassword) {
        await auditLog(user.id, username, 'Failed login attempt', 'login', 'Wrong password');
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Update last login
      await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

      const token = generateToken(user);
      await auditLog(user.id, user.username, 'Logged in', 'login', `IP: ${req.ip}`);

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          fname: user.fname,
          lname: user.lname,
          role: user.role,
          permissions: user.permissions || []
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  await auditLog(req.user.id, req.user.username, 'Logged out', 'logout');
  res.json({ message: 'Logged out' });
});

// GET /auth/me — verify token and get current user
router.get('/me', requireAuth, async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('id, username, fname, lname, role, permissions, email')
    .eq('id', req.user.id)
    .single();
  res.json(user);
});

// POST /auth/change-password
router.post('/change-password', requireAuth,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { currentPassword, newPassword } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await supabase.from('users').update({ password_hash: hash }).eq('id', req.user.id);
    await auditLog(req.user.id, req.user.username, 'Changed password', 'security');
    res.json({ message: 'Password updated' });
  }
);

module.exports = router;
