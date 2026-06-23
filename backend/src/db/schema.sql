-- ClinicQueue Database Schema
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clinics table
CREATE TABLE IF NOT EXISTS clinics (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  phone               TEXT NOT NULL DEFAULT '',
  address             TEXT NOT NULL DEFAULT '',
  staff_count         INTEGER NOT NULL DEFAULT 2,
  is_open             BOOLEAN NOT NULL DEFAULT TRUE,
  avg_service_minutes INTEGER NOT NULL DEFAULT 8,
  created_at          BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at          BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Patients / Queue table
CREATE TABLE IF NOT EXISTS patients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number INTEGER NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'en',
  type          TEXT NOT NULL DEFAULT 'walk_in',
  reason        TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'waiting',
  joined_at     BIGINT NOT NULL,
  called_at     BIGINT,
  served_at     BIGINT,
  completed_at  BIGINT,
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  notified      BOOLEAN NOT NULL DEFAULT FALSE
);

-- Staff sessions (for analytics)
CREATE TABLE IF NOT EXISTS staff_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  staff_count INTEGER NOT NULL,
  started_at  BIGINT NOT NULL,
  ended_at    BIGINT
);

-- Authorized staff members (Google-authenticated)
CREATE TABLE IF NOT EXISTS staff_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,              -- Supabase auth.users.id (from Google login)
  email       TEXT NOT NULL,
  name        TEXT,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'staff',   -- 'admin' | 'staff'
  added_at    BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  last_login  BIGINT,
  UNIQUE(clinic_id, user_id)
);

-- Pending invites (admin invites a teammate by email before they've logged in)
CREATE TABLE IF NOT EXISTS staff_invites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'staff',
  invited_by  UUID NOT NULL,
  invited_at  BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  UNIQUE(clinic_id, email)
);

CREATE INDEX IF NOT EXISTS idx_staff_members_clinic ON staff_members(clinic_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_user   ON staff_members(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_invites_email   ON staff_invites(email);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_clinic_status ON patients(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_joined ON patients(clinic_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_patients_phone         ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_ticket        ON patients(clinic_id, ticket_number);

-- Seed a demo clinic
INSERT INTO clinics (id, name, phone, address, staff_count, avg_service_minutes)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'City Free Health Clinic',
  '+15550000000',
  '123 Main St, Springfield',
  3,
  8
) ON CONFLICT (id) DO NOTHING;

-- IMPORTANT: After your first Google login, find your user_id in
-- Supabase → Authentication → Users, then run this to make yourself admin:
--
-- INSERT INTO staff_members (clinic_id, user_id, email, name, role)
-- VALUES ('a0000000-0000-0000-0000-000000000001', '<your-user-id>', '<your-email>', '<your-name>', 'admin');
--
-- Or simply add your email to staff_invites BEFORE logging in:
-- INSERT INTO staff_invites (clinic_id, email, invited_by, role)
-- VALUES ('a0000000-0000-0000-0000-000000000001', 'you@example.com', '00000000-0000-0000-0000-000000000000', 'admin');

-- Row Level Security (optional — disable for demo)
-- ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
