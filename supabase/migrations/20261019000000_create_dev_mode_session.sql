-- Migration: 20261019000000_create_dev_mode_session.sql
-- Folio Engine: Management, Accountability and Systematic collection of Data
-- the host application
-- Subtask 9.1: Developer Mode Database Session Lock (Strict Presence & Race Prevention)

-- 1. Create table for developer session lock (single active row: 'active_session')
CREATE TABLE IF NOT EXISTS public.dev_mode_session (
    id TEXT PRIMARY KEY DEFAULT 'active_session',
    is_locked BOOLEAN NOT NULL DEFAULT true,
    locked_by_session_id TEXT NOT NULL,
    coordinator_label TEXT DEFAULT 'Coordinator',
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 2. Index for expiry checks
CREATE INDEX IF NOT EXISTS idx_dev_mode_session_expires_at ON public.dev_mode_session (expires_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.dev_mode_session ENABLE ROW LEVEL SECURITY;

-- 4. Policy 1: Public Read Access (Anyone can check if Dev Mode is currently locked)
DROP POLICY IF EXISTS "Allow public read access to dev_mode_session" ON public.dev_mode_session;
CREATE POLICY "Allow public read access to dev_mode_session" 
    ON public.dev_mode_session FOR SELECT
    TO anon, authenticated
    USING (true);

-- 5. Policy 2: Coordinator Write Access (Allow acquire, heartbeat renew, and release)
DROP POLICY IF EXISTS "Allow coordinator write access to dev_mode_session" ON public.dev_mode_session;
CREATE POLICY "Allow coordinator write access to dev_mode_session" 
    ON public.dev_mode_session FOR ALL
    TO anon, authenticated, service_role
    USING (true);

-- 6. Seed default unlocked state for active_session
INSERT INTO public.dev_mode_session (id, is_locked, locked_by_session_id, expires_at)
VALUES ('active_session', false, '', NOW())
ON CONFLICT (id) DO NOTHING;
