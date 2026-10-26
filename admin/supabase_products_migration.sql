-- Create Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT,
  price_ht NUMERIC(10, 2) NOT NULL,
  unit TEXT NOT NULL, -- 'L', 'kg', 'u', 'm2', etc.
  packaging TEXT, -- 'Pot 10L', 'Sac 25kg'
  category TEXT, -- 'Peinture', 'Enduit', 'Outillage', etc.
  brand TEXT,
  consumption_rule_type TEXT DEFAULT 'fixed', -- 'fixed', 'perM2', 'perLinearMeter', 'perPiece'
  consumption_rule_factor NUMERIC(10, 2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read products (or just authenticated users)
CREATE POLICY "Enable read access for all users" ON products
  FOR SELECT USING (true);

-- Only authenticated users (admins) can insert/update/delete
-- ideally checking for a role, but for now allow auth users
CREATE POLICY "Enable insert for authenticated users only" ON products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON products
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON products
  FOR DELETE USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
