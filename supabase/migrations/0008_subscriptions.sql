-- Migration 0008 : table subscriptions unifiee (web Stripe + mobile stores)

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  interval TEXT,
  external_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_own_read" ON subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "subscriptions_admin_read" ON subscriptions
  FOR SELECT USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');

CREATE POLICY "subscriptions_admin_write" ON subscriptions
  FOR ALL USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_source ON subscriptions(source);
