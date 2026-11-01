-- Migration: 20261008000000_create_engine_sources.sql
-- Folio Engine: Management, Accountability and Systematic collection of Data
-- the host application
-- Subtask 5.1: Database Schema & BaaS Persistence Engine

-- 1. Create table for dynamic source folder attachments
CREATE TABLE IF NOT EXISTS engine_sources (
  point_id TEXT PRIMARY KEY,
  folder_url TEXT NOT NULL,
  folder_title TEXT NOT NULL,
  description TEXT,
  updated_by TEXT DEFAULT 'Coordinator',
  last_verified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_engine_sources_point_id ON engine_sources (point_id);
CREATE INDEX IF NOT EXISTS idx_engine_sources_last_verified ON engine_sources (last_verified DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE engine_sources ENABLE ROW LEVEL SECURITY;

-- 4. Policy 1: Public Read Access (Anyone can explore verified folders)
DROP POLICY IF EXISTS "Public read source sources" ON engine_sources;
CREATE POLICY "Public read source sources"
  ON engine_sources FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5. Policy 2: Coordinator Write Access (Anon, authenticated, and service role coordinators)
DROP POLICY IF EXISTS "Coordinator write source sources" ON engine_sources;
CREATE POLICY "Coordinator write source sources"
  ON engine_sources FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);
