-- ============================================
-- SUBSCRIPTIONS — table unifiee (web Stripe + mobile stores)
-- Source unique pour l'abonnement d'un utilisateur, alimentee par les
-- webhooks Stripe et App Store / Play.
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,                       -- 'start' | 'pro' | 'premium' | 'business'
  status TEXT NOT NULL,                     -- 'trial' | 'active' | 'expired' | 'canceled' | 'past_due'
  source TEXT NOT NULL,                     -- 'stripe' | 'apple' | 'google'
  interval TEXT,                            -- 'month' | 'year' | null (trial)
  external_id TEXT,                         -- stripe subscription id / store transaction id
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Un utilisateur lit sa propre subscription
CREATE POLICY "subscriptions_own_read" ON subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- L'admin lit tout
CREATE POLICY "subscriptions_admin_read" ON subscriptions
  FOR SELECT USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');

-- L'admin ecrit (via webhook service role, mais policy pour coherence)
CREATE POLICY "subscriptions_admin_write" ON subscriptions
  FOR ALL USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_source ON subscriptions(source);
