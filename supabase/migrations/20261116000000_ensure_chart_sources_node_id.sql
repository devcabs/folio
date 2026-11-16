-- Migration: 20261116000000_ensure_chart_sources_node_id.sql
-- Folio Engine: Google Sheets Chart Sources
-- Ensure node_id column exists on public.chart_sources and reload PostgREST schema cache

-- 1. Ensure node_id column exists on chart_sources table with safe default
ALTER TABLE public.chart_sources 
ADD COLUMN IF NOT EXISTS node_id TEXT NOT NULL DEFAULT 'access';

-- 2. Create index for performant node filtering
CREATE INDEX IF NOT EXISTS idx_chart_sources_node_id ON public.chart_sources (node_id);

-- 3. Document column purpose
COMMENT ON COLUMN public.chart_sources.node_id IS 
'Parent node identifier for grouping and filtering chart configurations';

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
