require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const callRoutes = require('./routes/calls');
const { semRouter, userRouter, configRouter, auditRouter } = require('./routes/other');

const app = express();
const PORT = process.env.PORT || 3001;

// ── SECURITY HEADERS ──────────────────────────────────
app.use(helmet());
app.set('trust proxy', 1); // Required for rate limiting behind Railway/Render proxy

// ── CORS ──────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    console.warn(`Blocked CORS from: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── RATE LIMITING ─────────────────────────────────────
// Strict limit on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 login attempts per 15 min per IP
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute per IP
  message: { error: 'Too many requests. Please slow down.' }
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// ── BODY PARSER ───────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── ROUTES ────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/semesters', semRouter);
app.use('/api/users', userRouter);
app.use('/api/config', configRouter);
app.use('/api/audit', auditRouter);

// ── HEALTH CHECK ─────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── SERVE FRONTEND ────────────────────────────────────
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── 404 (API routes only) ─────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── SPA FALLBACK — serve index.html for all other routes ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── ERROR HANDLER ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── START ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ NazAQ Backend running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});
