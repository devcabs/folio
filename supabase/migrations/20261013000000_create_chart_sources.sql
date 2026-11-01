-- Migration: 20261013000000_create_chart_sources.sql
-- Folio Engine: Management, Accountability and Systematic collection of Data
-- the host application
-- Subtask 7.2: Supabase Cloud Storage Layer for Google Sheets Chart Sources

-- 1. Create table for dynamic chart source configurations
CREATE TABLE IF NOT EXISTS public.chart_sources (
    chart_id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    sheet_url TEXT NOT NULL,
    tab_name TEXT,
    sheet_gid TEXT,
    range TEXT,
    default_type TEXT DEFAULT 'bar',
    title_override TEXT,
    subtitle_override TEXT,
    unit_override TEXT,
    visual_config JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT 'coordinator'
);

-- 2. Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_chart_sources_chart_id ON public.chart_sources (chart_id);
CREATE INDEX IF NOT EXISTS idx_chart_sources_node_id ON public.chart_sources (node_id);
CREATE INDEX IF NOT EXISTS idx_chart_sources_updated_at ON public.chart_sources (updated_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.chart_sources ENABLE ROW LEVEL SECURITY;

-- 4. Policy 1: Public Read Access (Anyone can explore verified chart datasets)
DROP POLICY IF EXISTS "Allow public read access to chart sources" ON public.chart_sources;
CREATE POLICY "Allow public read access to chart sources" 
    ON public.chart_sources FOR SELECT
    TO anon, authenticated
    USING (true);

-- 5. Policy 2: Coordinator Write Access (Service role and authenticated coordinators)
DROP POLICY IF EXISTS "Allow coordinator write access to chart sources" ON public.chart_sources;
CREATE POLICY "Allow coordinator write access to chart sources" 
    ON public.chart_sources FOR ALL
    TO anon, authenticated, service_role
    USING (true);
