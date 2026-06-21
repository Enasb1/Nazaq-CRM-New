-- ═══════════════════════════════════════════════════════════
-- DOCTOR TRAINING COURSE — separate feature
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1) Doctor courses
CREATE TABLE IF NOT EXISTS doctor_courses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  start_date    DATE,
  mid_date      DATE,
  exam_date     DATE,
  price         NUMERIC DEFAULT 0,        -- course price (excludes registration fee)
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 2) Doctors (registered to a course)
CREATE TABLE IF NOT EXISTS doctors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id       UUID REFERENCES doctor_courses(id) ON DELETE SET NULL,
  fname           TEXT NOT NULL,
  lname           TEXT NOT NULL,
  city            TEXT,
  id_number       TEXT NOT NULL,
  phone1          TEXT NOT NULL,           -- WhatsApp
  phone2          TEXT,
  reg_date        DATE DEFAULT NOW(),      -- date registered
  parent_name     TEXT,
  parent_phone    TEXT,
  email           TEXT NOT NULL,
  diploma_country TEXT NOT NULL,           -- ארץ דיפלומה
  grad_year       TEXT NOT NULL,           -- שנת סיום
  comments        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 3) Doctor payments (one row per doctor, holds registration + payments array as JSONB)
CREATE TABLE IF NOT EXISTS doctor_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id       UUID REFERENCES doctors(id) ON DELETE CASCADE,
  reg_fee_paid    TEXT DEFAULT 'no',       -- מקדמה: yes/no
  reg_fee_date    DATE,
  reg_fee_amount  NUMERIC,
  reg_fee_method  TEXT,                    -- מזומן/העברה בנקאית/שק/אשראי/אחר
  payments        JSONB DEFAULT '[]',      -- array of {date, amount, method, comment}
  comments        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_doctors_course ON doctors(course_id);
CREATE INDEX IF NOT EXISTS idx_doctor_payments_doctor ON doctor_payments(doctor_id);
