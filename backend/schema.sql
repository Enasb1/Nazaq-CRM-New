-- ═══════════════════════════════════════════════════════════
-- NazAQ CRM — Supabase Database Schema
-- Run this entire file in: Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── USERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      TEXT UNIQUE NOT NULL,
  fname         TEXT NOT NULL,
  lname         TEXT,
  email         TEXT,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'agent'
                  CHECK (role IN ('admin','manager','agent','readonly')),
  permissions   JSONB DEFAULT '[]',
  active        BOOLEAN DEFAULT true,
  notes         TEXT,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── STUDENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Core fields (always present)
  fname         TEXT NOT NULL,
  lname         TEXT,
  phone1        TEXT NOT NULL,
  phone2        TEXT,
  email         TEXT,
  -- ID number stored ENCRYPTED (AES-256 via backend)
  id_number     TEXT,
  age           TEXT,
  city          TEXT,
  address       TEXT,
  school        TEXT,
  status        TEXT DEFAULT 'new'
                  CHECK (status IN ('new','contacted','callback','notinterested','registered')),
  semester_id   UUID REFERENCES semesters(id) ON DELETE SET NULL,
  how_heard     TEXT,
  -- Parent details
  parent_name   TEXT,
  parent_phone  TEXT,
  parent_email  TEXT,
  -- Extra dynamic fields stored as JSON
  -- This allows admin-configured custom fields without schema changes
  extra_fields  JSONB DEFAULT '{}',
  notes         TEXT,
  -- Meta
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ── SEMESTERS ─────────────────────────────────────────────
-- Must be created BEFORE students table references it
-- (Run this section first if you get a foreign key error)
CREATE TABLE IF NOT EXISTS semesters (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('autumn','spring','summer')),
  year          INTEGER NOT NULL,
  start_date    DATE,
  end_date      DATE,
  reg_deadline  DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ── CALLS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calls (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID REFERENCES students(id) ON DELETE SET NULL,
  fname         TEXT,
  lname         TEXT,
  phone         TEXT,
  datetime      TIMESTAMPTZ,
  caller        TEXT,
  direction     TEXT CHECK (direction IN ('received','initiated')),
  details       TEXT,
  followup      TEXT DEFAULT 'no' CHECK (followup IN ('yes','no')),
  followup_date DATE,
  comments      TEXT,
  -- For Android app: auto-detected call data
  duration_seconds INTEGER,
  auto_detected BOOLEAN DEFAULT false,
  -- Extra dynamic fields
  extra_fields  JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ── AUDIT LOG ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    TEXT,
  username   TEXT,
  action     TEXT NOT NULL,
  type       TEXT NOT NULL,
  detail     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONFIG ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Blocks ALL direct Supabase API access from browsers
-- Only your backend server (with service key) can access data
-- ═══════════════════════════════════════════════════════════
ALTER TABLE users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE students  ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls     ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE config    ENABLE ROW LEVEL SECURITY;

-- No policies = no public access. Only service_role key (backend) bypasses RLS.
-- This means even if someone finds your Supabase URL, they cannot read any data.

-- ═══════════════════════════════════════════════════════════
-- INDEXES (for fast searches)
-- ═══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_students_status    ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_semester  ON students(semester_id);
CREATE INDEX IF NOT EXISTS idx_students_phone     ON students(phone1);
CREATE INDEX IF NOT EXISTS idx_students_created   ON students(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_student      ON calls(student_id);
CREATE INDEX IF NOT EXISTS idx_calls_followup     ON calls(followup, followup_date);
CREATE INDEX IF NOT EXISTS idx_calls_datetime     ON calls(datetime DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user         ON audit_log(username);
CREATE INDEX IF NOT EXISTS idx_audit_created      ON audit_log(created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- SEED: Default admin user
-- Password: Admin@NazAQ2024  (CHANGE THIS IMMEDIATELY after first login)
-- Bcrypt hash of 'Admin@NazAQ2024'
-- ═══════════════════════════════════════════════════════════
INSERT INTO users (username, fname, lname, role, password_hash, active)
VALUES (
  'admin',
  'Admin',
  'NazAQ',
  'admin',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCgAv3G0GTaSaWHInl0Xjzy',
  true
)
ON CONFLICT (username) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- SEED: Sample semesters
-- ═══════════════════════════════════════════════════════════
INSERT INTO semesters (name, type, year, start_date, end_date, reg_deadline)
VALUES
  ('סמסטר א׳ תשפ"ה', 'autumn', 2024, '2024-10-01', '2025-01-31', '2024-09-15'),
  ('סמסטר ב׳ תשפ"ה', 'spring', 2025, '2025-03-01', '2025-06-30', '2025-02-15'),
  ('סמסטר קיץ תשפ"ה', 'summer', 2025, '2025-07-01', '2025-08-31', '2025-06-20'),
  ('סמסטר א׳ תשפ"ו', 'autumn', 2025, '2025-10-01', '2026-01-31', '2025-09-15')
ON CONFLICT DO NOTHING;
