-- ============================================
-- KOJI - PLANNING & PROJECTS SETUP (V3 CORRECTED)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. WORKERS TABLE (Create First to allow references)
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  profession TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

-- Add policies for workers (Safe Drop/Create)
DROP POLICY IF EXISTS "Public read workers" ON workers;
CREATE POLICY "Public read workers" ON workers FOR SELECT USING (true);


-- 2. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  client_name TEXT,
  address TEXT,
  status TEXT DEFAULT 'En Cours',
  image_url TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- Enable RLS & Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can manage own projects" ON projects;

CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);


-- 3. PROJECT TASKS TABLE (Missions)
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  room_name TEXT,
  status TEXT DEFAULT 'À Faire',
  details JSONB,
  scheduled_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add NEW columns needed for Planning
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS start_time TEXT; 
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS end_time TEXT;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES workers(id) ON DELETE SET NULL;

-- Enable RLS & Policies
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own tasks" ON project_tasks;
DROP POLICY IF EXISTS "Users can manage own tasks" ON project_tasks;

CREATE POLICY "Users can view own tasks" ON project_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tasks" ON project_tasks
  FOR ALL USING (auth.uid() = user_id);


-- 4. INSERT DUMMY DATA HELPER
CREATE OR REPLACE FUNCTION add_dummy_planning_data()
RETURNS void AS $$
DECLARE
  v_user_id UUID;
  v_project_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No authenticated user found. Skipping dummy data.';
    RETURN;
  END IF;

  INSERT INTO projects (user_id, title, client_name, address, status, start_date)
  VALUES (v_user_id, 'Rénovation Cuisine', 'M. Dupont', '12 Rue de la Paix', 'En Cours', NOW())
  RETURNING id INTO v_project_id;

  INSERT INTO project_tasks (project_id, user_id, task_name, room_name, status, scheduled_date, start_time, duration, details)
  VALUES 
  (v_project_id, v_user_id, 'Pose du carrelage', 'Cuisine', 'En Cours', NOW(), '08:30', '4h00', '{"start_time": "08:30", "duration": "4h00"}');

END;
$$ LANGUAGE plpgsql;
