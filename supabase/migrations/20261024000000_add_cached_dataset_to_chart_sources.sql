-- Migration: 20261024000000_add_cached_dataset_to_chart_sources.sql
-- Folio Engine: Management, Accountability and Systematic collection of Data
-- the host application
-- Phase 14: Add cached_dataset JSONB column to chart_sources for zero-quota public viewing

-- 1. Extend chart_sources table with zero-quota cached_dataset JSONB column
ALTER TABLE public.chart_sources 
ADD COLUMN IF NOT EXISTS cached_dataset JSONB;

-- 2. Add archival documentation comment
COMMENT ON COLUMN public.chart_sources.cached_dataset IS 
'Pre-cached Google Sheets dataset matrix for zero-quota public chart rendering';

-- 3. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
