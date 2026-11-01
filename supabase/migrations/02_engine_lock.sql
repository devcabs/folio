-- Migration: 02_engine_lock.sql
-- Folio Engine: Session Lock & Race Prevention Table

CREATE TABLE IF NOT EXISTS public.dev_mode_session (
    id TEXT PRIMARY KEY DEFAULT 'active_session',
    is_locked BOOLEAN NOT NULL DEFAULT true,
    locked_by_session_id TEXT NOT NULL,
    coordinator_label TEXT DEFAULT 'Coordinator',
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dev_mode_session_expires_at ON public.dev_mode_session (expires_at);

ALTER TABLE public.dev_mode_session ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to dev_mode_session" ON public.dev_mode_session;
CREATE POLICY "Allow public read access to dev_mode_session" 
    ON public.dev_mode_session FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow coordinator write access to dev_mode_session" ON public.dev_mode_session;
CREATE POLICY "Allow coordinator write access to dev_mode_session" 
    ON public.dev_mode_session FOR ALL
    TO anon, authenticated, service_role
    USING (true);

INSERT INTO public.dev_mode_session (id, is_locked, locked_by_session_id, expires_at)
VALUES ('active_session', false, '', NOW())
ON CONFLICT (id) DO NOTHING;
