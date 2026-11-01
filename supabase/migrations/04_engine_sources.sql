-- Migration: 04_engine_sources.sql
-- Folio Engine: Source Document & Attachment Registry Table

CREATE TABLE IF NOT EXISTS public.engine_sources (
    point_id TEXT PRIMARY KEY,
    folder_url TEXT NOT NULL,
    folder_title TEXT NOT NULL,
    description TEXT,
    updated_by TEXT DEFAULT 'Coordinator',
    last_verified TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_photos JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_engine_sources_point_id ON public.engine_sources (point_id);
CREATE INDEX IF NOT EXISTS idx_engine_sources_last_verified ON public.engine_sources (last_verified DESC);

ALTER TABLE public.engine_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read engine sources" ON public.engine_sources;
CREATE POLICY "Public read engine sources"
    ON public.engine_sources FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Coordinator write engine sources" ON public.engine_sources;
CREATE POLICY "Coordinator write engine sources"
    ON public.engine_sources FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);
