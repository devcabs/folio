-- Migration: 01_engine_storage.sql
-- Folio Engine: Storage Bucket & Draft Sandbox Table
-- Provides cloud persistence for active coordinator draft sandbox and public media bucket

-- 1. Create or configure storage bucket: engine-media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'engine-media',
    'engine-media',
    true,
    10485760, -- 10 MB limit
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/svg+xml',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760;

-- 2. Storage RLS Policies
DROP POLICY IF EXISTS "Allow public read access to engine-media" ON storage.objects;
CREATE POLICY "Allow public read access to engine-media"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'engine-media');

DROP POLICY IF EXISTS "Allow coordinator upload to engine-media" ON storage.objects;
CREATE POLICY "Allow coordinator upload to engine-media"
    ON storage.objects FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'engine-media');

DROP POLICY IF EXISTS "Allow coordinator update to engine-media" ON storage.objects;
CREATE POLICY "Allow coordinator update to engine-media"
    ON storage.objects FOR UPDATE
    TO public
    USING (bucket_id = 'engine-media');

-- 3. Create engine_drafts Table
CREATE TABLE IF NOT EXISTS public.engine_drafts (
    id TEXT PRIMARY KEY DEFAULT 'active_draft',
    base_snapshot_id TEXT NOT NULL,
    canvases JSONB NOT NULL DEFAULT '{}'::JSONB,
    content_overrides JSONB NOT NULL DEFAULT '{}'::JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_session TEXT,
    locked_by_session TEXT,
    locked_at TIMESTAMPTZ
);

ALTER TABLE public.engine_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on engine_drafts" ON public.engine_drafts;
CREATE POLICY "Allow public read on engine_drafts"
    ON public.engine_drafts FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Allow coordinator update on engine_drafts" ON public.engine_drafts;
CREATE POLICY "Allow coordinator update on engine_drafts"
    ON public.engine_drafts FOR UPDATE
    TO public
    USING (true);

DROP POLICY IF EXISTS "Allow coordinator insert on engine_drafts" ON public.engine_drafts;
CREATE POLICY "Allow coordinator insert on engine_drafts"
    ON public.engine_drafts FOR INSERT
    TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow coordinator delete on engine_drafts" ON public.engine_drafts;
CREATE POLICY "Allow coordinator delete on engine_drafts"
    ON public.engine_drafts FOR DELETE
    TO public
    USING (true);
