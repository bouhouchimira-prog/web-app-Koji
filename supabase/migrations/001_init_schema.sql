-- ============================================
-- KOJI DATABASE SCHEMA FOR SUPABASE
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES (existing features)
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  total_amount NUMERIC,
  currency TEXT DEFAULT 'EUR',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quote_items (
  id TEXT PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  code TEXT,
  label TEXT NOT NULL,
  unit TEXT,
  quantity NUMERIC DEFAULT 0,
  unit_price NUMERIC,
  total_price NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE,
  amount NUMERIC,
  status TEXT DEFAULT 'draft',
  due_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  code TEXT,
  label TEXT,
  status TEXT DEFAULT 'À faire',
  done BOOLEAN DEFAULT false,
  due_date DATE,
  start_date DATE,
  end_date DATE,
  duration_hours INT,
  estimated_hours INT,
  worker_ids TEXT[],
  assigned_to TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  trade TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE supplies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  quantity INT,
  unit_price NUMERIC,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  location TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE project_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT,
  file_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT,
  entity_type TEXT,
  entity_id TEXT,
  changes JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- MARKETPLACE TABLES (Phase 1-2)
-- ============================================

CREATE TABLE chantier_offres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metier TEXT NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  city TEXT,
  postal_code TEXT,
  lat FLOAT8,
  lon FLOAT8,
  status TEXT DEFAULT 'published',
  budget NUMERIC,
  estimated_days INT,
  photos JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE marketplace_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES chantier_offres(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chantier_visites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES chantier_offres(id) ON DELETE CASCADE,
  entreprise_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposed_datetime TIMESTAMP NOT NULL,
  confirmed_datetime TIMESTAMP,
  status TEXT DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ENTREPRISE TABLES (Phase 3-5)
-- ============================================

CREATE TABLE entreprise_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE entreprise_team (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'employee',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE devis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES entreprise_clients(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  status TEXT DEFAULT 'draft',
  total_amount NUMERIC,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_quotes_user_id ON quotes(user_id);
CREATE INDEX idx_quotes_project_id ON quotes(project_id);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_workers_user_id ON workers(user_id);
CREATE INDEX idx_supplies_user_id ON supplies(user_id);
CREATE INDEX idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX idx_history_user_id ON history(user_id);

CREATE INDEX idx_chantier_offres_user_id ON chantier_offres(user_id);
CREATE INDEX idx_chantier_offres_status ON chantier_offres(status);
CREATE INDEX idx_marketplace_messages_offer_id ON marketplace_messages(offer_id);
CREATE INDEX idx_chantier_visites_offer_id ON chantier_visites(offer_id);
CREATE INDEX idx_chantier_visites_status ON chantier_visites(status);

CREATE INDEX idx_entreprise_clients_entreprise_id ON entreprise_clients(entreprise_id);
CREATE INDEX idx_entreprise_team_entreprise_id ON entreprise_team(entreprise_id);
CREATE INDEX idx_devis_entreprise_id ON devis(entreprise_id);
CREATE INDEX idx_devis_status ON devis(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all user-scoped tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantier_offres ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantier_visites ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprise_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE entreprise_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis ENABLE ROW LEVEL SECURITY;

-- Projects: users can only see/edit their own
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

-- Quotes: users can only see/edit their own
CREATE POLICY "Users can view their own quotes"
  ON quotes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create quotes"
  ON quotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quotes"
  ON quotes FOR UPDATE
  USING (auth.uid() = user_id);

-- Tasks: same pattern
CREATE POLICY "Users can view their own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id);

-- Workers: users can only see/edit their own
CREATE POLICY "Users can view their own workers"
  ON workers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create workers"
  ON workers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Invoices: users can only see/edit their own
CREATE POLICY "Users can view their own invoices"
  ON invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Supplies: users can only see/edit their own
CREATE POLICY "Users can view their own supplies"
  ON supplies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create supplies"
  ON supplies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Suppliers: users can only see/edit their own
CREATE POLICY "Users can view their own suppliers"
  ON suppliers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create suppliers"
  ON suppliers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Notifications: users can only see their own
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Calendar events: users can only see their own
CREATE POLICY "Users can view their own calendar events"
  ON calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create calendar events"
  ON calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Project documents: inherit from project access
CREATE POLICY "Users can view documents of their projects"
  ON project_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_documents.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- History: users can only see their own
CREATE POLICY "Users can view their own history"
  ON history FOR SELECT
  USING (auth.uid() = user_id);

-- Chantier Offres: users can see/edit their own, see all published
CREATE POLICY "Users can view all published offers or their own"
  ON chantier_offres FOR SELECT
  USING (
    status = 'published' OR auth.uid() = user_id
  );

CREATE POLICY "Users can create offers"
  ON chantier_offres FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own offers"
  ON chantier_offres FOR UPDATE
  USING (auth.uid() = user_id);

-- Marketplace messages: visible to offer owner and sender
CREATE POLICY "Users can view messages on their offers or messages they sent"
  ON marketplace_messages FOR SELECT
  USING (
    sender_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chantier_offres
      WHERE chantier_offres.id = marketplace_messages.offer_id
      AND chantier_offres.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages"
  ON marketplace_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Chantier Visites: visible to offer owner, entreprise, or consumer
CREATE POLICY "Users can view visites they're involved in"
  ON chantier_visites FOR SELECT
  USING (
    auth.uid() = entreprise_id OR
    auth.uid() = consumer_id OR
    EXISTS (
      SELECT 1 FROM chantier_offres
      WHERE chantier_offres.id = chantier_visites.offer_id
      AND chantier_offres.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create visites"
  ON chantier_visites FOR INSERT
  WITH CHECK (auth.uid() = consumer_id);

-- Entreprise clients: visible to entreprise only
CREATE POLICY "Entreprises can view their own clients"
  ON entreprise_clients FOR SELECT
  USING (auth.uid() = entreprise_id);

CREATE POLICY "Entreprises can create clients"
  ON entreprise_clients FOR INSERT
  WITH CHECK (auth.uid() = entreprise_id);

CREATE POLICY "Entreprises can update their clients"
  ON entreprise_clients FOR UPDATE
  USING (auth.uid() = entreprise_id);

-- Entreprise team: visible to entreprise only
CREATE POLICY "Entreprises can view their team"
  ON entreprise_team FOR SELECT
  USING (auth.uid() = entreprise_id);

CREATE POLICY "Entreprises can add team members"
  ON entreprise_team FOR INSERT
  WITH CHECK (auth.uid() = entreprise_id);

-- Devis: visible to entreprise only
CREATE POLICY "Entreprises can view their devis"
  ON devis FOR SELECT
  USING (auth.uid() = entreprise_id);

CREATE POLICY "Entreprises can create devis"
  ON devis FOR INSERT
  WITH CHECK (auth.uid() = entreprise_id);

CREATE POLICY "Entreprises can update their devis"
  ON devis FOR UPDATE
  USING (auth.uid() = entreprise_id);
