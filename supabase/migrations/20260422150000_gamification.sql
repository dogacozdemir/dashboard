-- ─────────────────────────────────────────────────────────────────────────────
-- Gamification: streaks, achievements, campaign goals
-- ─────────────────────────────────────────────────────────────────────────────

-- User streak tracker (denormalised for fast reads)
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id          UUID    PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id        UUID    NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  current_streak   INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Earned achievements per user (one row per achievement, UNIQUE enforces no dupes)
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  earned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB,
  UNIQUE (user_id, achievement_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user   ON public.user_achievements (user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_tenant ON public.user_achievements (tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_tenant      ON public.user_streaks (tenant_id);

-- Campaign goals (optional targets for progress bars)
ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS goal_impressions BIGINT,
  ADD COLUMN IF NOT EXISTS goal_clicks      BIGINT,
  ADD COLUMN IF NOT EXISTS goal_spend       NUMERIC(12, 2);

-- RLS
ALTER TABLE public.user_streaks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- user_streaks policies
CREATE POLICY "users_read_own_streak"
  ON public.user_streaks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_read_tenant_streaks"
  ON public.user_streaks FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "users_upsert_own_streak"
  ON public.user_streaks FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- user_achievements policies
CREATE POLICY "users_read_own_achievements"
  ON public.user_achievements FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_read_tenant_achievements"
  ON public.user_achievements FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "users_insert_own_achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (user_id = auth.uid());
