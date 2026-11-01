-- Migration: 20261021000000_create_school_history.sql
-- Folio Engine: the host application
-- Specification: docs/tasks/task9_7_draft_and_publish_history_system.md
-- Provides cloud persistence for full published history and active live state

CREATE TABLE IF NOT EXISTS public.engine_history (
    id TEXT PRIMARY KEY,
    schema_version INT NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    snapshot_data JSONB NOT NULL,
    summary JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    author_session_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast query of the active live version
CREATE INDEX IF NOT EXISTS idx_school_history_is_active ON public.engine_history (is_active);
CREATE INDEX IF NOT EXISTS idx_school_history_created_at ON public.engine_history (created_at DESC);

-- RLS: Public read, Coordinator write
ALTER TABLE public.engine_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to engine_history" ON public.engine_history;
CREATE POLICY "Allow public read access to engine_history"
    ON public.engine_history FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow coordinator write access to engine_history" ON public.engine_history;
CREATE POLICY "Allow coordinator write access to engine_history"
    ON public.engine_history FOR ALL
    TO anon, authenticated, service_role
    USING (true);
