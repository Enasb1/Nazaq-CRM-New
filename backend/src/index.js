require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const callRoutes = require('./routes/calls');
const doctorRoutes = require('./routes/doctors');
const publicRoutes = require('./routes/public');
const { semRouter, userRouter, configRouter, auditRouter, welcomeStatsRouter } = require('./routes/other');

const app = express();
const PORT = process.env.PORT || 3001;

// ── SECURITY HEADERS ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
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
app.use('/api/public', publicRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/semesters', semRouter);
app.use('/api/users', userRouter);
app.use('/api/config', configRouter);
app.use('/api/audit', auditRouter);
app.use('/api/welcome-stats', welcomeStatsRouter);

// ── HEALTH CHECK ─────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── SERVE FRONTEND ────────────────────────────────────
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    // HTML must always be revalidated so users get new versions right after deploy
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// Public lead form (clean URL)
app.get('/welcome', (req, res) => {
  require('./utils/welcomeStats').logWelcome('visit');
  res.sendFile(path.join(__dirname, '..', 'public', 'welcome.html'));
});
// Old URL redirects to the new one
app.get('/lead', (req, res) => res.redirect(301, '/welcome'));

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
