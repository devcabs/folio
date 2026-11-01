-- Migration: 20261009000000_add_synced_photos_to_engine_sources.sql
-- Folio Engine: Management, Accountability and Systematic collection of Data
-- the host application
-- Phase 6: Dynamic Drive Photo Synchronization & High-Performance Diffing Gallery

-- 1. Extend engine_sources table with zero-quota synced_photos JSONB column
ALTER TABLE engine_sources 
ADD COLUMN IF NOT EXISTS synced_photos JSONB DEFAULT '[]'::jsonb;

-- 2. Add archival documentation comment
COMMENT ON COLUMN engine_sources.synced_photos IS 
'Differential cache of synced Google Drive MOV photographs for zero-quota public rendering';
